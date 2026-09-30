import { test } from "node:test";
import assert from "node:assert/strict";
import { applySearchReplace } from "./apply-edit.ts";
import { DEMO_FILES } from "../workspace/demo-repo.ts";
import { continuationInstruction, handoffToolText } from "./browser-handoff.ts";
import {
  TAPES,
  findTape,
  phaseFromTools,
  replayCompletion,
  replayEnabled,
  streamPieces,
  type ReplayMessage,
} from "./replay.ts";

const READ_TOOLS = ["semantic_search", "grep", "read_file", "list_dir"];
const PLAN_TOOLS = ["set_plan", ...READ_TOOLS, "run_script"];
const BUILD_TOOLS = [...PLAN_TOOLS, "propose_edit"];

/** Stands in for the agent loop: the same tool-result wording, the real edit function. */
function runTurn(
  instruction: string,
  tools: string[],
  opts: {
    plan?: string[];
    files?: Record<string, string>;
    history?: ReplayMessage[];
    /** What run_script answers: the loop's words for a handoff to the browser, or for no runner. */
    runScript?: "handoff" | "unavailable";
  } = {},
) {
  const files = { ...(opts.files ?? DEMO_FILES) };
  let plan = opts.plan ?? [];
  const staged: string[] = [];
  const messages: ReplayMessage[] = [
    { role: "system", content: "You are Composer." },
    // The context message quotes the demo files, bug comments included: it must never pick the tape.
    { role: "user", content: `Workspace:\n${Object.values(DEMO_FILES).join("\n")}` },
    ...(opts.history ?? []),
    { role: "user", content: instruction },
  ];
  for (let step = 0; step < 10; step++) {
    const completion = replayCompletion(messages, tools);
    const calls = completion.tool_calls ?? [];
    if (calls.length === 0) return { text: completion.content, plan, staged, files, messages, steps: step + 1 };
    messages.push({ role: "assistant", content: completion.content, tool_calls: calls });
    for (const call of calls) {
      const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
      let result = "";
      if (call.function.name === "read_file") {
        result = files[String(args.path)] ?? `File not found: ${String(args.path)}`;
      } else if (call.function.name === "set_plan") {
        plan = (args.entries as { content: string }[]).map((e) => e.content);
        result = `Plan updated (${plan.length} steps).`;
      } else if (call.function.name === "propose_edit") {
        const path = String(args.path);
        if (plan.length === 0) {
          result = "Edits are locked until you call set_plan with 3–7 steps.";
        } else {
          const applied = applySearchReplace(files[path] ?? "", String(args.search), String(args.replace));
          if (applied.ok) {
            files[path] = applied.next;
            staged.push(path);
            result = `Edit staged for ${path}. The user must accept it in the UI.`;
          } else {
            result = `Edit rejected: ${applied.error}\nNearby:\n…`;
          }
        }
      } else if (call.function.name === "run_script" && opts.runScript) {
        result =
          opts.runScript === "handoff"
            ? handoffToolText(String(args.script))
            : "Running is not available for this request. Verify by reading the code instead.";
      } else {
        result = `Unexpected tool ${call.function.name}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  throw new Error("replay did not finish within 10 steps");
}

test("the three suggested prompts each pick their own tape", () => {
  const prompts = [
    ["Fix the off-by-one in listTasks", "list-off-by-one"],
    ["Return 404 from getTask when the id is missing", "get-task-404"],
    ["Reject titles longer than 80 characters", "title-length"],
  ] as const;
  for (const [prompt, id] of prompts) {
    const tape = findTape([
      { role: "system", content: "" },
      { role: "user", content: "context" },
      { role: "user", content: prompt },
    ]);
    assert.equal(tape?.id, id, prompt);
  }
});

test("every recorded edit applies cleanly, and exactly once, to the demo files", () => {
  for (const tape of TAPES) {
    for (const edit of tape.edits) {
      const applied = applySearchReplace(DEMO_FILES[edit.path] ?? "", edit.search, edit.replace);
      assert.ok(applied.ok, `${tape.id}: ${edit.path}`);
    }
  }
});

test("plan phase reads, posts the plan and stops, without editing", () => {
  const tape = TAPES[0]!;
  const run = runTurn(tape.title, PLAN_TOOLS);
  assert.deepEqual(run.plan, tape.plan);
  assert.equal(run.text, tape.planText);
  assert.deepEqual(run.staged, []);
  assert.equal(run.files["src/store.ts"], DEMO_FILES["src/store.ts"]);
});

test("build phase with an approved plan stages the recorded edit", () => {
  for (const tape of TAPES) {
    const run = runTurn(tape.title, BUILD_TOOLS, { plan: tape.plan });
    assert.deepEqual(run.staged, tape.edits.map((e) => e.path), tape.id);
    assert.equal(run.text, tape.doneText, tape.id);
    for (const edit of tape.edits) assert.ok(run.files[edit.path]!.includes(edit.replace), tape.id);
    const lastPlan = run.messages
      .flatMap((m) => m.tool_calls ?? [])
      .filter((c) => c.function.name === "set_plan")
      .at(-1);
    const statuses = (JSON.parse(lastPlan!.function.arguments).entries as { status: string }[]).map((e) => e.status);
    assert.ok(statuses.length > 0 && statuses.every((st) => st === "completed"), `${tape.id}: plan ticked off`);
  }
});

test("the off-by-one fix actually fixes the demo's own test expectation", () => {
  const run = runTurn("Fix the off-by-one in listTasks", BUILD_TOOLS, { plan: ["fix"] });
  assert.match(run.files["src/store.ts"]!, /return tasks\.slice\(start, start \+ pageSize\);/);
  assert.doesNotMatch(run.files["src/store.ts"]!, /start \+ 1/);
});

test("a build refused for lack of a plan posts the plan, then proposes the edit again", () => {
  const tape = TAPES[1]!;
  const run = runTurn(tape.title, BUILD_TOOLS);
  assert.deepEqual(run.plan, tape.plan);
  assert.deepEqual(run.staged, ["src/routes/tasks.ts"]);
  assert.equal(run.text, tape.doneText);
});

test("the build tape is still found when the instruction is just 'Build it'", () => {
  const tape = TAPES[2]!;
  const run = runTurn("Build it", BUILD_TOOLS, {
    plan: tape.plan,
    history: [
      { role: "user", content: tape.title },
      { role: "assistant", content: tape.planText },
    ],
  });
  assert.deepEqual(run.staged, ["src/lib/validate.ts"]);
});

test("edits that no longer match the files are reported, never faked", () => {
  const files = { ...DEMO_FILES, "src/store.ts": "export function listTasks() { return []; }\n" };
  const run = runTurn("Fix the off-by-one in listTasks", BUILD_TOOLS, { plan: ["fix"], files });
  assert.deepEqual(run.staged, []);
  assert.match(run.text, /None of the recorded edits applied/);
  assert.match(run.text, /search string not found/);
});

test("a failed verify run is reported as a failure, not as success", () => {
  const tape = TAPES[0]!;
  const first = runTurn(tape.title, BUILD_TOOLS, { plan: tape.plan });
  first.messages.push({ role: "assistant", content: first.text });
  first.messages.push({
    role: "user",
    content: "Your edits do not pass `npm run test`:\n\nError: first item should be tsk_100\n\nFix this now with propose_edit.",
  });
  const reply = replayCompletion(first.messages, BUILD_TOOLS);
  assert.equal(reply.tool_calls, undefined);
  assert.match(reply.content, /do not pass `npm run test`: Error: first item should be tsk_100/);
  assert.match(reply.content, /can't write a new fix/);
  assert.doesNotMatch(reply.content, /\bpass(ed|es)\b/i);
});

test("an unknown task gets the list of recorded tasks, in plan and build alike", () => {
  for (const tools of [PLAN_TOOLS, BUILD_TOOLS]) {
    const run = runTurn("Add a dark mode toggle", tools);
    assert.match(run.text, /replay model/);
    for (const tape of TAPES) assert.ok(run.text.includes(tape.title));
    assert.deepEqual(run.staged, []);
  }
});

test("questions read the code, then answer", () => {
  const overview = runTurn("Find bugs in this project", READ_TOOLS);
  assert.match(overview.text, /three known bugs/);
  assert.ok(overview.messages.some((m) => m.role === "tool"));
  const specific = runTurn("Why does getTask return null?", READ_TOOLS);
  assert.equal(specific.text, TAPES[1]!.answer);
});

test("replays are deterministic", () => {
  const a = runTurn("Reject titles longer than 80 characters", BUILD_TOOLS, { plan: ["x"] });
  const b = runTurn("Reject titles longer than 80 characters", BUILD_TOOLS, { plan: ["x"] });
  assert.deepEqual(a.messages, b.messages);
});

test("phaseFromTools reads the phase off the offered tools", () => {
  assert.equal(phaseFromTools(BUILD_TOOLS), "build");
  assert.equal(phaseFromTools(PLAN_TOOLS), "plan");
  assert.equal(phaseFromTools(READ_TOOLS), "read");
});

test("streamPieces splits text into small pieces that rejoin exactly", () => {
  const text = TAPES[0]!.doneText;
  const pieces = streamPieces(text);
  assert.ok(pieces.length > 3);
  assert.equal(pieces.join(""), text);
  assert.deepEqual(streamPieces(""), []);
});

test("replay is only on when a deployment asks for it", () => {
  assert.equal(replayEnabled({}), false);
  assert.equal(replayEnabled({ APERTURE_MODEL: "grok" }), false);
  assert.equal(replayEnabled({ APERTURE_MODEL: "replay" }), true);
  assert.equal(replayEnabled({ APERTURE_MODEL: " replay " }), true);
});

test("after staging a fix, the replay checks it with run_script and claims nothing yet", () => {
  const tape = TAPES[0]!;
  const run = runTurn(tape.title, BUILD_TOOLS, { plan: tape.plan, runScript: "handoff" });
  const calls = run.messages.flatMap((m) => m.tool_calls ?? []).map((c) => c.function.name);
  assert.deepEqual(calls.slice(-2), ["set_plan", "run_script"], "checks after ticking the plan off");
  assert.match(run.text, /^Staged the fix/);
  assert.match(run.text, /Running `npm run test` in your browser to check it\.$/);
  assert.doesNotMatch(run.text, /\bpass(ed|es)\b/i);
});

test("with no runner the replay answers as before and leaves the result to the verify step", () => {
  const tape = TAPES[0]!;
  const run = runTurn(tape.title, BUILD_TOOLS, { plan: tape.plan, runScript: "unavailable" });
  assert.match(run.text, /^Staged the fix/);
  assert.doesNotMatch(run.text, /in your browser/);
});

test("the browser run's result comes back next turn and is reported as it is", () => {
  const tape = TAPES[0]!;
  const history: ReplayMessage[] = [
    { role: "user", content: tape.title },
    { role: "assistant", content: `${tape.doneText}\n\nRunning \`npm run test\` in your browser to check it.` },
  ];
  const passed = runTurn(
    continuationInstruction("test", { kind: "done", passed: true, output: "ℹ tests 1 · pass 1 · fail 0", detail: "", pass: 1, fail: 0 }),
    BUILD_TOOLS,
    { plan: tape.plan, history },
  );
  assert.equal(passed.steps, 1, "answers straight away: no re-reading, no second edit");
  assert.equal(passed.text, "Checked: `npm run test` passed in the browser (1 passed). The fix is staged: review the diff, then apply it.");

  const failed = runTurn(
    continuationInstruction("test", {
      kind: "done",
      passed: false,
      // The output names a test about 404s: it must not pick the 404 tape.
      output: "✖ returns 404 for a missing task (1ms)\n  Error: expected 404, got 200\nℹ tests 1 · pass 0 · fail 1",
      detail: "Error: expected 404, got 200",
      pass: 0,
      fail: 1,
    }),
    BUILD_TOOLS,
    { plan: tape.plan, history },
  );
  assert.equal(failed.steps, 1);
  assert.match(failed.text, /^The edits are staged, but `npm run test` failed in the browser \(1 failed\): Error: expected 404, got 200/);
  assert.match(failed.text, /can't write a new fix/);
  assert.equal(findTape([...failed.messages]), tape, "the ask is still the off-by-one");

  const notRun = runTurn(
    continuationInstruction("test", { kind: "unsupported", reason: "src/api.ts imports the package zod." }),
    BUILD_TOOLS,
    { plan: tape.plan, history },
  );
  assert.match(notRun.text, /^`npm run test` could not run in the editor's browser test runner: src\/api\.ts imports the package zod\./);
  assert.match(notRun.text, /unchecked/);

  const before = runTurn(
    continuationInstruction("test", {
      kind: "done",
      passed: false,
      output: "Error: first item should be tsk_100",
      detail: "Error: first item should be tsk_100",
      pass: 0,
      fail: 0,
      preexisting: true,
    }),
    BUILD_TOOLS,
    { plan: tape.plan, history },
  );
  assert.equal(
    before.text,
    "The fix is staged. `npm run test` failed in the browser (Error: first item should be tsk_100), but it fails the same way without these edits, so the failure was already there.",
  );
});
