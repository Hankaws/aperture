/**
 * TypeScript's answers for the agent: where a name is used and how to rename
 * it everywhere, from the same language service the editor asks for F2 and
 * Shift+F12. Text search finds `listTasks` in a comment and misses it
 * imported as `lt`; the compiler does neither.
 *
 * Hosts that have the compiler (the server, a runner) hand it over as a
 * `LanguageHost`; the rest leave the tools answering that they cannot.
 */
import type ts from "typescript";
import { movedTexts } from "../workspace/file-move.ts";
import { compilerOptions, isTsPath, TSC_LIMITS, type TscLimits } from "../workspace/tsc-core.ts";
import {
  applyRename,
  createTsService,
  renameProblem,
  serviceUnavailable,
  MAX_SYMBOLS,
  type Reference,
  type TsService,
} from "../workspace/ts-service.ts";

/** The compiler and its standard library, from wherever the host keeps them. */
export type LanguageHost = {
  ts: typeof ts;
  /** The library files `options` need. */
  libs: (options: ts.CompilerOptions) => Promise<Map<string, string>>;
  /** How large a project the host takes on, and where it runs, for the message past that. */
  limits?: TscLimits;
};

/** The service with the project as `files` holds it, or why it cannot answer. */
export type CodeIntel = (files: Record<string, string>) => Promise<TsService | string>;

/** One service for a run: each call brings it up to date, and unchanged files keep their parse. */
export function codeIntel(host: LanguageHost): CodeIntel {
  const service = createTsService(host.ts);
  return async (files) => {
    const reason = serviceUnavailable(files, host.limits ?? TSC_LIMITS);
    if (reason) return reason;
    const options = compilerOptions(host.ts, files);
    service.update(files, await host.libs(options), options);
    return service;
  };
}

/** The most references listed in one answer; the count still says how many there are. */
export const MAX_LISTED_REFERENCES = 40;

const escape = (name: string) => name.replace(/[$]/g, "\\$&");

/**
 * Where `name` could be asked about in `text`, best first: on `line` when
 * one is given, else its declarations, then every other whole-word match.
 * A match in a comment or string gets no answer, and the next one is tried.
 */
export function nameOffsets(text: string, name: string, line?: number): number[] {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return [];
  const word = new RegExp(`(?<![\\w$])${escape(name)}(?![\\w$])`, "g");
  let all = [...text.matchAll(word)].map((m) => m.index!);
  if (line !== undefined && Number.isFinite(line)) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
    const from = starts[line - 1];
    const to = starts[line] ?? text.length + 1;
    if (from !== undefined) {
      const onLine = all.filter((at) => at >= from && at < to);
      if (onLine.length) all = onLine;
    }
  }
  const declared = new RegExp(
    `(?:function\\*?|class|const|let|var|type|interface|enum|namespace)\\s+${escape(name)}(?![\\w$])`,
    "g",
  );
  const decls = new Set(
    [...text.matchAll(declared)].map((m) => m.index! + m[0].length - name.length),
  );
  return [...all.filter((at) => decls.has(at)), ...all.filter((at) => !decls.has(at))].slice(0, 25);
}

function notTs(path: string): string {
  return `${path} is not a TypeScript file. These answers come from the TypeScript compiler; use grep for other files.`;
}

/** The references to `name` as asked from `path`, or null when the compiler knows no such name there. */
export function referencesTo(
  service: TsService,
  files: Record<string, string>,
  path: string,
  name: string,
  line?: number,
): Reference[] | null {
  const text = files[path];
  if (text === undefined) return null;
  for (const at of nameOffsets(text, name, line)) {
    // The service answers only when `at` is on a reference, so a match in a comment gets null.
    const found = service.references(path, at);
    if (found) return found.references;
  }
  return null;
}

