/**
 * The bot's suggestions as GitHub task-list boxes. A reply lists what it would
 * do next as `- [ ] task`; ticking one edits the comment, and that edit is the
 * ask (`event.ts`). Only a box whose text is one of the suggestions the
 * reply's hidden summary carries counts, so editing the visible text cannot
 * change what runs. Once a run starts, the line is marked, so ticking it again
 * does not start a second one. Pure, for tests.
 */

const BOX = /^(\s*[-*] )\[( |x|X)\] (.*)$/;

/** The task-list lines of a comment: their text, and whether each is ticked. */
function boxes(body: string): Array<{ text: string; ticked: boolean }> {
  const out: Array<{ text: string; ticked: boolean }> = [];
  for (const line of body.split("\n")) {
    const match = BOX.exec(line.replace(/\r$/, ""));
    if (match) out.push({ text: match[3]!.trim(), ticked: match[2] !== " " });
  }
  return out;
}

/**
 * The suggestion an edit ticked: a box with one of `next`'s texts that is
 * ticked now and was not before. Null when the edit ticked none, or more than
 * one at once (a pasted body, not a click).
 */
export function tickedTask(before: string, after: string, next: string[]): string | null {
  const wanted = new Set(next.map((task) => task.trim()));
  const was = new Map(boxes(before).map((box) => [box.text, box.ticked]));
  const now = boxes(after).filter(
    (box) => box.ticked && wanted.has(box.text) && was.get(box.text) === false,
  );
  return now.length === 1 ? now[0]!.text : null;
}

/** The line as it reads once its run has started: ticked, who asked, and the run. */
export function startedLine(task: string, by: string, run: string): string {
  return `- [x] ${task} · started by @${by}, [the run](${run})`;
}

/**
 * The reply with the ticked suggestion marked started, or null when the line
 * is not there as an open-or-ticked box (someone edited it since).
 */
export function markStarted(body: string, task: string, by: string, run: string): string | null {
  const lines = body.split("\n");
  const at = lines.findIndex((line) => {
    const match = BOX.exec(line.replace(/\r$/, ""));
    return match !== null && match[3]!.trim() === task;
  });
  if (at < 0) return null;
  lines[at] = startedLine(task, by, run);
  return lines.join("\n");
}

/** Suggestions as boxes to tick. */
export function suggestionBoxes(next: string[]): string[] {
  return next.map((task) => `- [ ] ${task}`);
}
