/**
 * The replay model: recorded Composer runs, played back without calling any
 * model API.
 *
 * It exists so the whole product (plan, staged diffs, checks, verify, apply)
 * runs with no key: for building features, for end-to-end tests in CI, for
 * open-source contributors on day one, and for demos that cost nothing.
 *
 * Each tape is a recorded task on the demo workspace (harbor-api). The engine
 * never counts steps: it looks at which tool calls this turn has already made
 * and what they returned, and does the next thing (read, plan, edit, answer).
 * That keeps it correct when the loop inserts messages of its own, such as the
 * "call set_plan" nudge or a failed verify run.
 *
 * It must never claim more than happened. After staging a fix it calls
 * run_script("test") as a model checking its work would. When the tab runs it
 * in the browser, the output comes back as the next turn and the answer
 * repeats what the run said, pass or fail. Otherwise the loop's own verify
 * step reports the result. A failed check can play one recorded second try
 * that is still wrong, and then stops. It never invents a fix that passes.
 *
 * Pure: tests import it directly.
 */
import { CONTINUATION_PREFIX, parseContinuation } from "./browser-handoff.ts";

/** Structural twins of the loop's message types (the real ones live in a server-only module). */
export type ReplayMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

export type ReplayCompletion = {
  content: string;
  tool_calls?: NonNullable<ReplayMessage["tool_calls"]>;
};

type Call = { name: string; args: Record<string, unknown> };

type Edit = { path: string; search: string; replace: string; description: string };

export type Tape = {
  id: string;
  /** How a person would ask for it; also what the fallback suggests. */
  title: string;
  match: RegExp;
  reads: Call[];
  plan: string[];
  planText: string;
  edits: Edit[];
  /**
   * A second recorded try, played when the checks on `edits` come back red.
   * It is still wrong: the point is to stop, not to pass.
   */
  again?: Edit[];
  /** Describes the change only. Whether tests pass is the verify step's job to say. */
  doneText: string;
  answer: string;
};

const read = (path: string): Call => ({ name: "read_file", args: { path } });

