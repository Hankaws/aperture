/**
 * TypeScript's language service on the project held in memory: what the
 * editor asks while you work. Hovering a name shows its type and docs, and
 * F12 or Ctrl/⌘+click jumps to where it is defined.
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

export type TsService = {
  /** The project's files now. Unchanged files keep their parse. */
  update(
    files: Record<string, string>,
    libs: Map<string, string>,
    options: ts.CompilerOptions,
  ): void;
  hover(path: string, offset: number): HoverInfo | null;
  definition(path: string, offset: number): DefinitionResult;
};

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
  };
}
