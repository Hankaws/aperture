import assert from "node:assert/strict";
import { test } from "node:test";
import { boardRuns, compareFiles, diffRows, groupRuns, runIdFor } from "./board.ts";
import type { ChatMessage, PlanEntry, ProposedEdit } from "./types.ts";

let clock = 1_000;
function user(content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  clock += 10;
  return { id: `u${clock}`, role: "user", content, createdAt: clock, ...extra };
}
function reply(extra: Partial<ChatMessage> = {}): ChatMessage {
  clock += 10;
  return {
    id: `a${clock}`,
    role: "assistant",
    content: "",
    createdAt: clock,
    agentLabel: "Aperture",
    ...extra,
  };
}
function edit(
  path: string,
  newText: string,
  status: ProposedEdit["status"] = "pending",
  extra: Partial<ProposedEdit> = {},
): ProposedEdit {
  return { id: `e_${path}`, path, oldText: "a\nb\n", newText, description: "", status, ...extra };
}
const plan = (statuses: PlanEntry["status"][]): PlanEntry[] =>
  statuses.map((status, i) => ({ id: `p${i + 1}`, content: `Step ${i + 1}`, status }));

test("a request, its plan, Build it and the automatic fix are one run, showing the latest version of each file", () => {
  const messages = [
    user("Fix the off-by-one in listTasks", { runId: "r1" }),
    reply({ runId: "r1", plan: plan(["pending", "pending"]), awaitingBuild: false }),
    user("Build it.", { runId: "r1" }),
    reply({
      runId: "r1",
      plan: plan(["completed", "completed"]),
      edits: [edit("src/store.ts", "a\nB\n")],
    }),
    user("The checks are red. Fixing them before you keep this.", { runId: "r1", automatic: true }),
    reply({ runId: "r1", edits: [edit("src/store.ts", "a\nC\nd\n")] }),
  ];
  const [run, ...rest] = boardRuns(messages, null);
  assert.equal(rest.length, 0);
  assert.equal(run!.title, "Fix the off-by-one in listTasks");
  assert.equal(run!.stage, "review");
  assert.equal(run!.status, "1 file staged for review");
  assert.equal(run!.automaticTurns, 1);
  assert.deepEqual(run!.plan, { done: 2, total: 2, current: null });
  assert.deepEqual(
    run!.files.map((f) => [f.path, f.added, f.removed]),
    [["src/store.ts", 2, 1]],
  );
  assert.equal(run!.focusId, messages.at(-1)!.id);
});

test("each stage: working, waiting for Build it, staged, and how a finished run ended", () => {
  const live = reply({
    runId: "r5",
    status: "Building…",
    plan: plan(["completed", "in_progress"]),
  });
  const messages = [
    user("Applied one", { runId: "r1" }),
    reply({ runId: "r1", edits: [edit("a.ts", "x", "applied")] }),
    user("Rejected one", { runId: "r2" }),
    reply({ runId: "r2", edits: [edit("b.ts", "x", "rejected")] }),
    user("Half kept", { runId: "r3" }),
    reply({ runId: "r3", edits: [edit("c.ts", "x", "applied"), edit("d.ts", "y", "rejected")] }),
    user("Plan only", { runId: "r4" }),
    reply({ runId: "r4", plan: plan(["pending"]), awaitingBuild: true }),
    user("Still going", { runId: "r5" }),
    live,
    user("Stopped one", { runId: "r6" }),
    reply({ runId: "r6", content: "Stopped.", plan: plan(["pending"]) }),
  ];
  const byTitle = new Map(boardRuns(messages, live.id).map((run) => [run.title, run]));
  assert.deepEqual(
    [...byTitle.values()].map((run) => [run.title, run.stage, run.outcome]),
    [
      ["Stopped one", "done", "stopped"],
      ["Still going", "working", null],
      ["Plan only", "needs-you", null],
      ["Half kept", "done", "partly-applied"],
      ["Rejected one", "done", "rejected"],
      ["Applied one", "done", "applied"],
    ],
  );
  assert.equal(byTitle.get("Still going")!.status, "Building…");
  assert.equal(byTitle.get("Plan only")!.status, "Plan of 1 step waits for Build it");
  assert.equal(byTitle.get("Half kept")!.status, "Applied 1 of 2 files");
});

