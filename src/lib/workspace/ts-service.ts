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
import {
  isTsPath,
  missingPackageTypes,
  SHIM,
  SHIM_PATH,
  TSC_LIMITS,
  type TscLimits,
} from "./tsc-core.ts";

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

/** One problem in the Problems panel: where it is, by line, and what TypeScript says. */
/** One of TypeScript's refactors that applies at a selection: "Extract to constant in enclosing scope". */
export type RefactorAction = { refactor: string; action: string; description: string };

/** What a refactor writes: edits to existing files, new files whole, and where its new name is. */
export type RefactorEdit = {
  changes: FileChange[];
  /** Files it creates ("Move to a new file"), with their text. */
  created: Record<string, string>;
  /** The name it made up ("newFunction"), as an offset in that file's new text, to rename at once. */
  rename?: { path: string; offset: number };
};

/** The call around the cursor: what it takes, and which argument is being typed. */
export type SignatureHelp = {
  /** Before the parameters: `listTasks(`. */
  prefix: string;
  params: Array<{ label: string; doc: string }>;
  /** Between parameters: `, `. */
  separator: string;
  /** After them: `): Task[]`. */
  suffix: string;
  /** The function's own doc comment and tags. */
  doc: string;
  /** The parameter the cursor is on; past the last for a rest parameter, the last. -1 when there are none. */
  active: number;
  /** Which overload this is, and how many there are. */
  overload: number;
  overloads: number;
  /** Where the arguments start, to place the tip. */
  start: number;
};

export type ProjectProblem = {
  start: number;
  length: number;
  /** 1-based, as the editor numbers lines. */
  line: number;
  /** 0-based column in its line. */
  col: number;
  message: string;
  severity: "error" | "warning";
  code: string;
};

/** A declaration in the project whose name matches a search: for "Go to symbol" (`#` in Ctrl/⌘+P). */
export type SymbolHit = {
  name: string;
  /** TypeScript's kind: "function", "class", "interface", "type", "const", "method", … */
  kind: string;
  /** What it is declared in, such as the class of a method; empty at the top of a file. */
  container: string;
  path: string;
  /** 1-based, as the editor numbers lines. */
  line: number;
  /** 0-based column in its line. */
  col: number;
  length: number;
};

/** The most symbols one search lists. */
export const MAX_SYMBOLS = 50;

/** One of TypeScript's "fix all" actions for a file: "Add all missing imports", applying to `count` problems. */
export type FixAllAction = { fixId: string; description: string; count: number };

export type ProjectProblems = {
  /**
   * Files with problems, in path order; each file's problems in the order they
   * appear, and the fix-all actions that apply to two or more of them.
   */
  files: Array<{ path: string; problems: ProjectProblem[]; fixAll?: FixAllAction[] }>;
  errors: number;
  warnings: number;
  /** Past `MAX_PROJECT_PROBLEMS`, the counts are whole but the list stops. */
  truncated: boolean;
};

/** The most problems listed for the whole project; the counts go on past it. */
export const MAX_PROJECT_PROBLEMS = 500;

