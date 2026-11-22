import type { ProposedEdit } from "@/lib/workspace/types";

/**
 * A unified diff (`git diff`, `diff -u`, or an agent's patch) as staged
 * full-file edits against the files as they are now.
 *
 * Files are told apart by their `--- ` / `+++ ` header pair, so a patch
 * with several files works with or without `diff --git` lines between them.
 * Each hunk is read by the line counts in its `@@` header, so a removed
 * line that starts with `-- ` (a SQL comment, a Markdown rule) is not taken
 * for the next file's header. Later hunks in a file are placed by how much
 * the earlier ones moved it. A new file keeps its last newline unless the
 * patch says `\ No newline at end of file`; `+++ /dev/null` deletes a file.
 *
 * Pure: tests import it directly.
 */

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/** `a/src/x.ts\t2024-01-01 …` → `src/x.ts`; `/dev/null` stays as it is. */
function headerPath(raw: string): string {
  const path = raw
    .split("\t")[0]!
    .trim()
    .replace(/^"(.*)"$/, "$1");
  if (path === "/dev/null") return path;
  return path.replace(/^[ab]\//, "");
}

type Hunk = { oldStart: number; remove: string[]; add: string[]; noNewlineAtEnd: boolean };
type FilePatch = { oldPath: string; newPath: string; hunks: Hunk[] };

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** The files in a diff, each with its hunks, read by their line counts. */
export function parseFilePatches(diff: string): FilePatch[] | { error: string } {
  const lines = diff.replace(/\r\n/g, "\n").split("\n");
  const files: FilePatch[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!(line.startsWith("--- ") && lines[i + 1]?.startsWith("+++ "))) {
      i += 1;
      continue;
    }
    const file: FilePatch = {
      oldPath: headerPath(line.slice(4)),
      newPath: headerPath(lines[i + 1]!.slice(4)),
      hunks: [],
    };
    i += 2;
    while (i < lines.length && lines[i]!.startsWith("@@ ")) {
      const header = HUNK_HEADER.exec(lines[i]!);
      if (!header) return { error: `A hunk header in ${file.newPath} could not be read.` };
      const oldCount = header[2] === undefined ? 1 : Number(header[2]);
      const newCount = header[4] === undefined ? 1 : Number(header[4]);
      const hunk: Hunk = {
        oldStart: Number(header[1]),
        remove: [],
        add: [],
        noNewlineAtEnd: false,
      };
      i += 1;
      let seenOld = 0;
      let seenNew = 0;
      while (i < lines.length && (seenOld < oldCount || seenNew < newCount)) {
        const body = lines[i]!;
        const mark = body[0];
        if (mark === "\\") {
          i += 1;
          continue;
        }
        if (mark === "-") {
          hunk.remove.push(body.slice(1));
          seenOld += 1;
        } else if (mark === "+") {
          hunk.add.push(body.slice(1));
          seenNew += 1;
        } else if (mark === " " || body === "") {
          // A blank context line often loses its leading space on the way through an editor or a chat.
          const text = body === "" ? "" : body.slice(1);
          hunk.remove.push(text);
          hunk.add.push(text);
          seenOld += 1;
          seenNew += 1;
        } else {
          return { error: `A hunk in ${file.newPath} ends early: it says more lines than it has.` };
        }
        i += 1;
      }
      if (seenOld < oldCount || seenNew < newCount)
        return { error: `A hunk in ${file.newPath} ends early: it says more lines than it has.` };
      // The marker after the last added line: the new text has no final newline.
      if (lines[i]?.startsWith("\\")) {
        hunk.noNewlineAtEnd = hunk.add.length > 0 && lines[i - 1]?.startsWith("+") === true;
        i += 1;
      }
      file.hunks.push(hunk);
    }
    files.push(file);
  }
  return files;
}

function applyHunk(
  lines: string[],
  start: number,
  remove: string[],
  add: string[],
): string[] | null {
  const idx = Math.max(0, start);
  const slice = lines.slice(idx, idx + remove.length);
  if (
    remove.length === 0 ||
    (slice.length === remove.length && slice.every((line, i) => line === remove[i]))
  ) {
    return [...lines.slice(0, idx), ...add, ...lines.slice(idx + remove.length)];
  }
  // The file moved since the diff was made: find the same lines anywhere, once.
  for (let at = 0; at + remove.length <= lines.length; at += 1) {
    if (remove.every((line, i) => lines[at + i] === line)) {
      return [...lines.slice(0, at), ...add, ...lines.slice(at + remove.length)];
    }
  }
  return null;
}

/** Turn a unified diff into staged full-file edits against the current workspace. */
export function parseUnifiedDiff(
  diff: string,
  files: Record<string, string>,
): ProposedEdit[] | { error: string } {
  if (!diff.trim()) return { error: "Paste a unified diff first." };
  const patches = parseFilePatches(diff);
  if ("error" in patches) return patches;

  const edits: ProposedEdit[] = [];
  for (const patch of patches) {
    const deleting = patch.newPath === "/dev/null";
    const path = deleting ? patch.oldPath : patch.newPath;
    if (!path || path === "/dev/null") continue;
    if (path.split("/").includes("..") || path.startsWith("/")) {
      return { error: `${path} is outside the project.` };
    }
    const existed = files[path] !== undefined;
    const oldText = existed ? files[path]! : "";
    if (deleting) {
      if (!existed) return { error: `${path} cannot be deleted: it is not in the project.` };
      edits.push({
        id: `patch_${edits.length + 1}_${path}`,
        path,
        oldText,
        newText: "",
        description: `Delete ${path}`,
        status: "pending",
        deleted: true,
      });
      continue;
    }
    if (patch.hunks.length === 0) continue;
    // "" is one empty line: a new file's text ends in a newline, as files usually do.
    let current = splitLines(oldText);
    let shift = 0;
    let noNewline = false;
    for (const hunk of patch.hunks) {
      const next = applyHunk(current, hunk.oldStart - 1 + shift, hunk.remove, hunk.add);
      if (!next) return { error: `Could not apply a hunk in ${path}. The file may have changed.` };
      shift += hunk.add.length - hunk.remove.length;
      current = next;
      noNewline = hunk.noNewlineAtEnd;
    }
    if (noNewline && current.at(-1) === "") current = current.slice(0, -1);
    const newText = current.join("\n");
    if (newText === oldText) continue;
    edits.push({
      id: `patch_${edits.length + 1}_${path}`,
      path,
      oldText,
      newText,
      description: existed ? `Patch ${path}` : `Create ${path}`,
      status: "pending",
    });
  }

  if (edits.length === 0) return { error: "No file edits found in that diff." };
  return edits;
}