test("a question answered in Ask is a chat, not a run", () => {
  const messages = [
    user("What does listTasks do?", { runId: "r1" }),
    reply({ runId: "r1", content: "It pages tasks." }),
  ];
  assert.deepEqual(boardRuns(messages, null), []);
});

test("chats saved before runs had ids still group: a typed Build it carries on the plan", () => {
  const messages = [
    user("Add a title limit"),
    reply({ plan: plan(["pending"]), awaitingBuild: false }),
    user("build it"),
    reply({ edits: [edit("a.ts", "x")] }),
    user("Now rename the helper"),
    reply({ edits: [edit("b.ts", "y")] }),
  ];
  assert.deepEqual(
    groupRuns(messages).map((run) => run.messages.length),
    [4, 2],
  );
});

test("a new turn's run: new for a request, the plan's run for Build it, the change's run for a follow-up", () => {
  const messages = [
    user("First", { runId: "r1" }),
    reply({ runId: "r1", plan: plan(["pending"]) }),
    user("Second", { runId: "r2", copyId: "cp2" }),
    reply({ runId: "r2", copyId: "cp2", edits: [edit("a.ts", "x", "pending", { copyId: "cp2" })] }),
  ];
  const turn = { id: "u9", build: false, followUp: false };
  assert.equal(runIdFor(messages, turn), "u9");
  assert.equal(runIdFor(messages, { ...turn, build: true }), "r1");
  assert.equal(runIdFor(messages, { ...turn, followUp: true, copyId: "cp2" }), "r2");
  assert.equal(runIdFor(messages, { ...turn, followUp: true, automatic: true }), "r2");
  assert.equal(
    runIdFor(messages, { ...turn, followUp: true }),
    "r2",
    "Iterate works on the staged change",
  );
  assert.equal(runIdFor([], { ...turn, build: true }), "u9");

  // Once the change is applied, Fix this or a CI fix is a new request.
  const applied = messages.map((m) => ({
    ...m,
    edits: m.edits?.map((e) => ({ ...e, status: "applied" as const })),
  }));
  assert.equal(runIdFor(applied, { ...turn, followUp: true }), "u9");
  assert.equal(
    runIdFor(applied, { ...turn, followUp: true, automatic: true }),
    "r2",
    "the editor's own turns stay",
  );
});

test("compare lists every file either run changed, side by side", () => {
  const messages = [
    user("One way", { runId: "r1", copyId: "c1" }),
    reply({ runId: "r1", copyId: "c1", edits: [edit("a.ts", "1"), edit("b.ts", "2")] }),
    user("Another way", { runId: "r2", copyId: "c2" }),
    reply({ runId: "r2", copyId: "c2", edits: [edit("b.ts", "3"), edit("c.ts", "4")] }),
  ];
  const [right, left] = boardRuns(messages, null);
  const rows = compareFiles(left!, right!);
  assert.deepEqual(
    rows.map((row) => [row.path, row.left?.edit.newText ?? null, row.right?.edit.newText ?? null]),
    [
      ["a.ts", "1", null],
      ["b.ts", "2", "3"],
      ["c.ts", null, "4"],
    ],
  );
});

test("a diff keeps two lines around each change and folds the rest", () => {
  const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
  const after = before.replace("line 10", "line ten");
  const rows = diffRows(before, after);
  assert.deepEqual(rows[0], { type: "gap", lines: 7 });
  assert.deepEqual(
    rows.slice(1, -1).map((row) => ("text" in row ? `${row.type} ${row.text}` : "")),
    ["eq line 8", "eq line 9", "del line 10", "add line ten", "eq line 11", "eq line 12"],
  );
  assert.deepEqual(rows.at(-1), { type: "gap", lines: 8 });
  assert.deepEqual(diffRows("same", "same"), []);
});
