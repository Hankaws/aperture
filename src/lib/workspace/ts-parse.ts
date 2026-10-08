/**
 * Parse errors as TypeScript's own parser finds them, for wherever the
 * compiler is already loaded: the server, Agent Check, the bot, the tsc
 * worker. Lezer (syntax-check.ts) stays the fast first look everywhere; it
 * lags behind the language in places (arrow functions with a type predicate,
 * generic call signatures, …), so when it finds an error and TypeScript is at
 * hand, TypeScript has the last word.
 */
import type ts from "typescript";

type Ts = typeof ts;

/** A second opinion on a file the fast parser found errors in: its parse errors, or null for no opinion. */
export type ParseCheck = (path: string, text: string) => string[] | null;

const MAX_ISSUES = 4;

function scriptKind(t: Ts, path: string): ts.ScriptKind {
  if (/\.tsx$/i.test(path)) return t.ScriptKind.TSX;
  if (/\.(m|c)?ts$/i.test(path)) return t.ScriptKind.TS;
  if (/\.jsx$/i.test(path)) return t.ScriptKind.JSX;
  // Plain .js may hold JSX in a React project; TypeScript reads it as JSX only when told so.
  return /\.(m|c)?js$/i.test(path) ? t.ScriptKind.JSX : t.ScriptKind.Unknown;
}

/** Parse errors in Lezer's words, with TypeScript's message: one per line, at most a few. */
export function parseErrorLines(found: Array<{ line: number; message: string }>): string[] {
  const byLine = new Map<number, string>();
  for (const { line, message } of found) {
    if (!byLine.has(line))
      byLine.set(line, `parse error at line ${line}: ${message.slice(0, 160)}`);
  }
  const lines = [...byLine.keys()].sort((a, b) => a - b);
  const shown = lines.slice(0, MAX_ISSUES).map((line) => byLine.get(line)!);
  if (lines.length > MAX_ISSUES) shown.push(`+${lines.length - MAX_ISSUES} more parse errors`);
  return shown;
}

/** The syntax errors TypeScript's parser reports for `text`. */
export function tsParseIssues(t: Ts, path: string, text: string): string[] {
  const file = t.createSourceFile(path, text, t.ScriptTarget.Latest, false, scriptKind(t, path));
  // The parser's own diagnostics: what `program.getSyntacticDiagnostics` returns, without a program.
  const found = (file as unknown as { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] })
    .parseDiagnostics;
  return parseErrorLines(
    (found ?? []).map((diagnostic) => ({
      line: file.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
      message: t.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    })),
  );
}

/** TypeScript's parser as a `ParseCheck`, for scripts it reads. */
export function tsParseCheck(t: Ts): ParseCheck {
  return (path, text) => tsParseIssues(t, path, text);
}