export const TAPES: Tape[] = [
  {
    id: "list-off-by-one",
    title: "Fix the off-by-one in listTasks",
    match: /off[\s-]?by[\s-]?one|listtasks|paginat/i,
    reads: [read("src/store.ts"), read("tests/store.test.ts")],
    plan: [
      "Start each page at its first task in `listTasks` (src/store.ts)",
      "Drop the off-by-one comment that described the bug",
      "Check that tests/store.test.ts expects tsk_100 first on page 0",
    ],
    planText: "`listTasks` slices from `start + 1`, so every page drops its first task. The fix is one line in src/store.ts.",
    edits: [
      {
        path: "src/store.ts",
        search:
          "  // Off-by-one: skips the first item on every page.\n  return tasks.slice(start + 1, start + pageSize + 1);",
        replace: "  return tasks.slice(start, start + pageSize);",
        description: "Start each page at its first task",
      },
    ],
    doneText:
      "Staged the fix in `listTasks` (src/store.ts): it now returns `tasks.slice(start, start + pageSize)`, so page 0 starts with tsk_100 as tests/store.test.ts expects.",
    answer:
      "`listTasks` in src/store.ts slices from `start + 1` to `start + pageSize + 1`, so every page skips its first task. Page 0 should start at index 0.",
  },
  {
    id: "get-task-404",
    title: "Return 404 from getTask when the id is missing",
    match: /\b404\b|gettask|not[\s-]found|missing (task|id)/i,
    reads: [read("src/routes/tasks.ts"), read("src/lib/errors.ts"), read("tests/tasks.test.ts")],
    plan: [
      "In GET /tasks/:id (src/routes/tasks.ts), throw HttpError(404, \"not_found\") when getTask returns null",
      "Leave getTask returning null, since PATCH already handles that case",
    ],
    planText: "GET /tasks/:id returns `200` with `null` for an unknown id. PATCH already throws `HttpError(404)`; GET should do the same.",
    edits: [
      {
        path: "src/routes/tasks.ts",
        search:
          "    const task = getTask(id);\n    // Should be 404 when missing — currently returns null with 200.\n    return { status: 200, body: task };",
        replace:
          "    const task = getTask(id);\n    if (!task) throw new HttpError(404, \"not_found\", `Task ${id} does not exist`);\n    return { status: 200, body: task };",
        description: "404 for an unknown task id",
      },
    ],
    doneText:
      "Staged the change in src/routes/tasks.ts: GET /tasks/:id now throws `HttpError(404, \"not_found\")` for an unknown id, the same way PATCH does.",
    answer:
      "GET /tasks/:id in src/routes/tasks.ts returns `{ status: 200, body: null }` when the id is unknown. It should throw `HttpError(404)`, as PATCH already does.",
  },
  {
    id: "title-length",
    title: "Reject titles longer than 80 characters",
    match: /\b80\b|long(er)? titles?|title.{0,20}(length|long)/i,
    reads: [read("src/lib/validate.ts"), read("tests/tasks.test.ts")],
    plan: [
      "Reject titles over 80 characters in `requireTitle` (src/lib/validate.ts) with a 400 invalid_title",
      "Measure the trimmed title, so surrounding spaces don't count",
    ],
    planText: "`requireTitle` checks that a title exists but not its length. The check belongs there, next to the empty-title check.",
    edits: [
      {
        path: "src/lib/validate.ts",
        search: "  // Missing: reject titles longer than 80 characters.\n  return value.trim();",
        replace:
          "  const title = value.trim();\n  if (title.length > 80) {\n    throw new HttpError(400, \"invalid_title\", \"title must be 80 characters or fewer\");\n  }\n  return title;",
        description: "Cap titles at 80 characters",
      },
    ],
    doneText:
      "Staged the check in `requireTitle` (src/lib/validate.ts): a trimmed title over 80 characters now gets a 400 `invalid_title`.",
    answer:
      "`requireTitle` in src/lib/validate.ts rejects empty titles but accepts any length. A length check there would cover POST /tasks.",
  },
  {
    id: "list-bad-return",
    title: "Make listTasks return a number",
    match: /make listtasks return a number/i,
    reads: [read("src/store.ts")],
    plan: [
      "Change the return of listTasks in src/store.ts to a number",
      "Leave the function's declared return type as it is",
    ],
    planText:
      "`listTasks` is declared to return `Task[]`. This change returns a number instead, which the type check should refuse.",
    edits: [
      {
        path: "src/store.ts",
        search: "  return tasks.slice(start + 1, start + pageSize + 1);",
        replace: "  return 1;",
        description: "Return a number from listTasks",
      },
    ],
    again: [
      {
        path: "src/store.ts",
        search: "  return 1;",
        replace: '  return "none";',
        description: "Return a string from listTasks",
      },
    ],
    doneText:
      "Staged a return of `1` from `listTasks` (src/store.ts). The function is still declared to return `Task[]`.",
    answer: "`listTasks` in src/store.ts returns a page of tasks. Returning a number there does not typecheck.",
  },
];

/** The general question tape: the demo's known bugs, for "find bugs" or "explain this". */
const OVERVIEW: Pick<Tape, "reads" | "answer"> = {
  reads: [read("src/store.ts"), read("src/routes/tasks.ts"), read("src/lib/validate.ts")],
  answer: [
    "harbor-api has three known bugs:",
    "",
    "1. `listTasks` (src/store.ts) skips the first task of every page: it slices from `start + 1`.",
    "2. GET /tasks/:id (src/routes/tasks.ts) returns 200 with `null` for an unknown id instead of 404.",
    "3. `requireTitle` (src/lib/validate.ts) accepts titles of any length.",
    "",
    "Ask Composer to fix any of them.",
  ].join("\n"),
};

const FALLBACK = [
  "This is the replay model: it plays back recorded runs instead of calling a model, so it only knows these tasks on the harbor-api demo:",
  "",
  ...TAPES.map((t) => `- ${t.title}`),
  "",
  "Add a model key in Settings, or turn replay off, for anything else.",
].join("\n");

const FIX_PROMPT_PREFIX = "Your edits do not pass";
/** The editor's Send back prompt ends with this. A replay must not invent a passing fix. */
const CHECK_FIX_MARK = "Fix only this with propose_edit";

export function isFailedFixAsk(text: string): boolean {
  return text.startsWith(FIX_PROMPT_PREFIX) || text.includes(CHECK_FIX_MARK);
}

/** Replay replaces every model call on a deployment that sets `APERTURE_MODEL=replay`. */
export function replayEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.APERTURE_MODEL?.trim() === "replay";
}

/**
 * Inline edits paste the reply straight into code, so replay answers one only
 * with a recorded fix and otherwise says why, rather than insert prose.
 */
