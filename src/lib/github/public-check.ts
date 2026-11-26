/**
 * Aperture's checks on anyone's public pull request, from its link: the rows
 * the editor and Agent Check show, judged on the server from what GitHub
 * serves to everyone, with nothing installed and none of the code run.
 *
 * What it reads: the pull request's diff, the changed files after the change
 * (the diff rebuilds them before it, `pull-diff.ts`), the `package.json`
 * files above them, the root `tsconfig.json`, the project's own checks, and
 * the files the changed code imports. No repository listing: an import is
 * looked for where resolution would look. So Parses, Imports resolve,
 * Safety, the tests' tampering rule and Project checks are the real thing;
 * Types (which needs the project's packages) and the tests themselves are
 * left to Agent Check in the repository's own CI, and the page says so.
 *
 * Pure: the server function fetches, this decides what to fetch and judges.
 */
import { changeChecks, type CheckRow } from "../workspace/checks.ts";
import { collectImports, importCandidates, resolveSpecifier } from "../workspace/module-graph.ts";
import { CHECKS_PATH } from "../workspace/project-checks.ts";
import type { ProposedEdit } from "../workspace/types.ts";
import { addedText, removedText, reverseApply, type DiffFile } from "./pull-diff.ts";

export { headline, shareMarkdown, verdictOf, type Verdict } from "./check-summary.ts";

export const PUBLIC_LIMITS = {
  changedFiles: 100,
  fileBytes: 1_000_000,
  /** Folders above the changed files whose `package.json` is looked for. */
  packageDirs: 20,
  /** Imports of unchanged files looked for. */
  importProbes: 60,
} as const;

const SKIPPED_DIR = /(^|\/)(node_modules|\.git)\//;
const SCRIPT = /\.(?:[cm]?[jt]sx?)$/i;
/** Files that say the repository is a monorepo, whose packages import each other by name. */
const WORKSPACE_FILES = ["pnpm-workspace.yaml", "lerna.json"];

function dirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

/** The changed files the check reads, in the diff's order, at most 100. */
function inScope(diff: DiffFile[]): DiffFile[] {
  return diff.filter((file) => !SKIPPED_DIR.test(file.path)).slice(0, PUBLIC_LIMITS.changedFiles);
}

/**
 * The files to read at the pull request's head before judging: the changed
 * files the diff does not hold in full, and what describes the project.
 */
export function firstReads(diff: DiffFile[]): string[] {
  const reads = new Set<string>();
  const dirs = new Set<string>([""]);
  for (const file of inScope(diff)) {
    if (!file.binary && (file.status === "modified" || file.status === "renamed"))
      reads.add(file.path);
    for (let dir = dirOf(file.path); dir && dirs.size < PUBLIC_LIMITS.packageDirs; dir = dirOf(dir))
      dirs.add(dir);
  }
  for (const dir of dirs) reads.add(dir ? `${dir}/package.json` : "package.json");
  for (const path of ["tsconfig.json", CHECKS_PATH, ...WORKSPACE_FILES]) reads.add(path);
  return [...reads];
}

/** A file that says how the project resolves and checks code, rather than code the change is about. */
function describes(path: string): boolean {
  return (
    path === "package.json" ||
    path.endsWith("/package.json") ||
    ["tsconfig.json", CHECKS_PATH, ...WORKSPACE_FILES].includes(path)
  );
}

export type Assembled = {
  /** Changed files before the change, by their path then. */
  base: Record<string, string>;
  /** Changed files after it. */
  head: Record<string, string>;
  /** Unchanged files read: the same before and after. */
  known: Record<string, string>;
  /** Changed files nothing could read: binary, too big, past the first 100, or moved on since the diff. */
  notChecked: string[];
};

/** The texts before and after, from the diff and what was read at the head (`read`: path to text, absent when not there). */
export function assemble(diff: DiffFile[], read: Record<string, string>): Assembled {
  const base: Record<string, string> = {};
  const head: Record<string, string> = {};
  const notChecked: string[] = [];
  const changed = new Set<string>();
  const scoped = new Set(inScope(diff));
  for (const file of diff) {
    changed.add(file.path);
    if (file.previousPath) changed.add(file.previousPath);
    if (SKIPPED_DIR.test(file.path)) continue;
    if (!scoped.has(file) || file.binary) {
      notChecked.push(file.path);
      continue;
    }
    if (file.status === "added") head[file.path] = addedText(file.hunks);
    else if (file.status === "removed") base[file.path] = removedText(file.hunks);
    else {
      const after = read[file.path];
      const before = after === undefined ? null : reverseApply(after, file.hunks);
      if (after === undefined || before === null) {
        notChecked.push(file.path);
        continue;
      }
      head[file.path] = after;
      base[file.previousPath ?? file.path] = before;
    }
  }
  const known: Record<string, string> = {};
  for (const [path, text] of Object.entries(read)) {
    if (!changed.has(path) && text.length <= PUBLIC_LIMITS.fileBytes) known[path] = text;
  }
  // A changed package.json, tsconfig or checks file describes the project as it was.
  for (const path of firstReads(diff)) {
    if (describes(path) && base[path] !== undefined && known[path] === undefined)
      known[path] = base[path]!;
  }
  return { base, head, known, notChecked };
}

