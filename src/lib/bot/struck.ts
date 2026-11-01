/**
 * Ideas the maintainer turned down, kept where the bot can read them: on the
 * bot's own reply. Dismissing an idea on the Bot page strikes its box out,
 * `- ~~idea~~ · dismissed`; restoring it puts the box back. The reply's
 * hidden list is untouched, so its signature (`seal.ts`) still holds, and a
 * struck idea can no longer be ticked, since it has no box. The next daily
 * brief is told not to suggest these again (`look.ts`), and the Ideas inbox
 * leaves them out on every device. Pure and import-free: the bot and the
 * browser both read it.
 */

const BOX = /^(\s*[-*] )\[( |x|X)\] (.*)$/;
const STRUCK = /^(\s*[-*] )~~(.+?)~~ · dismissed$/;
const flat = (text: string) => text.replace(/\s+/g, " ").trim();

/** The ideas of `next` that a reply's body shows struck out. */
export function struckIdeas(body: string, next: string[]): string[] {
  const struck = new Set<string>();
  for (const line of body.split("\n")) {
    const match = STRUCK.exec(line.replace(/\r$/, ""));
    if (match) struck.add(flat(match[2]!));
  }
  return next.filter((task) => struck.has(flat(task)));
}

/**
 * The body with the idea's open box struck out, or null when it has no open
 * box for it (already struck, started, or edited away). A started idea is
 * not dismissed: its work is under way.
 */
export function strikeIdea(body: string, task: string): string | null {
  const lines = body.split("\n");
  const at = lines.findIndex((line) => {
    const match = BOX.exec(line.replace(/\r$/, ""));
    return match !== null && match[2] === " " && flat(match[3]!) === flat(task);
  });
  if (at < 0) return null;
  const match = BOX.exec(lines[at]!.replace(/\r$/, ""))!;
  lines[at] = `${match[1]}~~${match[3]!.trim()}~~ · dismissed`;
  return lines.join("\n");
}

/** The body with a struck idea's box back, open to tick; null when it is not struck. */
export function unstrikeIdea(body: string, task: string): string | null {
  const lines = body.split("\n");
  const at = lines.findIndex((line) => {
    const match = STRUCK.exec(line.replace(/\r$/, ""));
    return match !== null && flat(match[2]!) === flat(task);
  });
  if (at < 0) return null;
  const match = STRUCK.exec(lines[at]!.replace(/\r$/, ""))!;
  lines[at] = `${match[1]}[ ] ${match[2]}`;
  return lines.join("\n");
}
