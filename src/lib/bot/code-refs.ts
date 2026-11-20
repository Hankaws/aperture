/**
 * The places in the code an answer names, such as `src/store.ts:32`, so the
 * editor can turn each into a link to that line. Pure, for tests: the bot
 * names them (`editor-context.ts` asks it to cite path:line), and the editor
 * says which are in the project.
 */

/** A file, and the lines named in it, if any. */
export type CodeRef = { path: string; line: number | null; endLine: number | null };

/**
 * A path with an extension, then optionally `:line` or `:line-line`. Not
 * in a URL or a longer word: what comes before it is neither a word
 * character nor a slash.
 */
const REF =
  /(?<![\w/.@-])((?:[\w@.-]+\/)*[\w@-][\w@.-]*\.[A-Za-z][A-Za-z0-9]{0,5})(?::(\d{1,6})(?:\s?[-–]\s?(\d{1,6}))?)?(?![\w/])/g;

/** Text, cut into what stays text and the places in the code it names. */
export function splitRefs(text: string): Array<string | (CodeRef & { raw: string })> {
  const out: Array<string | (CodeRef & { raw: string })> = [];
  let at = 0;
  for (const match of text.matchAll(REF)) {
    const [raw, path, from, to] = match;
    const start = match.index ?? 0;
    // A sentence's full stop is not part of the name: "see store.ts." stays "store.ts".
    const trimmed = path!.replace(/\.+$/, "");
    if (!/\.[A-Za-z][A-Za-z0-9]{0,5}$/.test(trimmed)) continue;
    const line = from ? Number(from) : null;
    const endLine = to && line !== null && Number(to) > line ? Number(to) : null;
    if (start > at) out.push(text.slice(at, start));
    const shown = trimmed === path ? raw! : trimmed;
    out.push({ path: trimmed, line: line && line > 0 ? line : null, endLine, raw: shown });
    at = start + shown.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** How a link to a place reads to a screen reader. */
export function refLabel(ref: CodeRef): string {
  if (ref.line === null) return `Open ${ref.path}`;
  return ref.endLine
    ? `Open ${ref.path} at lines ${ref.line} to ${ref.endLine}`
    : `Open ${ref.path} at line ${ref.line}`;
}