/** `find_references`'s answer: every place, by file and line, the declaration marked. */
export function referencesAnswer(
  service: TsService,
  files: Record<string, string>,
  path: string,
  name: string,
  line?: number,
): string {
  if (files[path] === undefined) return `File not found: ${path}`;
  if (!isTsPath(path)) return notTs(path);
  const refs = referencesTo(service, files, path, name, line);
  if (!refs)
    return `TypeScript finds no name ${name} in ${path}. Check the spelling, or pass the line it is on.`;
  const fileCount = new Set(refs.map((r) => r.path)).size;
  const head = `${name}: ${refs.length} ${refs.length === 1 ? "place" : "places"} in ${fileCount} ${fileCount === 1 ? "file" : "files"}, from the TypeScript compiler (imports under another name count; comments and strings do not).`;
  // One row per line: `import { listTasks as lt }` holds two references on one line.
  const byLine = new Map<string, string>();
  for (const r of refs) {
    const key = `${r.path}:${r.line}`;
    if (!byLine.has(key) || r.definition)
      byLine.set(key, `${key}${r.definition ? " (declared)" : ""}: ${r.text}`);
  }
  const lines = [...byLine.values()];
  const rows = lines.slice(0, MAX_LISTED_REFERENCES);
  const more =
    lines.length > MAX_LISTED_REFERENCES
      ? [`… and ${lines.length - MAX_LISTED_REFERENCES} more lines`]
      : [];
  return [head, ...rows, ...more].join("\n");
}

/** The most declarations listed in one `find_symbol` answer. */
export const MAX_LISTED_SYMBOLS = 30;

/**
 * `find_symbol`'s answer: the project's declarations whose names fit `query`,
 * as `file:line: kind Container.name`, best match first.
 */
export function symbolsAnswer(service: TsService, query: string): string {
  const q = query.trim();
  if (!q) return "find_symbol needs a name, or part of one.";
  const hits = service.symbols(q);
  if (!hits.length)
    return `TypeScript finds no declaration named like ${q} in the project. Try part of the name, or grep.`;
  const many = hits.length >= MAX_SYMBOLS ? `${hits.length}+` : String(hits.length);
  const head = `${many} ${hits.length === 1 ? "declaration" : "declarations"} named like ${q}, from the TypeScript compiler (the project's own files):`;
  const rows = hits
    .slice(0, MAX_LISTED_SYMBOLS)
    .map((h) => `${h.path}:${h.line}: ${h.kind} ${h.container ? `${h.container}.` : ""}${h.name}`);
  const more = hits.length > MAX_LISTED_SYMBOLS ? [`… and more; narrow the name to see them`] : [];
  return [head, ...rows, ...more].join("\n");
}

export type RenamePlan =
  | { ok: true; name: string; changed: Record<string, string>; places: number }
  | { ok: false; reason: string };

/** The files a rename of `name` (as asked from `path`) to `next` changes, with their new text. */
export function planRename(
  service: TsService,
  files: Record<string, string>,
  path: string,
  name: string,
  next: string,
  line?: number,
): RenamePlan {
  const text = files[path];
  if (text === undefined) return { ok: false, reason: `File not found: ${path}` };
  if (!isTsPath(path)) return { ok: false, reason: notTs(path) };
  const problem = renameProblem(name, next);
  if (problem) return { ok: false, reason: problem };
  let refused = "";
  for (const at of nameOffsets(text, name, line)) {
    const found = service.rename(path, at);
    if (!found.ok) {
      refused ||= found.reason;
      continue;
    }
    if (found.name !== name) continue;
    const changed = applyRename(files, name, found.locations, next);
    if (!changed) return { ok: false, reason: `${name} moved while renaming. Try again.` };
    return { ok: true, name, changed, places: found.locations.length };
  }
  return {
    ok: false,
    reason: refused
      ? `TypeScript cannot rename ${name}: ${refused}`
      : `TypeScript finds no name ${name} in ${path}. Check the spelling, or pass the line it is on.`,
  };
}

export type MovePlan =
  { ok: true; changed: Record<string, string> } | { ok: false; reason: string };

/**
 * What moving `from` to `to` writes, by the paths after the move: the moved
 * file under `to` with its own relative imports fixed, and every file that
 * imported it, as the file tree's Rename does (`movedTexts`).
 */
export function planMove(
  service: TsService,
  files: Record<string, string>,
  from: string,
  to: string,
): MovePlan {
  if (files[from] === undefined) return { ok: false, reason: `File not found: ${from}` };
  if (!isTsPath(from)) return { ok: false, reason: notTs(from) };
  const changes = service.fileRenameEdits(from, to);
  if (!changes) return { ok: false, reason: `TypeScript cannot work out the imports of ${from}.` };
  const changed = movedTexts(files, from, to, changes);
  if (!changed) return { ok: false, reason: `${from} changed while moving. Try again.` };
  // TypeScript lists the moved file only when its own imports change.
  return { ok: true, changed: { [to]: files[from]!, ...changed } };
}

