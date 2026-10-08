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
import { jsParserFor } from "../parser/lezer.ts";

/** Lezer's own types, through the parser already imported rather than a package not in package.json. */
type Tree = ReturnType<ReturnType<typeof jsParserFor>["parse"]>;
type SyntaxNode = Tree["topNode"];

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

const TS_EXT = /\.(m|c)?tsx?$/i;
/** `declare module "x" {`: an ambient module named by a string, with a body. */
const STRING_MODULE = /^(\s*(?:export\s+)?(?:declare\s+)?module\s+)((["'])[^"'\n]*\3)(?=\s*\{)/gm;
/** `declare module "*.svg";`: the same without one. */
const BARE_STRING_MODULE =
  /^(\s*(?:export\s+)?declare\s+module\s+)((["'])[^"'\n]*\3)(?=\s*;|[ \t]*$)/gm;
/** `typeof import("./main")`: a module's type, in a type position. */
const TYPEOF_IMPORT = /\b(typeof\s+)(import\s*\(\s*(["'])[^"'\n]*\3\s*\))/g;

/**
 * Lezer's TypeScript grammar takes only an identifier after `module`, and
 * always a body, so the ambient module declarations every `.d.ts` and module
 * augmentation use (`declare module "@tanstack/react-router" {`,
 * `declare module "*.svg";`) parse as errors; so does `typeof import("x")`.
 * Each is swapped for an identifier of the same length (and a bodiless module
 * gets `{}`), on the same line, so the lines reported stay exact and an error
 * anywhere else is still found.
 */
function withIdentifierNames(text: string): string {
  const name = (quoted: string) => "_".repeat(quoted.length);
  return text
    .replace(STRING_MODULE, (_all, head: string, quoted: string) => `${head}${name(quoted)}`)
    .replace(
      BARE_STRING_MODULE,
      (_all, head: string, quoted: string) => `${head}${name(quoted)} {}`,
    )
    .replace(TYPEOF_IMPORT, (_all, head: string, call: string) => `${head}${name(call)}`);
}

/**
 * In JSX children, braces holding nothing or only a comment are valid (an
 * empty expression, the usual way to write a comment in JSX), but Lezer's
 * grammar wants an expression there: it marks an error before the closing
 * brace, and its recovery can carry the error into the lines after. True for
 * an error node inside a JSXEscape with only whitespace or comments between
 * the opening brace and it, and the closing brace next.
 */
function isEmptyJsxExpression(text: string, node: SyntaxNode): SyntaxNode | null {
  const escape = node.parent;
  if (escape?.name !== "JSXEscape") return null;
  const inside = text.slice(escape.from + 1, node.from).replace(/\/\*[\s\S]*?\*\//g, "");
  return inside.trim() === "" && /^\s*\}/.test(text.slice(node.from)) ? escape : null;
}

/** At most this many empty JSX expressions are filled in, each with a parse. */
const MAX_EMPTY_JSX = 200;

/**
 * Parses `text`, filling each empty JSX expression with a `0` right after
 * its opening brace (found in the tree, so never an object literal) and
 * parsing again. No line break is added, so every line keeps its number.
 */
function parseFillingEmptyJsx(path: string, text: string): { tree: Tree; text: string } {
  const parser = jsParserFor(path);
  let source = text;
  for (let round = 0; ; round += 1) {
    const tree = parser.parse(source);
    if (round >= MAX_EMPTY_JSX) return { tree, text: source };
    let escape: SyntaxNode | null = null;
    const cursor = tree.cursor();
    do {
      if (cursor.type.isError) escape = isEmptyJsxExpression(source, cursor.node);
    } while (!escape && cursor.next());
    if (!escape) return { tree, text: source };
    source = `${source.slice(0, escape.from + 1)}0${source.slice(escape.from + 1)}`;
  }
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
  let parsed;
  try {
    parsed = parseFillingEmptyJsx(path, TS_EXT.test(path) ? withIdentifierNames(text) : text);
  } catch (error) {
    return [error instanceof Error ? error.message.slice(0, 160) : "parse error"];
  }
  const { tree } = parsed;
  // Positions are in the parsed text: the same lines, a few characters longer.
  const starts = lineStarts(parsed.text);
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