export type Probe = { from: string; spec: string; candidates: string[] };

/**
 * The imports in the changed code that nothing read so far resolves: where
 * each could be, in resolution's order, to look for at the head.
 */
export function importProbes(assembled: Assembled): Probe[] {
  const { known, base, head } = assembled;
  const after = { ...known, ...base, ...head };
  const probes: Probe[] = [];
  const seen = new Set<string>();
  for (const [path, text] of Object.entries(head)) {
    if (!SCRIPT.test(path)) continue;
    for (const ref of collectImports(path, text)) {
      if (resolveSpecifier(path, ref.spec, after).kind !== "missing") continue;
      const candidates = (importCandidates(path, ref.spec, after) ?? []).filter(
        (candidate) => after[candidate] === undefined && !SKIPPED_DIR.test(candidate),
      );
      const key = candidates.join("|");
      if (candidates.length === 0 || seen.has(key)) continue;
      seen.add(key);
      probes.push({ from: path, spec: ref.spec, candidates });
    }
  }
  return probes;
}

/** Whether the project's packages import each other by name: then which packages exist cannot be listed from here. */
export function isMonorepo(known: Record<string, string>): boolean {
  if (WORKSPACE_FILES.some((path) => known[path] !== undefined)) return true;
  try {
    return Boolean(
      (JSON.parse(known["package.json"] ?? "{}") as { workspaces?: unknown }).workspaces,
    );
  } catch {
    return false;
  }
}

/** The packages the changed code imports by name. */
function importedPackages(head: Record<string, string>, files: Record<string, string>): string[] {
  const names = new Set<string>();
  for (const [path, text] of Object.entries(head)) {
    if (!SCRIPT.test(path)) continue;
    for (const ref of collectImports(path, text)) {
      const hit = resolveSpecifier(path, ref.spec, files);
      if (hit.kind === "external") names.add(hit.pkg);
    }
  }
  return [...names];
}

const TYPES_HERE =
  "Not run here: tsc needs the project's packages installed. Agent Check runs it in the repository's own CI.";
const TESTS_HERE =
  "this page does not run the pull request's code. Agent Check runs the tests in the repository's own CI.";

/**
 * The check rows for the change. `partial`: some imports could not be looked
 * for (past the limit), so a missing one is not called red.
 */
export function publicRows(input: {
  diff: DiffFile[];
  assembled: Assembled;
  partial?: boolean;
}): CheckRow[] {
  const { base, head, known } = input.assembled;
  const files: Record<string, string> = { ...known, ...base };
  const edits: ProposedEdit[] = [];
  const edit = (
    path: string,
    oldText: string,
    newText: string,
    deleted?: boolean,
  ): ProposedEdit => ({
    id: `pull:${path}`,
    path,
    oldText,
    newText,
    description: "Pull request",
    status: "pending",
    ...(deleted ? { deleted: true } : {}),
  });
  for (const file of input.diff) {
    if (file.status === "removed") {
      if (base[file.path] !== undefined) edits.push(edit(file.path, base[file.path]!, "", true));
      continue;
    }
    const now = head[file.path];
    if (now === undefined) continue;
    const was = file.status === "renamed" ? file.previousPath : file.path;
    const before = file.status === "added" ? "" : was ? base[was] : undefined;
    if (before === undefined) continue;
    // A moved file is judged as a change at its new path, from its text at the old one.
    if (was && was !== file.path) files[file.path] = before;
    if (before !== now) edits.push(edit(file.path, before, now));
  }
  if (edits.length === 0) return [];

  const monorepo = isMonorepo(known);
  const rows = changeChecks({
    files,
    edits,
    render: null,
    browser: { state: "unsupported", reason: TESTS_HERE },
    // In a monorepo the packages beside this one are not in view: an import of one is not called missing.
    ...(monorepo ? { outsidePackages: importedPackages(head, { ...files, ...head }) } : {}),
  });
  return rows
    .filter((row) => row.id !== "preview")
    .map((row): CheckRow => {
      if (row.id === "types" && row.status === "pass")
        return { id: "types", label: "Types", status: "skip", detail: TYPES_HERE };
      if (row.id === "imports" && input.partial && row.status === "fail")
        return {
          id: "imports",
          label: "Imports resolve",
          status: "skip",
          detail:
            "Not judged: the change imports more files than this page looks for, so a missing one cannot be told apart.",
        };
      return row;
    });
}
