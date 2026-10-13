/**
 * The id of one check run.
 *
 * Apply refuses a result whose id is not this, recomputed on the files as
 * they are now. The hash covers the staged text, the base it was written
 * against, the package.json scripts a hook or the tests would run, the
 * lockfile, `.aperture/hooks.json` as applied (a staged copy cannot switch
 * the hook off), and this verifier's version. Change any of those and the
 * id changes, so the checks run again before Apply.
 */
import { HOOKS_PATH, hookScriptBody, hooksFor, parseHooks } from "./hooks.ts";
import { mergeEdits } from "./preview-check.ts";
import { sha256 } from "./sha256.ts";
import type { ProposedEdit } from "./types.ts";

/** Bump when the checks themselves change, so an old green cannot be applied. */
export const VERIFIER_VERSION = "1";

const LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"] as const;

export type VerifyInput = {
  /** Where the checks ran. The editor is "browser". */
  runtime: string;
  files: Record<string, string>;
  edits: Array<Pick<ProposedEdit, "path" | "newText">>;
};

function canon(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canon(item)}`).join(",")}}`;
}

/** package.json scripts, in a stable order. A file that does not parse is marked, not skipped. */
export function scriptEntries(raw: string | undefined): Array<[string, string]> | { invalid: true } {
  if (!raw?.trim()) return [];
  try {
    const scripts = (JSON.parse(raw) as { scripts?: Record<string, unknown> }).scripts ?? {};
    return Object.keys(scripts)
      .filter((name) => typeof scripts[name] === "string")
      .sort()
      .map((name) => [name, String(scripts[name])]);
  } catch {
    return { invalid: true };
  }
}

/** Last edit per path wins, matching the check strip. */
function collapsed(edits: VerifyInput["edits"]): Array<Pick<ProposedEdit, "path" | "newText">> {
  const map = new Map<string, Pick<ProposedEdit, "path" | "newText">>();
  for (const edit of edits) map.set(edit.path, { path: edit.path, newText: edit.newText });
  return [...map.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** The bytes that go into the id. Exported so a test can see what moved. */
export function verificationMaterial(input: VerifyInput): string {
  const edits = collapsed(input.edits);
  const snapshot = mergeEdits(input.files, edits as ProposedEdit[]);
  const stage = hooksFor(
    parseHooks(input.files[HOOKS_PATH]).hooks,
    "stage",
    edits.map((edit) => edit.path),
  );
  return canon({
    version: VERIFIER_VERSION,
    runtime: input.runtime,
    staged: edits.map((edit) => [edit.path, edit.newText]),
    base: edits.map((edit) => [edit.path, input.files[edit.path] ?? ""]),
    scripts: scriptEntries(snapshot["package.json"]),
    locks: LOCKFILES.filter((path) => snapshot[path] !== undefined).map((path) => [path, snapshot[path]]),
    hooks: input.files[HOOKS_PATH] ?? "",
    hookScripts: stage.map((hook) => [hook.script, hookScriptBody(snapshot, hook.script) ?? ""]),
  });
}

export function verificationId(input: VerifyInput): string {
  return sha256(verificationMaterial(input));
}

/**
 * True when the checks on screen were computed for these files. A missing
 * stamp is not a match: Apply waits until a check has actually finished.
 */
export function checksMatch(
  stamped: string | undefined,
  files: Record<string, string>,
  edits: Array<Pick<ProposedEdit, "path" | "newText">>,
): boolean {
  return stamped !== undefined && stamped === verificationId({ runtime: "browser", files, edits });
}
