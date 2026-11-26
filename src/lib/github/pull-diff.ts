/**
 * A pull request's unified diff (GitHub's `.diff`), read into files and
 * hunks, and the text each file had before the change, rebuilt by applying
 * its hunks in reverse to the text after. Reading the diff and the files
 * after the change needs nothing from GitHub's API, whose allowance for a
 * server with no token runs out in minutes.
 *
 * Pure: the check page's server function fetches, this reads.
 */

export type DiffStatus = "added" | "removed" | "modified" | "renamed";

export type Hunk = {
  /** First line of the hunk in the file after the change (1-based); for an empty side, the line before it. */
  newStart: number;
  newCount: number;
  /** Each line with its mark: " " kept, "+" added, "-" removed, "\\" no newline at end of file. */
  lines: string[];
};

export type DiffFile = {
  path: string;
  /** The path before a rename. */
  previousPath?: string;
  status: DiffStatus;
  /** Git said "Binary files differ": there is no text to read. */
  binary: boolean;
  hunks: Hunk[];
};

function unquote(path: string): string {
  if (!path.startsWith('"')) return path;
  return path
    .slice(1, -1)
    .replace(/\\(["\\])/g, "$1")
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n");
}

function side(raw: string, prefix: "a/" | "b/"): string | null {
  const path = unquote(raw.trim());
  if (path === "/dev/null") return null;
  return path.startsWith(prefix) ? path.slice(2) : path;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: Hunk | null = null;
  let from: string | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      // `diff --git a/x b/x`: when the names have no spaces, the halves are equal; later lines say better.
      const names = /^diff --git (?:"?a\/)(.+?)"? (?:"?b\/)(.+?)"?$/.exec(line);
      file = { path: names?.[2] ?? "", status: "modified", binary: false, hunks: [] };
      files.push(file);
      hunk = null;
      from = names?.[1] ?? null;
      continue;
    }
    if (!file) continue;
    if (hunk) {
      const mark = line[0];
      if (mark === " " || mark === "+" || mark === "-" || mark === "\\") {
        hunk.lines.push(line);
        continue;
      }
      hunk = null;
    }
    const header = HUNK.exec(line);
    if (header) {
      hunk = {
        newStart: Number(header[1]),
        newCount: header[2] === undefined ? 1 : Number(header[2]),
        lines: [],
      };
      file.hunks.push(hunk);
    } else if (line.startsWith("new file mode")) file.status = "added";
    else if (line.startsWith("deleted file mode")) file.status = "removed";
    else if (line.startsWith("rename from ")) {
      file.status = "renamed";
      file.previousPath = unquote(line.slice("rename from ".length));
    } else if (line.startsWith("rename to ")) file.path = unquote(line.slice("rename to ".length));
    else if (line.startsWith("Binary files ") || line === "GIT binary patch") file.binary = true;
    else if (line.startsWith("--- ")) from = side(line.slice(4), "a/") ?? from;
    else if (line.startsWith("+++ ")) {
      const to = side(line.slice(4), "b/");
      if (to) file.path = to;
      else if (from) file.path = from;
    }
  }
  return files.filter((f) => f.path !== "");
}

function splitText(text: string): { lines: string[]; newline: boolean } {
  if (text === "") return { lines: [], newline: false };
  const newline = text.endsWith("\n");
  const lines = (newline ? text.slice(0, -1) : text).split("\n");
  return { lines, newline };
}

function joinText(lines: string[], newline: boolean): string {
  if (lines.length === 0) return "";
  return `${lines.join("\n")}${newline ? "\n" : ""}`;
}

/** Whether the old side of the file had a final newline, from where git wrote "\ No newline at end of file". */
function oldNewline(hunks: Hunk[], fallback: boolean): boolean {
  let newline = fallback;
  for (const hunk of hunks) {
    hunk.lines.forEach((line, i) => {
      if (line[0] !== "\\" || i === 0) return;
      const before = hunk.lines[i - 1]![0];
      if (before === "-" || before === " ") newline = false;
      else if (before === "+" && fallback === false) newline = true;
    });
  }
  return newline;
}

/**
 * The file's text before the change, from its text after and the hunks
 * between them. Null when the hunks do not fit the text (it moved on since
 * the diff was made), so nothing is judged from a wrong guess.
 */
export function reverseApply(after: string, hunks: Hunk[]): string | null {
  const { lines: head, newline } = splitText(after);
  const out: string[] = [];
  let at = 0;
  for (const hunk of hunks) {
    const start = hunk.newCount === 0 ? hunk.newStart : hunk.newStart - 1;
    if (start < at || start > head.length) return null;
    while (at < start) out.push(head[at++]!);
    for (const line of hunk.lines) {
      const mark = line[0];
      const rest = line.slice(1);
      if (mark === " ") {
        if (head[at] !== rest) return null;
        out.push(rest);
        at += 1;
      } else if (mark === "+") {
        if (head[at] !== rest) return null;
        at += 1;
      } else if (mark === "-") out.push(rest);
    }
  }
  while (at < head.length) out.push(head[at++]!);
  return joinText(out, oldNewline(hunks, newline));
}

/** An added file's text, which the diff holds in full. */
export function addedText(hunks: Hunk[]): string {
  const lines = hunks.flatMap((hunk) =>
    hunk.lines.filter((line) => line[0] === "+").map((line) => line.slice(1)),
  );
  const noNewline = hunks.some((hunk) =>
    hunk.lines.some((line, i) => line[0] === "\\" && hunk.lines[i - 1]?.[0] === "+"),
  );
  return joinText(lines, !noNewline);
}

/** A removed file's text, which the diff holds in full. */
export function removedText(hunks: Hunk[]): string {
  const lines = hunks.flatMap((hunk) =>
    hunk.lines.filter((line) => line[0] === "-").map((line) => line.slice(1)),
  );
  const noNewline = hunks.some((hunk) =>
    hunk.lines.some((line, i) => line[0] === "\\" && hunk.lines[i - 1]?.[0] === "-"),
  );
  return joinText(lines, !noNewline);
}
