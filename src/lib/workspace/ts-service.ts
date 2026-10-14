/**
 * TypeScript's language service on the project held in memory: what the
 * editor asks while you work. Hovering a name shows its type and docs, F12 or
 * Ctrl/⌘+click jumps to where it is defined, F2 renames it everywhere,
 * typing gets completions that know the types, and the open file's type
 * errors are underlined as you type.
 *
 * It sees the project exactly as the "Types" check does: the same compiler
 * options (`compilerOptions`), standard library and shim for what packages
 * and bundlers provide. Like tsc-core, it imports neither the compiler nor
 * the library files, so it runs the same in the worker and in Node tests.
 */
import type ts from "typescript";
import { isTsPath, SHIM, SHIM_PATH, TSC_LIMITS, type TscLimits } from "./tsc-core.ts";

type Ts = typeof ts;

const LIB_DIR = "/__lib__/";

export type HoverInfo = {
  /** The declaration as TypeScript prints it: `function listTasks(page: number, pageSize: number): Task[]`. */
  signature: string;
  /** Its doc comment and tags, as plain text. Empty when it has none. */
  doc: string;
  /** The name the hover is about, as offsets in the file. */
  start: number;
  length: number;
};

export type DefinitionTarget = {
  path: string;
  /** 1-based, as the editor numbers lines. */
  line: number;
  /** 0-based column of the name in its line. */
  col: number;
  length: number;
};

export type DefinitionResult = {
  targets: DefinitionTarget[];
  /** Defined only outside the project: in the standard library or the shim for a package. */
  elsewhere: boolean;
};

export type CompletionEntry = {
  name: string;
  /** TypeScript's kind: "method", "property", "function", "class", "interface", "keyword"… */
  kind: string;
  /** TypeScript's own order: locals and members before globals. */
  sortText: string;
};

export type CompletionList = {
  entries: CompletionEntry[];
  /** After a dot: only the members of what is on its left. */
  member: boolean;
};

export type RenameLocation = {
  path: string;
  start: number;
  length: number;
  /** Shorthand properties and imports keep their meaning: `{ name }` becomes `{ name: next }`. */
  prefixText?: string;
  suffixText?: string;
};

export type RenameResult =
  { ok: true; name: string; locations: RenameLocation[] } | { ok: false; reason: string };

/** Edits to one file, as offsets into its current text. */
export type FileChange = {
  path: string;
  edits: Array<{ start: number; length: number; newText: string }>;
};

/** One of TypeScript's own fixes for a problem: "Add import from './store'" and the like. */
export type QuickFix = { description: string; changes: FileChange[] };

export type Problem = {
  start: number;
  length: number;
  /** TypeScript's message, with its chain of reasons on the lines below. */
  message: string;
  severity: "error" | "warning";
  /** TS2322 and the like, as tsc prints it. */
  code: string;
  /** TypeScript's fixes for it, when it has any. Only for the first problems in a file. */
  fixes?: QuickFix[];
};

/** Problems that get their fixes worked out; the rest are underlined without. */
export const MAX_FIXED_PROBLEMS = 20;

export type Reference = {
  path: string;
  start: number;
  length: number;
  /** 1-based, as the editor numbers lines. */
  line: number;
  /** 0-based column of the name in its line. */
  col: number;
  /** The whole line, trimmed, for the list. */
  text: string;
  /** Where the name is declared, rather than used. */
  definition: boolean;
};

export type ReferencesResult = { name: string; references: Reference[] };

/**
 * The files `changes` touch, with their new text: each file's edits applied
 * from the end, so earlier offsets still hold. Null when an edit no longer
 * fits its file (it changed since the fix was worked out).
 */
export function applyFileChanges(
  files: Record<string, string>,
  changes: FileChange[],
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const change of changes) {
    let text = out[change.path] ?? files[change.path];
    if (text === undefined) return null;
    for (const edit of [...change.edits].sort((a, b) => b.start - a.start)) {
      if (edit.start < 0 || edit.start + edit.length > text.length) return null;
      text = text.slice(0, edit.start) + edit.newText + text.slice(edit.start + edit.length);
    }
    out[change.path] = text;
  }
  return out;
}

/** The most problems marked in one file: past that the file needs a closer look, not more underlines. */
export const MAX_PROBLEMS = 200;

/** The most completions sent back for one question; the editor narrows them as you type. */
export const MAX_COMPLETIONS = 200;

