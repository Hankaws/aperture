/**
 * Guards that keep an agent turn productive, after DeepSeek Harness's `guard`
 * and `spill` families. Pure, for tests; the loop (`loop.ts`) wires them in.
 *
 * - **Repeats.** A model that calls the same read with the same arguments,
 *   nothing having changed since, is stuck. It gets the same answer back
 *   without the work being done again, with a reminder to change approach
 *   or finish; from the third time, the reminder is firmer.
 * - **Time limits.** A read or a question to a connected server that hangs
 *   comes back as a clear "took too long" instead of holding the whole turn.
 * - **Long output.** A run's log or a server's answer longer than the model
 *   is shown is kept whole for the turn. The model sees its start and end
 *   and can read any part back with `read_output`, by lines or by search,
 *   instead of the middle being lost.
 */

/** Tools whose answer depends only on their arguments and the staged edits: a repeat is answered from the first call. */
const CACHED = new Set([
  "read_file",
  "grep",
  "list_dir",
  "semantic_search",
  "find_symbol",
  "find_references",
  "run_script",
  "read_output",
  "web_fetch",
]);

/** Arguments as one stable string: the same call in another key order is the same call. */
export function stableArgs(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableArgs).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableArgs((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** What the model is told on a repeat, the count being how many times it has made this call. */
export function repeatReminder(name: string, count: number): string {
  return count >= 3
    ? `This is call ${count} of ${name} with the same arguments, and nothing has changed. Stop repeating it: change approach, or finish with what you have.`
    : `You already called ${name} with these arguments, and nothing has changed since, so here is the same answer again. Use it, try something different, or finish.`;
}

const PREVIOUS_CHARS = 2_000;

/**
 * Remembers each call of a turn, by tool, arguments and the staged edits at
 * the time (`state`): a read after an edit is a new read.
 */
export class RepeatGuard {
  private seen = new Map<string, { count: number; result: string }>();

  private key(name: string, args: Record<string, unknown>, state: string): string {
    return `${state}\u0000${name}\u0000${stableArgs(args)}`;
  }

  /**
   * The answer to give instead of running the call again, or null to run it.
   * A tool with effects (an edit, a server call) always runs.
   */
  before(name: string, args: Record<string, unknown>, state: string): string | null {
    if (!CACHED.has(name)) return null;
    const hit = this.seen.get(this.key(name, args, state));
    if (!hit) return null;
    hit.count += 1;
    const previous =
      hit.result.length > PREVIOUS_CHARS
        ? `${hit.result.slice(0, PREVIOUS_CHARS)}\n… (cut here; it is the same as before)`
        : hit.result;
    return `${repeatReminder(name, hit.count)}\n\n${previous}`;
  }

  /** Records a call that ran; for one with effects, a repeat gets the reminder after its answer. */
  after(name: string, args: Record<string, unknown>, state: string, result: string): string {
    const key = this.key(name, args, state);
    const hit = this.seen.get(key);
    if (hit) {
      hit.count += 1;
      return `${result}\n\n${repeatReminder(name, hit.count)}`;
    }
    this.seen.set(key, { count: 1, result });
    return result;
  }
}

/** Tools that only read, given a time limit of their own: one that hangs must not hold the turn. */
const TIMED = new Set([
  "read_file",
  "grep",
  "list_dir",
  "semantic_search",
  "find_symbol",
  "find_references",
  "mcp_call",
  "read_output",
  "web_fetch",
]);
export const TOOL_TIMEOUT_MS = 90_000;

/** The tool's answer, or a clear "took too long" once `ms` have passed. */
export async function withTimeLimit(
  name: string,
  work: Promise<string>,
  ms = TOOL_TIMEOUT_MS,
): Promise<string> {
  if (!TIMED.has(name)) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<string>((resolve) => {
    timer = setTimeout(
      () =>
        resolve(
          `${name} took longer than ${Math.round(ms / 1000)} s and was stopped. Try a narrower call, or go on without it.`,
        ),
      ms,
    );
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Kept whole up to this many characters each, and this many in a turn. */
export const KEEP_MAX_CHARS = 200_000;
export const MAX_KEPT = 8;
/** Shown of a long answer: its start, then its end, where a failure says why. */
export const SHOW_CHARS = 6_000;
const HEAD_CHARS = 1_500;
const READ_CHARS = 8_000;
const MAX_MATCHES = 60;

/** The long outputs of one turn, numbered from 1. */
export class OutputStore {
  private items: string[] = [];

  /** Its number, or null when the turn has kept as many as it may. */
  keep(text: string): number | null {
    if (this.items.length >= MAX_KEPT) return null;
    this.items.push(text.slice(0, KEEP_MAX_CHARS));
    return this.items.length;
  }

  get(id: number): string | undefined {
    return Number.isInteger(id) && id >= 1 ? this.items[id - 1] : undefined;
  }
}

const lineCount = (text: string) => text.split("\n").length;

/** Tells the model where the whole of a long output is, and how to read it. */
export function keptNote(id: number, text: string): string {
  return `The whole output is kept as output ${id} (${lineCount(text)} lines). Read any part with read_output({ "id": ${id}, "startLine": 1, "endLine": 80 }), or search it with read_output({ "id": ${id}, "grep": "error" }).`;
}

/**
 * A long answer as the model sees it: its start and its end, with the whole
 * kept in `store`. Short ones, or once the turn has kept all it may, as they are
 * (cut to the end, which is where a failure says why).
 */
export function spillLong(store: OutputStore | undefined, text: string): string {
  if (text.length <= SHOW_CHARS) return text;
  const id = store?.keep(text) ?? null;
  const tail = SHOW_CHARS - HEAD_CHARS;
  const left = text.length - HEAD_CHARS - tail;
  if (id === null)
    return `… ${text.length - SHOW_CHARS} earlier characters omitted …\n${text.slice(-SHOW_CHARS)}`;
  return `${text.slice(0, HEAD_CHARS)}\n… ${left} characters left out here …\n${text.slice(-tail)}\n\n${keptNote(id, text)}`;
}

/** A kept output's lines, by range or by search, numbered as in the whole. */
export function readOutput(store: OutputStore | undefined, args: Record<string, unknown>): string {
  const id = Number(args.id);
  const text = store?.get(id);
  if (text === undefined) return `No output ${String(args.id ?? "")} was kept in this turn.`;
  const lines = text.split("\n");
  const number = (i: number) => `${String(i + 1).padStart(5, " ")} ${lines[i]}`;
  const grep = typeof args.grep === "string" ? args.grep.trim() : "";
  if (grep) {
    const needle = grep.toLowerCase();
    const hits: string[] = [];
    let total = 0;
    lines.forEach((line, i) => {
      if (!line.toLowerCase().includes(needle)) return;
      total += 1;
      if (hits.length < MAX_MATCHES) hits.push(number(i));
    });
    if (total === 0) return `No line of output ${id} contains "${grep}".`;
    const more =
      total > hits.length
        ? `\n… ${total - hits.length} more lines match; search for something narrower.`
        : "";
    return `${total} ${total === 1 ? "line" : "lines"} of output ${id} ${total === 1 ? "contains" : "contain"} "${grep}":\n${hits.join("\n")}${more}`;
  }
  const start = Math.max(1, Math.floor(Number(args.startLine ?? 1)) || 1);
  const end = Math.min(
    lines.length,
    Math.floor(Number(args.endLine ?? start + 79)) || lines.length,
  );
  if (start > lines.length) return `Output ${id} has ${lines.length} lines.`;
  const out: string[] = [];
  let size = 0;
  let last = start - 1;
  for (let i = start - 1; i < end; i++) {
    const line = number(i);
    if (size + line.length > READ_CHARS && out.length > 0) break;
    out.push(line);
    size += line.length + 1;
    last = i + 1;
  }
  const more = last < end ? `\n… cut here; read on with "startLine": ${last + 1}` : "";
  return `Output ${id}, lines ${start}–${last} of ${lines.length}:\n${out.join("\n")}${more}`;
}