export const REPLAY_INLINE_ERROR =
  "The replay model only knows the demo's recorded fixes. Select a line one of them changes (the return in listTasks in src/store.ts, the \"Should be 404\" line in src/routes/tasks.ts, or the return in requireTitle in src/lib/validate.ts) and ask to fix it. Add a model key for anything else.";

/** A fix ask. The inline box's instruction must say so, or name the tape's task. */
const FIX_ASK = /\b(fix|bug|wrong|correct|repair|broken)/i;

const lines = (text: string) => text.replace(/\n$/, "").split("\n");

/**
 * The replacement for a selection that a recorded fix changes, or null.
 *
 * The selection may be the whole recorded span or more (the span is replaced
 * inside it), or some of its lines, as long as it holds every code line the
 * fix removes (a comment the fix drops may stay outside it). Lines the
 * selection leaves out that the fix keeps unchanged at either end are not
 * repeated, so the file ends up as the recorded fix leaves it, or with only
 * the dropped comment left over.
 */
export function inlineFix(edit: Pick<Edit, "search" | "replace">, selected: string): string | null {
  if (selected.includes(edit.search)) return selected.replace(edit.search, edit.replace);
  const search = lines(edit.search);
  const sel = lines(selected);
  const want = sel.map((line) => line.trim());
  const at = search.findIndex((_, i) => want.every((line, j) => search[i + j]?.trim() === line));
  if (at < 0 || !want.some(Boolean)) return null;
  const kept = new Set(lines(edit.replace).map((line) => line.trim()));
  const removed = search.filter((line) => !kept.has(line.trim()));
  const code = removed.filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
  const inSel = new Set(want);
  if (!(code.length ? code : removed).every((line) => inSel.has(line.trim()))) return null;
  let out = lines(edit.replace);
  const before = search.slice(0, at);
  const after = search.slice(at + sel.length);
  while (before.length && out.length && before[0] === out[0]) {
    before.shift();
    out.shift();
  }
  while (after.length && out.length && after.at(-1) === out.at(-1)) {
    after.pop();
    out.pop();
  }
  if (!out.length) return null;
  // A selection that starts mid-line has no indent before it in the file; the replacement must not add one.
  const indent = (search[at] ?? "").length - (search[at] ?? "").trimStart().length;
  const selIndent = sel[0]!.length - sel[0]!.trimStart().length;
  if (selIndent < indent) out = [out[0]!.slice(indent - selIndent), ...out.slice(1)];
  return out.join("\n") + (selected.endsWith("\n") ? "\n" : "");
}

/**
 * An inline edit in replay: the loop's inline prompt carries the instruction
 * and the selected code. A tape that is a fix (not the recorded bad change)
 * answers when the ask is a fix and the selection is code that fix changes.
 */
export function replayInline(messages: ReplayMessage[]): string {
  const ask = [...messages].reverse().find((m) => m.role === "user" && typeof m.content === "string")?.content ?? "";
  const instruction = /^Instruction: (.*)$/m.exec(ask)?.[1] ?? "";
  const selected = /\n\nSelected code:\n\n([\s\S]*?)\n\nSurrounding file \(/.exec(ask)?.[1];
  if (!selected) throw new Error(REPLAY_INLINE_ERROR);
  // The narrowest tape the words name, as findTape picks: "make listTasks return a number" is not a fix.
  const named = TAPES.filter((t) => t.match.test(instruction)).at(-1);
  const fixAsk = named ? !named.again : FIX_ASK.test(instruction);
  for (const tape of TAPES) {
    if (tape.again || !fixAsk) continue;
    for (const edit of tape.edits) {
      const fixed = inlineFix(edit, selected);
      if (fixed !== null) return fixed;
    }
  }
  throw new Error(REPLAY_INLINE_ERROR);
}

export function findTape(messages: ReplayMessage[]): Tape | null {
  // Skip the system prompt and the context message (which quotes file
  // contents, including the bugs' own comments); search the newest ask first.
  // A browser run's output can quote any test name: it is not an ask.
  const asks = messages
    .slice(2)
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content as string)
    .filter((text) => !text.startsWith(CONTINUATION_PREFIX))
    .filter((text) => !isFailedFixAsk(text) && !/^build it\b/i.test(text))
    .reverse();
  for (const text of asks) {
    // A later tape can be a narrower match for the same words (listTasks is
    // both a real fix and the bad-return recording). The narrower one is last.
    const hits = TAPES.filter((t) => t.match.test(text));
    if (hits.length > 0) return hits[hits.length - 1]!;
  }
  return null;
}

