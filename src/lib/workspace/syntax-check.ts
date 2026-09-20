/**
 * Parse-level checks for the files the HTML/CSS preview cannot run.
 *
 * `preview-check.ts` catches broken markup and real runtime errors from the
 * preview iframe, but only for `.html`/`.css`. Everything else — the bulk of a
 * real project — reached the user unverified. A parse is not a type check, but
 * it catches the edit that could never have run: an unbalanced brace, a JSX tag
 * that never closes, a truncated import.
 *
 * Lezer is already in the tree (CodeMirror's JS language support) and is a pure
 * ES module, so the same checker runs in the agent loop on the server and in
 * the store on the client.
 */
import { parser as jsParser } from "@lezer/javascript";

/** Beyond this a parse stops being worth the latency on every staged edit. */
const MAX_PARSE_CHARS = 400_000;
const MAX_ISSUES = 4;

const SCRIPT_EXT = /\.(m|c)?(j|t)sx?$/i;
const JSON_EXT = /\.jsonc?$/i;

export function isScriptPath(path: string): boolean {
  return SCRIPT_EXT.test(path);
}

export function isJsonPath(path: string): boolean {
  return JSON_EXT.test(path);
}

/** Lezer dialects, keyed so each configured parser is built once. */
const parsers = new Map<string, ReturnType<typeof jsParser.configure>>();

function dialectFor(path: string): string {
  const ts = /\.(m|c)?tsx?$/i.test(path);
  const jsx = /x$/i.test(path);
  return [ts ? "ts" : "", jsx ? "jsx" : ""].filter(Boolean).join(" ");
}

function parserFor(path: string) {
  const dialect = dialectFor(path);
  let cached = parsers.get(dialect);
  if (!cached) {
    cached = jsParser.configure(dialect ? { dialect } : {});
    parsers.set(dialect, cached);
  }
  return cached;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineAt(starts: number[], pos: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Parse errors, one per line at most.
 *
 * Lezer recovers and carries on, so a single mistake often yields a run of
 * adjacent error nodes; reporting each one would bury the real cause.
 */
export function scriptIssues(path: string, text: string): string[] {
  if (!text.trim()) return [];
  if (text.length > MAX_PARSE_CHARS) return [];
  let tree;
  try {
    tree = parserFor(path).parse(text);
  } catch (error) {
    return [error instanceof Error ? error.message.slice(0, 160) : "parse error"];
  }
  const starts = lineStarts(text);
  const lines = new Set<number>();
  const cursor = tree.cursor();
  do {
    if (cursor.type.isError) lines.add(lineAt(starts, cursor.from));
  } while (cursor.next());
  if (lines.size === 0) return [];
  const sorted = [...lines].sort((a, b) => a - b);
  const shown = sorted.slice(0, MAX_ISSUES).map((line) => `parse error at line ${line}`);
  if (sorted.length > MAX_ISSUES) shown.push(`+${sorted.length - MAX_ISSUES} more parse errors`);
  return shown;
}

/**
 * Strip comments and trailing commas, leaving string contents untouched.
 *
 * `tsconfig.json` and friends are JSONC in practice, so a bare `JSON.parse`
 * would report every commented config as broken. A scanner rather than a regex
 * because `"http://example.com"` must not lose half its value.
 */
export function stripJsonc(text: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  // A trailing comma before `}` or `]` is legal in JSONC and in tsconfig.
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function jsonIssues(text: string): string[] {
  if (!text.trim()) return [];
  try {
    JSON.parse(text);
    return [];
  } catch {
    // Fall through: the document may simply be JSONC.
  }
  try {
    JSON.parse(stripJsonc(text));
    return [];
  } catch (error) {
    const raw = error instanceof Error ? error.message : "invalid JSON";
    return [raw.replace(/\s+/g, " ").slice(0, 160)];
  }
}