/** The most fix lookups one Problems answer makes, to find what "Fix all" can do: each costs a type check of a spot. */
export const MAX_FIX_ALL_LOOKUPS = 40;

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
  /** Every file's syntax and type errors, as the "Types" check would report them, without fixes. */
  projectProblems(): ProjectProblems;
  /** The call the cursor is in, with the argument being typed. Null outside a call. */
  signatureHelp(path: string, offset: number): SignatureHelp | null;
  /** The edits that remove the file's unused imports and sort the rest; none when they already are. */
  organizeImports(path: string): FileChange[];
  /** Declarations in the project's own files whose names match `query`, best match first. */
  symbols(query: string): SymbolHit[];
  /** Every fix of one kind in the file at once (a `FixAllAction`'s `fixId`); null when TypeScript cannot. */
  fixAllEdits(path: string, fixId: string): FileChange[] | null;
  /**
   * The edits that keep the project's imports working once `from` is `to`: in
   * the files that import it, and in its own relative imports. Null when
   * TypeScript cannot work them out.
   */
  fileRenameEdits(from: string, to: string): FileChange[] | null;
  /** The refactors TypeScript offers for `start`–`end` (a cursor when equal). */
  refactors(path: string, start: number, end: number): RefactorAction[];
  /** What one of them writes; null when it no longer applies there. */
  refactorEdits(
    path: string,
    start: number,
    end: number,
    refactor: string,
    action: string,
  ): RefactorEdit | null;
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

  /** Refactors may write a new file ("Move to a new file"), which TypeScript offers only when told it can. */
  const refactorPreferences = (): ts.UserPreferences => ({
    ...preferences,
    allowTextChangesInNewFiles: true,
  });

  /**
   * A file's syntax and type errors (and warnings), as the "Types" check reports
   * them: not the ones that only say a package's types are not installed here.
   */
  function diagnosticsOf(name: string): ts.Diagnostic[] {
    return [
      ...service.getSyntacticDiagnostics(name),
      ...service.getSemanticDiagnostics(name),
    ].filter(
      (d) =>
        d.start !== undefined &&
        d.category !== ts.DiagnosticCategory.Suggestion &&
        d.category !== ts.DiagnosticCategory.Message &&
        !missingPackageTypes(d, ts.flattenDiagnosticMessageText(d.messageText, " ")),
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
      return diagnosticsOf(name)
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

    signatureHelp(path, offset) {
      const name = `/${path}`;
      if (!texts.has(name)) return null;
      const found = service.getSignatureHelpItems(name, offset, undefined);
      if (!found || found.items.length === 0) return null;
      const index = Math.min(Math.max(found.selectedItemIndex, 0), found.items.length - 1);
      const item = found.items[index]!;
      const text = (parts: ts.SymbolDisplayPart[] | undefined) =>
        parts ? ts.displayPartsToString(parts) : "";
      const params = item.parameters.map((p) => ({
        label: text(p.displayParts),
        doc: text(p.documentation).trim(),
      }));
      const tags = (item.tags ?? [])
        .filter((tag) => tag.name !== "param")
        .map((tag) => `@${tag.name}${tag.text ? ` ${text(tag.text)}` : ""}`);
      const active =
        params.length === 0
          ? -1
          : item.isVariadic
            ? Math.min(found.argumentIndex, params.length - 1)
            : found.argumentIndex;
      return {
        prefix: text(item.prefixDisplayParts),
        params,
        separator: text(item.separatorDisplayParts),
        suffix: text(item.suffixDisplayParts),
        doc: [text(item.documentation).trim(), ...tags].filter(Boolean).join("\n"),
        active: active < params.length ? active : -1,
        overload: index + 1,
        overloads: found.items.length,
        start: found.applicableSpan.start,
      };
    },

    organizeImports(path) {
      const name = `/${path}`;
      if (!texts.has(name)) return [];
      const changes: FileChange[] = [];
      for (const change of service.organizeImports(
        { type: "file", fileName: name },
        format,
        preferences,
      )) {
        if (!inProject(change.fileName)) continue;
        const file = change.fileName.slice(1);
        const edits = change.textChanges.map((t) => ({
          start: t.span.start,
          length: t.span.length,
          newText: t.newText,
        }));
        // TypeScript rewrites the import block even when nothing in it moves: no change, no edits.
        const text = texts.get(change.fileName)?.text ?? "";
        const after = applyFileChanges({ [file]: text }, [{ path: file, edits }])?.[file];
        if (after !== undefined && after !== text) changes.push({ path: file, edits });
      }
      return changes;
    },

    symbols(query) {
      const q = query.trim();
      if (!q) return [];
      let found: readonly ts.NavigateToItem[];
      try {
        found = service.getNavigateToItems(q, MAX_SYMBOLS * 2, undefined, true);
      } catch {
        return [];
      }
      const program = service.getProgram();
      const hits: SymbolHit[] = [];
      for (const item of found) {
        if (!inProject(item.fileName) || !texts.has(item.fileName)) continue;
        const file = program?.getSourceFile(item.fileName);
        if (!file) continue;
        const at = file.getLineAndCharacterOfPosition(item.textSpan.start);
        hits.push({
          name: item.name,
          kind: item.kind,
          container: item.containerName,
          path: item.fileName.slice(1),
          line: at.line + 1,
          col: at.character,
          length: item.textSpan.length,
        });
        if (hits.length >= MAX_SYMBOLS) break;
      }
      return hits;
    },

    fixAllEdits(path, fixId) {
      const name = `/${path}`;
      if (!texts.has(name)) return null;
      let found: ts.CombinedCodeActions;
      try {
        found = service.getCombinedCodeFix(
          { type: "file", fileName: name },
          fixId,
          format,
          preferences,
        );
      } catch {
        return null;
      }
      // Only edits to files already in the project: one that makes a file is left to the person.
      if (
        found.changes.some((c) => c.isNewFile || !inProject(c.fileName) || !texts.has(c.fileName))
      )
        return null;
      const changes = found.changes
        .map((c) => ({
          path: c.fileName.slice(1),
          edits: c.textChanges.map((t) => ({
            start: t.span.start,
            length: t.span.length,
            newText: t.newText,
          })),
        }))
        .filter((c) => c.edits.length > 0);
      return changes.length ? changes : null;
    },

    fileRenameEdits(from, to) {
      const name = `/${from}`;
      if (!texts.has(name)) return null;
      let found: readonly ts.FileTextChanges[];
      try {
        found = service.getEditsForFileRename(name, `/${to}`, format, preferences);
      } catch {
        return null;
      }
      return found
        .filter((change) => inProject(change.fileName) && texts.has(change.fileName))
        .map((change) => ({
          path: change.fileName.slice(1),
          edits: change.textChanges.map((t) => ({
            start: t.span.start,
            length: t.span.length,
            newText: t.newText,
          })),
        }))
        .filter((change) => change.edits.length > 0);
    },

    refactors(path, start, end) {
      const name = `/${path}`;
      if (!texts.has(name)) return [];
      const range = start === end ? start : { pos: start, end };
      let found: readonly ts.ApplicableRefactorInfo[] = [];
      try {
        found = service.getApplicableRefactors(
          name,
          range,
          refactorPreferences(),
          "invoked",
          undefined,
          false,
        );
      } catch {
        return [];
      }
      return found.flatMap((info) =>
        info.actions
          .filter((action) => !action.notApplicableReason)
          .map((action) => ({
            refactor: info.name,
            action: action.name,
            description: action.description,
          })),
      );
    },

    refactorEdits(path, start, end, refactor, action) {
      const name = `/${path}`;
      if (!texts.has(name)) return null;
      const range = start === end ? start : { pos: start, end };
      let found: ts.RefactorEditInfo | undefined;
      try {
        // TypeScript asserts rather than answers when an action does not apply where it is asked.
        found = service.getEditsForRefactor(
          name,
          format,
          range,
          refactor,
          action,
          refactorPreferences(),
        );
      } catch {
        return null;
      }
      if (!found) return null;
      const changes: FileChange[] = [];
      const created: Record<string, string> = {};
      for (const change of found.edits) {
        if (!change.isNewFile && !inProject(change.fileName)) return null;
        const edits = change.textChanges.map((t) => ({
          start: t.span.start,
          length: t.span.length,
          newText: t.newText,
        }));
        const file = change.fileName.slice(1);
        if (change.isNewFile) {
          created[file] = applyFileChanges({ [file]: "" }, [{ path: file, edits }])?.[file] ?? "";
        } else changes.push({ path: file, edits });
      }
      const renamed = found.renameFilename?.slice(1);
      return {
        changes,
        created,
        ...(renamed && found.renameLocation !== undefined
          ? { rename: { path: renamed, offset: found.renameLocation } }
          : {}),
      };
    },

    projectProblems() {
      const program = service.getProgram();
      const out: ProjectProblems = { files: [], errors: 0, warnings: 0, truncated: false };
      let listed = 0;
      let lookups = 0;
      const fixable = new Set(ts.getSupportedCodeFixes());
      for (const name of [...roots].sort()) {
        const found = diagnosticsOf(name);
        if (found.length === 0) continue;
        const file = program?.getSourceFile(name);
        const problems: ProjectProblem[] = [];
        for (const d of found) {
          const severity = d.category === ts.DiagnosticCategory.Warning ? "warning" : "error";
          if (severity === "error") out.errors += 1;
          else out.warnings += 1;
          if (listed >= MAX_PROJECT_PROBLEMS || !file) {
            out.truncated ||= listed >= MAX_PROJECT_PROBLEMS;
            continue;
          }
          listed += 1;
          const at = file.getLineAndCharacterOfPosition(d.start!);
          problems.push({
            start: d.start!,
            length: Math.max(1, d.length ?? 1),
            line: at.line + 1,
            col: at.character,
            message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
            severity,
            code: `TS${d.code}`,
          });
        }
        if (problems.length === 0) continue;
        // What "Fix all" can do here: asked once per kind of problem that turns up twice or more.
        const byCode = new Map<string, ProjectProblem[]>();
        for (const p of problems) byCode.set(p.code, [...(byCode.get(p.code) ?? []), p]);
        const actions = new Map<string, FixAllAction>();
        for (const [code, same] of byCode) {
          const number = Number(code.slice(2));
          if (same.length < 2 || !fixable.has(String(number)) || lookups >= MAX_FIX_ALL_LOOKUPS)
            continue;
          lookups += 1;
          const first = same[0]!;
          let found: readonly ts.CodeFixAction[] = [];
          try {
            found = service.getCodeFixesAtPosition(
              name,
              first.start,
              first.start + first.length,
              [number],
              format,
              preferences,
            );
          } catch {
            continue;
          }
          for (const fix of found) {
            if (!fix.fixId || !fix.fixAllDescription) continue;
            const id = String(fix.fixId);
            const known = actions.get(id);
            actions.set(id, {
              fixId: id,
              description: fix.fixAllDescription,
              count: (known?.count ?? 0) + same.length,
            });
          }
        }
        out.files.push({
          path: name.slice(1),
          problems,
          ...(actions.size ? { fixAll: [...actions.values()] } : {}),
        });
      }
      return out;
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