type Phase = "plan" | "build" | "read";

export function phaseFromTools(toolNames: readonly string[]): Phase {
  if (toolNames.includes("propose_edit")) return "build";
  if (toolNames.includes("set_plan")) return "plan";
  return "read";
}

type Round = { names: string[]; results: string[] };

/** This turn's tool rounds, oldest first. History only carries text, so every tool call belongs to this turn. */
function roundsOf(messages: ReplayMessage[]): Round[] {
  const results = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "tool" && m.tool_call_id) results.set(m.tool_call_id, String(m.content ?? ""));
  }
  return messages
    .filter((m) => m.role === "assistant" && m.tool_calls?.length)
    .map((m) => ({
      names: m.tool_calls!.map((c) => c.function.name),
      results: m.tool_calls!.map((c) => results.get(c.id) ?? ""),
    }));
}

function callsAt(round: number, calls: Call[]): ReplayCompletion {
  return {
    content: "",
    tool_calls: calls.map((call, i) => ({
      id: `replay_${round}_${i}`,
      type: "function" as const,
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })),
  };
}

const firstLine = (text: string) => text.split("\n")[0]!.trim();

function buildSummary(tape: Tape, rounds: Round[]): string {
  const round = rounds.filter((r) => r.names.includes("propose_edit")).at(-1);
  // Only the edits' own results: the round also ticks off the plan.
  const editResults = round ? round.results.filter((_, i) => round.names[i] === "propose_edit") : [];
  const staged = editResults.filter((r) => r.startsWith("Edit staged for"));
  const problems = editResults.filter((r) => !r.startsWith("Edit staged for")).map(firstLine);
  if (staged.length === 0) {
    return [
      "None of the recorded edits applied, most likely because the file changed since this replay was recorded:",
      ...problems.map((p) => `- ${p}`),
    ].join("\n");
  }
  // A staged edit can still fail its syntax or import check; that text says so.
  const checks = staged.filter((r) => r.includes(" failed: ")).map(firstLine);
  return [tape.doneText, ...checks.map((c) => `- ${c}`), ...problems.map((p) => `- Not applied: ${p}`)].join("\n");
}

/**
 * The next completion for this turn. `toolNames` are the tools the loop offered
 * (which says the phase). Deterministic for a given conversation.
 */