/** Files checked for a name that is gone: past that, the recap says nothing rather than hold the run up. */
const MAX_GONE_FILES = 8;

/**
 * Where code outside `skip` depends on `name`, changed in `path`, as `file:line`:
 * - `uses`: the name is still in `path`, and these are its references elsewhere;
 * - `broken`: the name is gone from `path`, and these lines now have an error
 *   naming it (a stale import, a call to it). The same word in unrelated code
 *   is neither.
 * Null when the compiler cannot say, and the caller falls back to text.
 */
export type Elsewhere = { uses: string[] } | { broken: string[] };

export function usedElsewhere(
  service: TsService,
  files: Record<string, string>,
  path: string,
  name: string,
  skip: Set<string>,
): Elsewhere | null {
  if (!isTsPath(path) || files[path] === undefined) return null;
  const refs = referencesTo(service, files, path, name);
  if (refs) {
    const uses = refs
      .filter((r) => !skip.has(r.path) && !r.definition)
      .map((r) => `${r.path}:${r.line}`);
    return { uses: [...new Set(uses)] };
  }
  const word = new RegExp(`(?<![\\w$])${escape(name)}(?![\\w$])`);
  const quoted = `'${name}'`;
  const mentioning = Object.keys(files).filter(
    (other) => !skip.has(other) && isTsPath(other) && word.test(files[other]!),
  );
  if (mentioning.length > MAX_GONE_FILES) return null;
  const broken: string[] = [];
  for (const other of mentioning) {
    const text = files[other]!;
    for (const problem of service.problems(other)) {
      if (problem.severity !== "error" || !problem.message.includes(quoted)) continue;
      broken.push(`${other}:${text.slice(0, problem.start).split("\n").length}`);
    }
  }
  return { broken: [...new Set(broken)] };
}

/** What the agent asks the compiler about the project, as the files sent with the question hold it. */
export type CodeQuestion =
  | { kind: "references"; path: string; name: string; line?: number }
  | { kind: "rename"; path: string; name: string; next: string; line?: number }
  | { kind: "elsewhere"; names: Array<{ path: string; name: string }>; skip: string[] }
  | { kind: "symbols"; query: string }
  | { kind: "move"; from: string; to: string };

type Answers = {
  references: string;
  rename: RenamePlan;
  elsewhere: Array<Elsewhere | null>;
  symbols: string;
  move: MovePlan;
};
export type AnswerTo<Q extends CodeQuestion> = Answers[Q["kind"]];
export type CodeAnswer<Q extends CodeQuestion> = { answer: AnswerTo<Q> } | { unavailable: string };

/**
 * Asks the compiler, wherever it runs: in this process (the server, a runner)
 * or in the tab's worker, for a run on a model on the person's own machine.
 */
export type CodeAsk = <Q extends CodeQuestion>(
  files: Record<string, string>,
  question: Q,
) => Promise<CodeAnswer<Q>>;

/** The answer to `question` from a service holding `files`. */
export function answerCode<Q extends CodeQuestion>(
  service: TsService,
  files: Record<string, string>,
  question: Q,
): AnswerTo<Q> {
  const q: CodeQuestion = question;
  if (q.kind === "references")
    return referencesAnswer(service, files, q.path, q.name, q.line) as AnswerTo<Q>;
  if (q.kind === "rename")
    return planRename(service, files, q.path, q.name, q.next, q.line) as AnswerTo<Q>;
  if (q.kind === "symbols") return symbolsAnswer(service, q.query) as AnswerTo<Q>;
  if (q.kind === "move") return planMove(service, files, q.from, q.to) as AnswerTo<Q>;
  const skip = new Set(q.skip);
  return q.names.map(({ path, name }) => {
    try {
      return usedElsewhere(service, files, path, name, skip);
    } catch {
      return null;
    }
  }) as AnswerTo<Q>;
}

/** `CodeAsk` with the compiler in this process, loaded on the first question. */
export function askInProcess(load: () => Promise<LanguageHost>): CodeAsk {
  let loading: Promise<CodeIntel | null> | undefined;
  return async (files, question) => {
    loading ??= load().then(codeIntel, () => null);
    const intel = await loading;
    if (!intel) return { unavailable: "TypeScript could not load here." };
    try {
      const service = await intel(files);
      if (typeof service === "string") return { unavailable: service };
      return { answer: answerCode(service, files, question) };
    } catch {
      return { unavailable: "TypeScript could not read this project." };
    }
  };
}
