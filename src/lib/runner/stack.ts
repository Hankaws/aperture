/**
 * Runtime evidence for a fix: where a failure happened, in the project's own
 * files, with the code around it.
 *
 * A test run executes one bundle (bundle.ts), so a stack line names a line of
 * the bundle; `ModuleLines` turns it back into a file and a line (sucrase keeps
 * line numbers). The page check runs one document with the scripts inlined
 * (design-mode.ts), so there a stack line names a line of the document, read
 * back through the `data-from` tag each inlined script carries.
 *
 * Pure: tests import it directly.
 */
import type { ModuleLines } from "./bundle.ts";

/** One failure as the runner reports it. */
export type FailureDetail = { name: string; message: string; stack: string };

export type Frame = { path: string; line: number; column: number; fn: string | null };

/** Room for evidence in one fix prompt: enough for a stack and the code around it. */
export const EVIDENCE_LIMIT = 3000;

/** `at fn (where:12:5)`, `at where:12:5` (V8) and `fn@where:12:5` (Firefox, Safari). */
const FRAME = /^\s*(?:at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?|(.*?)@(.*?):(\d+):(\d+))\s*$/;

type RawFrame = { where: string; line: number; column: number; fn: string | null };

function rawFrames(stack: string): RawFrame[] {
  const out: RawFrame[] = [];
  for (const text of stack.split("\n")) {
    const match = FRAME.exec(text);
    if (!match) continue;
    const fn = (match[1] ?? match[5] ?? "").replace(/^async /, "").trim() || null;
    out.push({
      fn,
      where: match[2] ?? match[6] ?? "",
      line: Number(match[3] ?? match[7]),
      column: Number(match[4] ?? match[8]),
    });
  }
  return out;
}

/**
 * The stack's frames in project files, innermost first. `offset` is how many
 * lines ran before the bundle (the worker's prelude); frames in the runner
 * itself are left out.
 */
export function mapStack(stack: string, modules: ModuleLines, offset = 0): Frame[] {
  const frames: Frame[] = [];
  for (const raw of rawFrames(stack)) {
    const line = raw.line - offset;
    const module = modules.find((m) => line >= m.start && line < m.start + m.count);
    if (!module) continue;
    // A module's top level runs in a function named after its path: no name worth showing.
    const fn =
      raw.fn && raw.fn !== module.path && !raw.fn.startsWith("Object.<anonymous>") ? raw.fn : null;
    frames.push({ path: module.path, line: line - module.start + 1, column: raw.column, fn });
  }
  return frames;
}

/**
 * A line of the page check's document, as the script file and line it came
 * from. Null outside an inlined script: the document's own lines are shifted by
 * what the editor inserts, so they name no line of the page file.
 */
export function mapDocLine(doc: string, line: number): { path: string; line: number } | null {
  const lines = doc.split("\n");
  // An inlined script's own code starts on the line after its tag; its closing tag starts a line of its own.
  if (/^\s*<\/script>/i.test(lines[line - 1] ?? "")) return null;
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
    const text = lines[i]!;
    const tag = /<script\b[^>]*\bdata-from="([^"]+)"[^>]*>\s*$/i.exec(text);
    if (tag) return i === line - 1 ? null : { path: tag[1]!, line: line - (i + 1) };
    if (/<\/script>/i.test(text) && i < line - 1) return null;
  }
  return null;
}

/** The page check's frames, in script files. Frames elsewhere (the page's own inline code, the browser) are left out. */
export function mapDocStack(stack: string, doc: string): Frame[] {
  const frames: Frame[] = [];
  for (const raw of rawFrames(stack)) {
    if (!/srcdoc/.test(raw.where)) continue;
    const at = mapDocLine(doc, raw.line);
    if (at) frames.push({ ...at, column: raw.column, fn: raw.fn });
  }
  return frames;
}

/** A script error the page check caught: the message, the stack, and the document line it reported. */
export type PageError = { message: string; stack?: string; line?: number };

/** The page check's errors, in script files where it can say, the document's own lines where it cannot. */
export function pageErrorEvidence(
  errors: PageError[],
  doc: string,
  files: Record<string, string>,
): string {
  const parts: string[] = [];
  let used = 0;
  for (const error of errors.slice(0, 4)) {
    let frames = mapDocStack(error.stack ?? "", doc);
    if (frames.length === 0 && error.line) {
      const at = mapDocLine(doc, error.line);
      if (at) frames = [{ ...at, column: 0, fn: null }];
    }
    const part =
      frames.length > 0
        ? describeFailure("", error.message, frames, files)
        : block([
            error.message,
            error.line
              ? `In the page's own script, as rendered:\n${excerpt(doc, error.line)}`
              : null,
          ]);
    if (used + part.length > EVIDENCE_LIMIT && parts.length > 0) break;
    parts.push(part.slice(0, EVIDENCE_LIMIT));
    used += part.length;
  }
  return parts.join("\n\n");
}

export function formatFrame(frame: Frame): string {
  return `at ${frame.path}:${frame.line}:${frame.column}${frame.fn ? ` (${frame.fn})` : ""}`;
}

/** The lines around `line`, numbered, the line itself marked. */
export function excerpt(text: string, line: number, around = 2): string {
  const lines = text.split("\n");
  if (line < 1 || line > lines.length) return "";
  const from = Math.max(1, line - around);
  const to = Math.min(lines.length, line + around);
  const width = String(to).length;
  const out: string[] = [];
  for (let n = from; n <= to; n++) {
    out.push(`${n === line ? ">" : " "} ${String(n).padStart(width)} | ${lines[n - 1]}`);
  }
  return out.join("\n");
}

const TEST_FILE = /(^|\/)(__tests__|tests?)\/|[._-](test|spec)\.[cm]?[jt]sx?$/;

/**
 * The code to show for a failure: where it happened, and, when that is a test
 * file, the first frame in the code under test, which is usually the cause.
 */
function excerptFrames(frames: Frame[]): Frame[] {
  const first = frames[0];
  if (!first) return [];
  const source = frames.find((frame) => !TEST_FILE.test(frame.path));
  return source && source !== first ? [first, source] : [first];
}

function block(lines: Array<string | null | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/** One failure: its message, its frames in project files, and the code where it broke. */
export function describeFailure(
  name: string,
  message: string,
  frames: Frame[],
  files: Record<string, string>,
): string {
  const shown = frames.slice(0, 6).map((frame) => `  ${formatFrame(frame)}`);
  const code = excerptFrames(frames)
    .map((frame) => {
      const text = files[frame.path];
      const lines = text === undefined ? "" : excerpt(text, frame.line);
      return lines ? `${frame.path}:\n${lines}` : null;
    })
    .filter(Boolean);
  return block([name ? `✖ ${name}` : null, message.trim(), shown.join("\n") || null, ...code]);
}

/** Every failure a run reported, within the evidence limit. */
export function failureEvidence(
  details: FailureDetail[] | undefined,
  modules: ModuleLines,
  offset: number,
  files: Record<string, string>,
): string {
  const parts: string[] = [];
  let used = 0;
  for (const detail of details ?? []) {
    const part = describeFailure(
      detail.name,
      detail.message,
      mapStack(detail.stack, modules, offset),
      files,
    );
    if (used + part.length > EVIDENCE_LIMIT && parts.length > 0) break;
    parts.push(part.slice(0, EVIDENCE_LIMIT));
    used += part.length;
  }
  return parts.join("\n\n");
}