export function replayCompletion(messages: ReplayMessage[], toolNames: readonly string[]): ReplayCompletion {
  const phase = phaseFromTools(toolNames);
  const tape = findTape(messages);
  const rounds = roundsOf(messages);
  const did = (name: string) => rounds.some((r) => r.names.includes(name));
  const last = messages.at(-1);

  if (phase === "read") {
    const reads = tape?.reads ?? OVERVIEW.reads;
    if (!did("read_file")) return callsAt(rounds.length, reads);
    return { content: tape?.answer ?? OVERVIEW.answer };
  }

  // The browser ran the check this recording asked for: say what it found.
  const ran = last?.role === "user" ? parseContinuation(String(last.content ?? "")) : null;
  if (ran) return { content: browserRunAnswer(ran) };

  if (!tape) return { content: FALLBACK };

  if (!did("read_file")) return callsAt(rounds.length, tape.reads);

  if (phase === "plan") {
    if (!did("set_plan")) {
      return callsAt(rounds.length, [
        { name: "set_plan", args: { entries: tape.plan.map((content) => ({ content, status: "pending" })) } },
      ]);
    }
    return { content: tape.planText };
  }

  // Build. A failed check comes back as the next user message. A recording
  // can play one more wrong try (so the strip can show both) and then stops.
  // It never writes a fix that would pass.
  const askAt = [...messages].reverse().findIndex((m) => m.role === "user");
  const askIndex = askAt < 0 ? -1 : messages.length - 1 - askAt;
  const ask = askIndex >= 0 ? String(messages[askIndex]?.content ?? "") : "";
  if (isFailedFixAsk(ask)) {
    const turn = roundsOf(messages.slice(askIndex + 1));
    const edits = turn.filter((r) => r.names.includes("propose_edit"));
    if (edits.length === 0 && tape.again?.length) return callsAt(rounds.length, tape.again.map(editCall));
    if (edits.length > 0) {
      return {
        content: "Still red, so this stops. The second try is staged beside the first, and nothing is applied.",
      };
    }
    const detail = ask
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .find(Boolean);
    return {
      content: [
        `The edits are staged, but ${firstLine(ask)
          .replace(/^Your edits do not pass/, "they do not pass")
          .replace(/:$/, "")}${detail ? `: ${detail}` : "."}`,
        "This is a recorded replay, so it can't write a new fix. Review the diff, or switch to a real model.",
      ].join("\n"),
    };
  }

  const editRounds = rounds.filter((r) => r.names.includes("propose_edit"));
  const lastEdits = editRounds.at(-1);
  const locked = lastEdits?.results.some((r) => r.includes("locked until you call set_plan")) ?? false;
  const planAfterLock =
    locked && rounds.slice(rounds.indexOf(lastEdits!) + 1).some((r) => r.names.includes("set_plan"));

  // The loop ends a build turn as soon as a clean edit is staged, so the plan is
  // ticked off in the same round as the edits, as a model working through it must.
  if (editRounds.length === 0) return callsAt(rounds.length, [...tape.edits.map(editCall), planDone(tape)]);
  const staged = lastEdits?.results.some((r) => r.startsWith("Edit staged for")) ?? false;
  const markedDone = rounds.slice(rounds.indexOf(lastEdits!)).some((r) => r.names.includes("set_plan"));
  if (locked && !planAfterLock && editRounds.length < 2) {
    return callsAt(rounds.length, [
      { name: "set_plan", args: { entries: tape.plan.map((content) => ({ content, status: "in_progress" })) } },
    ]);
  }
  if (locked && planAfterLock && editRounds.length < 2) {
    return callsAt(rounds.length, [...tape.edits.map(editCall), planDone(tape)]);
  }
  // Tick the plan off once the edits are staged, as a model working through it would.
  if (staged && !markedDone) return callsAt(rounds.length, [planDone(tape)]);
  // Then check the work, as a model would.
  if (staged && toolNames.includes("run_script") && !did("run_script")) {
    return callsAt(rounds.length, [{ name: "run_script", args: { script: "test" } }]);
  }
  const runResult = rounds.find((r) => r.names.includes("run_script"))?.results[0] ?? "";
  const summary = buildSummary(tape, rounds);
  // Handed to the browser: the result arrives next turn, so claim nothing yet.
  if (runResult.includes("will run in the user's browser")) {
    return { content: `${summary}\n\nRunning \`npm run test\` in your browser to check it.` };
  }
  return { content: summary };
}

function browserRunAnswer(ran: NonNullable<ReturnType<typeof parseContinuation>>): string {
  if (ran.status === "passed") return `Checked: ${ran.line}. The fix is staged: review the diff, then apply it.`;
  if (ran.status === "not run") {
    return `${ran.line.replace(/^It could not run/, `\`npm run ${ran.script}\` could not run`)} The edits are staged but unchecked: review the diff before applying.`;
  }
  if (ran.preexisting && ran.fixed.length) {
    const others = ran.failing === 1 ? "1 other test" : ran.failing > 1 ? `${ran.failing} other tests` : "other tests";
    return [
      `Checked in the browser: the fix makes ${ran.fixed.map((t) => `\`${t}\``).join(", ")} pass.`,
      `\`npm run ${ran.script}\` still fails ${others}, which failed the same way before these edits, so ${ran.failing === 1 ? "it is" : "they are"} not from this change.`,
    ].join(" ");
  }
  if (ran.preexisting) {
    return `The fix is staged. ${ran.line}${ran.detail ? ` (${ran.detail})` : ""}, but it fails the same way without these edits, so the failure was already there.`;
  }
  return [
    `The edits are staged, but ${ran.line}${ran.detail ? `: ${ran.detail}` : "."}`,
    "This is a recorded replay, so it can't write a new fix. Review the diff, or switch to a real model.",
  ].join("\n");
}

function planDone(tape: Tape): Call {
  return { name: "set_plan", args: { entries: tape.plan.map((content) => ({ content, status: "completed" })) } };
}

function editCall(edit: Edit): Call {
  return { name: "propose_edit", args: { ...edit, confidence: 1 } };
}

/** Text as a model would stream it: short pieces, word-aligned where possible. */
export function streamPieces(text: string, size = 14): string[] {
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = rest.lastIndexOf(" ", size);
    const at = cut > 0 ? cut + 1 : size;
    pieces.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  if (rest) pieces.push(rest);
  return pieces;
}