export type TsService = {
  /** The project's files now. Unchanged files keep their parse. */
  update(
    files: Record<string, string>,
    libs: Map<string, string>,
    options: ts.CompilerOptions,
  ): void;
  hover(path: string, offset: number): HoverInfo | null;
  definition(path: string, offset: number): DefinitionResult;
  /** What can be typed at `offset`, narrowed to names that contain the word being typed. */
  completions(path: string, offset: number): CompletionList | null;
  /** Every place the name at `offset` is used in the project, when it can be renamed. */
  rename(path: string, offset: number): RenameResult;
  /** The file's syntax and type errors, as the "Types" check would report them, with fixes for the first ones. */
  problems(path: string): Problem[];
  /** Every place the name at `offset` is declared or used in the project. Null when it is not a name. */
  references(path: string, offset: number): ReferencesResult | null;
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Words a name cannot be: renaming to one would break the code. */
const RESERVED = new Set(
  (
    "break case catch class const continue debugger default delete do else enum export extends false finally for " +
    "function if import in instanceof new null return super switch this throw true try typeof var void while with " +
    "as implements interface let package private protected public static yield await"
  ).split(" "),
);

/** Why `next` cannot replace `name`, or null when it can. */
export function renameProblem(name: string, next: string): string | null {
  if (!next) return "Type a new name.";
  if (next === name) return "That is the name it has.";
  if (!IDENTIFIER.test(next))
    return `"${next}" is not a name: use letters, digits, _ or $, not starting with a digit.`;
  if (RESERVED.has(next)) return `"${next}" is a reserved word.`;
  return null;
}

/**
 * The files a rename changes, with their new text. Null when a file no longer
 * holds the name where the rename found it (it was edited since), so a stale
 * rename never writes into the wrong place.
 */
export function applyRename(
  files: Record<string, string>,
  name: string,
  locations: RenameLocation[],
  next: string,
): Record<string, string> | null {
  const byPath = new Map<string, RenameLocation[]>();
  for (const loc of locations) byPath.set(loc.path, [...(byPath.get(loc.path) ?? []), loc]);
  const out: Record<string, string> = {};
  for (const [path, locs] of byPath) {
    let text = files[path];
    if (text === undefined) return null;
    // From the end, so earlier offsets still hold.
    for (const loc of [...locs].sort((a, b) => b.start - a.start)) {
      if (text.slice(loc.start, loc.start + loc.length) !== name) return null;
      const replacement = `${loc.prefixText ?? ""}${next}${loc.suffixText ?? ""}`;
      text = text.slice(0, loc.start) + replacement + text.slice(loc.start + loc.length);
    }
    out[path] = text;
  }
  return out;
}

/** Why the service cannot answer for this project, or null when it can. */
export function serviceUnavailable(
  files: Record<string, string>,
  limits: TscLimits = TSC_LIMITS,
): string | null {
  const roots = Object.keys(files).filter(isTsPath);
  const bytes = roots.reduce((n, path) => n + (files[path]?.length ?? 0), 0);
  if (roots.length > limits.files || bytes > limits.bytes)
    return `Project too large for the compiler ${limits.where ?? "in the browser"} (${roots.length} files).`;
  return null;
}

/** Whether most of the project's relative imports name the file with its extension (`./store.ts`). */
export function importsKeepExtension(files: Record<string, string>): boolean {
  let withExt = 0;
  let without = 0;
  for (const [path, text] of Object.entries(files)) {
    if (!isTsPath(path)) continue;
    for (const match of text.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      if (/\.[cm]?[jt]sx?$/.test(match[1]!)) withExt++;
      else without++;
    }
  }
  return withExt > without;
}

export function createTsService(ts: Ts): TsService {
  /** Every file the service can read, by compiler path, with a version that moves when its text does. */
  const texts = new Map<string, { text: string; version: number }>();
  let roots: string[] = [];
  let options: ts.CompilerOptions = {};

  const put = (name: string, text: string) => {
    const known = texts.get(name);
    if (known?.text === text) return;
    texts.set(name, { text, version: (known?.version ?? 0) + 1 });
  };

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [...roots, SHIM_PATH],
    getScriptVersion: (name) => String(texts.get(name)?.version ?? 0),
    getScriptSnapshot: (name) => {
      const known = texts.get(name);
      return known ? ts.ScriptSnapshot.fromString(known.text) : undefined;
    },
    getCompilationSettings: () => options,
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: (opts) => `${LIB_DIR}${ts.getDefaultLibFileName(opts)}`,
    fileExists: (name) => texts.has(name),
    readFile: (name) => texts.get(name)?.text,
    directoryExists: () => true,
    getDirectories: () => [],
    useCaseSensitiveFileNames: () => true,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry(true, "/"));

  const inProject = (name: string) => name !== SHIM_PATH && !name.startsWith(LIB_DIR);

  const format: ts.FormatCodeSettings = {
    ...ts.getDefaultFormatCodeSettings("\n"),
    indentSize: 2,
    tabSize: 2,
    convertTabsToSpaces: true,
  };
  let preferences: ts.UserPreferences = {
    quotePreference: "auto",
    importModuleSpecifierPreference: "relative",
    importModuleSpecifierEnding: "auto",
  };

  function fixesFor(name: string, start: number, end: number, code: number): QuickFix[] {
    let found: readonly ts.CodeFixAction[];
    try {
      found = service.getCodeFixesAtPosition(name, start, end, [code], format, preferences);
    } catch {
      // A fix TypeScript cannot work out is no fix: the problem is still underlined.
      return [];
    }
    return (
      found
        // Only fixes that edit files already in the project: one that creates a file is left to the person.
        .filter((fix) =>
          fix.changes.every(
            (c) => !c.isNewFile && inProject(c.fileName) && c.fileName.startsWith("/"),
          ),
        )
        .slice(0, 3)
        .map((fix) => ({
          description: fix.description,
          changes: fix.changes.map((c) => ({
            path: c.fileName.slice(1),
            edits: c.textChanges.map((t) => ({
              start: t.span.start,
              length: t.span.length,
              newText: t.newText,
            })),
          })),
        }))
    );
  }

  return {
    update(files, libs, next) {
      options = next;
      put(SHIM_PATH, SHIM);
      for (const [name, text] of libs) put(`${LIB_DIR}${name}`, text);
      const live = new Set<string>();
      for (const [path, text] of Object.entries(files)) {
        const name = `/${path}`;
        live.add(name);
        put(name, text);
      }
      for (const name of [...texts.keys()])
        if (inProject(name) && !live.has(name)) texts.delete(name);
      roots = Object.keys(files)
        .filter(isTsPath)
        .map((path) => `/${path}`);
      // An added import is written the way the project writes them: `./store.ts` or `./store`.
      // "js" is TypeScript's name for keeping the extension, which is `.ts` here.
      preferences = {
        ...preferences,
        importModuleSpecifierEnding: importsKeepExtension(files) ? "js" : "auto",
      };
    },

    hover(path, offset) {
      const info = service.getQuickInfoAtPosition(`/${path}`, offset);
      if (!info) return null;
      const signature = ts.displayPartsToString(info.displayParts);
      if (!signature.trim()) return null;
      const tags = (info.tags ?? []).map((tag) => {
        const text = ts.displayPartsToString(tag.text).trim();
        return `@${tag.name}${text ? ` ${text}` : ""}`;
      });
      const doc = [ts.displayPartsToString(info.documentation).trim(), ...tags]
        .filter(Boolean)
        .join("\n");
      return { signature, doc, start: info.textSpan.start, length: info.textSpan.length };
    },

    definition(path, offset) {
      const found = service.getDefinitionAtPosition(`/${path}`, offset) ?? [];
      const program = service.getProgram();
      const targets: DefinitionTarget[] = [];
      for (const def of found) {
        if (!inProject(def.fileName)) continue;
        const file = program?.getSourceFile(def.fileName);
        if (!file) continue;
        const at = file.getLineAndCharacterOfPosition(def.textSpan.start);
        const target = {
          path: def.fileName.slice(1),
          line: at.line + 1,
          col: at.character,
          length: def.textSpan.length,
        };
        if (
          !targets.some(
            (t) => t.path === target.path && t.line === target.line && t.col === target.col,
          )
        )
          targets.push(target);
      }
      return { targets, elsewhere: targets.length === 0 && found.length > 0 };
    },

    completions(path, offset) {
      const name = `/${path}`;
      const text = texts.get(name)?.text ?? "";
      const found = service.getCompletionsAtPosition(name, offset, {
        includeCompletionsWithInsertText: false,
        includeCompletionsForModuleExports: false,
      });
      if (!found) return null;
      const typed = /[\w$]*$/.exec(text.slice(0, offset))?.[0].toLowerCase() ?? "";
      const entries = found.entries
        .filter((e) => !typed || e.name.toLowerCase().includes(typed))
        .sort((a, b) => a.sortText.localeCompare(b.sortText) || a.name.localeCompare(b.name))
        .slice(0, MAX_COMPLETIONS)
        .map((e) => ({ name: e.name, kind: e.kind, sortText: e.sortText }));
      return { entries, member: found.isMemberCompletion };
    },

    problems(path) {
      const name = `/${path}`;
      if (!texts.has(name)) return [];
      const found = [
        ...service.getSyntacticDiagnostics(name),
        ...service.getSemanticDiagnostics(name),
      ];
      return found
        .filter(
          (d) =>
            d.start !== undefined &&
            d.category !== ts.DiagnosticCategory.Suggestion &&
            d.category !== ts.DiagnosticCategory.Message,
        )
        .slice(0, MAX_PROBLEMS)
        .map((d, i) => ({
          start: d.start!,
          length: Math.max(1, d.length ?? 1),
          message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
          severity:
            d.category === ts.DiagnosticCategory.Warning
              ? ("warning" as const)
              : ("error" as const),
          code: `TS${d.code}`,
          ...(() => {
            if (i >= MAX_FIXED_PROBLEMS) return {};
            const fixes = fixesFor(name, d.start!, d.start! + (d.length ?? 0), d.code);
            return fixes.length ? { fixes } : {};
          })(),
        }));
    },

    references(path, offset) {
      const name = `/${path}`;
      const found = service.findReferences(name, offset);
      if (!found?.length) return null;
      const program = service.getProgram();
      // Where the name is declared, as go to definition finds it: past an import's alias, to the real one.
      const declared = new Set(
        (service.getDefinitionAtPosition(name, offset) ?? []).map(
          (d) => `${d.fileName}:${d.textSpan.start}`,
        ),
      );
      const seen = new Set<string>();
      const references: Reference[] = [];
      for (const symbol of found) {
        for (const ref of symbol.references) {
          if (!inProject(ref.fileName)) continue;
          const key = `${ref.fileName}:${ref.textSpan.start}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const file = program?.getSourceFile(ref.fileName);
          if (!file) continue;
          const at = file.getLineAndCharacterOfPosition(ref.textSpan.start);
          const lineStart = file.getPositionOfLineAndCharacter(at.line, 0);
          const lineEnd = file.getLineEndOfPosition(ref.textSpan.start);
          references.push({
            path: ref.fileName.slice(1),
            start: ref.textSpan.start,
            length: ref.textSpan.length,
            line: at.line + 1,
            col: at.character,
            text: file.text.slice(lineStart, lineEnd).trim().slice(0, 160),
            definition: declared.has(key),
          });
        }
      }
      references.sort((a, b) => a.path.localeCompare(b.path) || a.start - b.start);
      // Asked off a name (a keyword next to one), TypeScript can still answer for a nearby name: not here.
      const onName = references.some(
        (r) => r.path === path && r.start <= offset && offset <= r.start + r.length,
      );
      const first = references[0];
      if (!first || !onName) return null;
      const text = texts.get(`/${first.path}`)?.text ?? "";
      return { name: text.slice(first.start, first.start + first.length), references };
    },

    rename(path, offset) {
      let name = `/${path}`;
      let at = offset;
      // At an import, TypeScript renames only the local name (`import { a as b }`). Renaming
      // means everywhere, so start from where the name is declared, when that is in the project.
      const local = service.findRenameLocations(name, at, false, false, {
        providePrefixAndSuffixTextForRename: true,
      });
      if (
        local?.some(
          (loc) => / as $/.test(loc.prefixText ?? "") || /^ as /.test(loc.suffixText ?? ""),
        )
      ) {
        const def = service.getDefinitionAtPosition(name, at)?.find((d) => inProject(d.fileName));
        if (def) {
          name = def.fileName;
          at = def.textSpan.start;
        }
      }
      const info = service.getRenameInfo(name, at, { allowRenameOfImportPath: false });
      if (!info.canRename) return { ok: false, reason: info.localizedErrorMessage };
      const found =
        service.findRenameLocations(name, at, false, false, {
          providePrefixAndSuffixTextForRename: true,
        }) ?? [];
      if (found.some((loc) => !inProject(loc.fileName)))
        return {
          ok: false,
          reason: `${info.displayName} is defined outside this project, in TypeScript's standard library or a package.`,
        };
      const locations = found.map((loc) => ({
        path: loc.fileName.slice(1),
        start: loc.textSpan.start,
        length: loc.textSpan.length,
        ...(loc.prefixText ? { prefixText: loc.prefixText } : {}),
        ...(loc.suffixText ? { suffixText: loc.suffixText } : {}),
      }));
      return { ok: true, name: info.displayName, locations };
    },
  };
}
