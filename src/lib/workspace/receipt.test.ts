import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lookAtLine,
  receiptFor,
  receiptMarkdown,
  receiptsForSend,
  riskOf,
  runFor,
  stepFor,
} from "./receipt.ts";
import type { ChatMessage, ProposedEdit, ToolTrace } from "./types.ts";

function edit(
  path: string,
  oldText: string,
  newText: string,
  description = "",
  over: Partial<ProposedEdit> = {},
): ProposedEdit {
  return { id: `e_${path}`, path, oldText, newText, description, status: "pending", ...over };
}
const read = (path: string): ToolTrace => ({
  id: `t_${path}`,
  name: "read_file",
  args: { path },
  resultPreview: "",
  ms: 0,
});
const grep = (pattern: string): ToolTrace => ({
  id: `g_${pattern}`,
  name: "grep",
  args: { pattern },
  resultPreview: "",
  ms: 0,
});

test("the plan step an edit carries out is matched from its description", () => {
  const steps = ["Start each page at its first task in listTasks", "Update the README badge"];
  assert.equal(stepFor("listTasks: start each page at its first task", steps), steps[0]);
  assert.equal(stepFor("Tidy imports", steps), undefined);
});

test("risk: tests, CI, dependencies, sign-in code and deletions are high", () => {
  const cases: Array<[ProposedEdit, string]> = [
    [edit("tests/store.test.ts", "a\n", "b\n"), "changes the tests"],
    [edit(".github/workflows/ci.yml", "a\n", "b\n"), "changes the CI"],
    [edit("package.json", "{}", '{"a":1}'), "changes the dependencies or scripts"],
    [edit("src/auth/session.ts", "a\n", "b\n"), "touches sign-in, security or billing code"],
    [edit("src/old.ts", "a\n", "", "", { deleted: true }), "deletes the file"],
  ];
  for (const [e, reason] of cases) {
    const r = riskOf(e, true);
    assert.equal(r.risk, "high", e.path);
    assert.equal(r.reasons[0], reason, e.path);
  }
});

test("risk: changed exports, a big change, config and editing unread are worth a look; small ones are not", () => {
  assert.deepEqual(
    riskOf(edit("src/a.ts", "export const a = 1;\n", "export const a = 2;\n"), true),
    {
      risk: "look",
      reasons: ["changes what other files import"],
    },
  );
  const big = Array.from({ length: 70 }, (_, i) => `line ${i}`).join("\n");
  assert.deepEqual(riskOf(edit("src/b.ts", "x\n", big), true).reasons, ["a large change (+70 −2)"]);
  assert.deepEqual(riskOf(edit("tsconfig.json", "{}", '{"a":1}'), true).reasons, [
    "changes project config",
  ]);
  assert.deepEqual(riskOf(edit("src/c.ts", "const c = 1;\n", "const c = 2;\n"), false), {
    risk: "look",
    reasons: ["edited without reading it first"],
  });
  assert.deepEqual(riskOf(edit("src/c.ts", "const c = 1;\n", "const c = 2;\n"), true), {
    risk: "low",
    reasons: [],
  });
  // A new file was never there to read.
  assert.equal(riskOf(edit("src/new.ts", "", "const n = 1;\n"), false).risk, "low");
  // Docs and styles stay low, whatever their size.
  assert.equal(riskOf(edit("README.md", "a\n", "b\n"), false).risk, "low");
});

test("a run's receipt: riskiest file first, steps matched, reads that were not changed, searches", () => {
  const receipt = receiptFor({
    request: "Fix the off-by-one in listTasks",
    plan: [
      { id: "1", content: "Start each page at its first task in listTasks", status: "completed" },
      {
        id: "2",
        content: "Check the store test expects the first task on page 0",
        status: "completed",
      },
    ],
    traces: [
      read("src/store.ts"),
      read("tests/store.test.ts"),
      read("src/types.ts"),
      grep("listTasks"),
    ],
    edits: [
      edit(
        "src/store.ts",
        "return tasks.slice(start + 1);\n",
        "return tasks.slice(start);\n",
        "listTasks: start each page at its first task",
      ),
      edit(
        "tests/store.test.ts",
        "a\n",
        "b\n",
        "Check the store test expects the first task on page 0",
      ),
    ],
  });
  assert.deepEqual(
    receipt.files.map((f) => [f.path, f.risk, f.step ?? null]),
    [
      ["tests/store.test.ts", "high", "Check the store test expects the first task on page 0"],
      ["src/store.ts", "low", "Start each page at its first task in listTasks"],
    ],
  );
  assert.deepEqual(receipt.read, ["src/types.ts"]);
  assert.deepEqual(receipt.searched, ["listTasks"]);
  assert.equal(receipt.lookAt, "Start with tests/store.test.ts: it changes the tests.");
});

test("the start line counts the other files worth a look, or says nothing stands out", () => {
  const f = (path: string, risk: "high" | "look" | "low", reasons: string[] = []) => ({
    path,
    added: 1,
    removed: 1,
    deleted: false,
    risk,
    reasons,
    change: "",
  });
  assert.equal(
    lookAtLine([
      f("a.ts", "high", ["changes the CI"]),
      f("b.ts", "look", ["x"]),
      f("c.ts", "look", ["y"]),
      f("d.css", "low"),
    ]),
    "Start with a.ts: it changes the CI. Then 2 more files worth a look.",
  );
  assert.equal(lookAtLine([f("a.ts", "low")]), "Nothing stands out: one small change to a.ts.");
  assert.equal(
    lookAtLine([f("a.ts", "low"), f("b.ts", "low")]),
    "Nothing stands out: 2 small changes.",
  );
  assert.equal(lookAtLine([]), "Nothing changed.");
});

test("the run is found from its edits: request, latest plan and every trace across its turns", () => {
  const e = edit("src/a.ts", "a\n", "b\n");
  const messages: ChatMessage[] = [
    { id: "u0", role: "user", content: "An older request", createdAt: 1, runId: "r0" },
    { id: "u1", role: "user", content: "Make a 2", createdAt: 2, runId: "r1" },
    {
      id: "a1",
      role: "assistant",
      content: "Plan",
      createdAt: 3,
      runId: "r1",
      plan: [{ id: "p", content: "Make a two", status: "pending" }],
      traces: [read("src/a.ts")],
    },
    {
      id: "a2",
      role: "assistant",
      content: "Staged",
      createdAt: 4,
      runId: "r1",
      edits: [e],
      traces: [grep("a")],
    },
  ];
  const run = runFor(messages, [e]);
  assert.equal(run?.request, "Make a 2");
  assert.deepEqual(
    run?.plan?.map((p) => p.content),
    ["Make a two"],
  );
  assert.deepEqual(
    run?.traces.map((t) => t.name),
    ["read_file", "grep"],
  );
  assert.equal(runFor(messages, [edit("src/z.ts", "", "z")]), null);
});

test("as Markdown: the request, where to start, a table by risk, and no stray pipes", () => {
  const md = receiptMarkdown([
    receiptFor({
      request: "Fix the | pipe",
      traces: [read("src/b.ts")],
      edits: [edit("tests/a.test.ts", "a\n", "b\n", "Fix the test | expectation")],
    }),
  ]);
  assert.match(
    md,
    /^## Review receipt\n\n\*\*Asked:\*\* Fix the \\\| pipe\n\n\*\*Start here:\*\* Start with tests\/a\.test\.ts: it changes the tests\./,
  );
  assert.match(
    md,
    /\| 🔴 \| `tests\/a\.test\.ts` \(\+1 −1\) \| Fix the test \\\| expectation \| changes the tests; edited without reading it first \|/,
  );
  assert.match(md, /Read before writing, not changed: `src\/b\.ts`\./);
  assert.match(md, /every change is checked before it can be applied\.$/);
});

test("what is sent to GitHub gets the receipts of the runs that made it, newest first", () => {
  const applied = (path: string, newText: string, id: string): ProposedEdit => ({
    ...edit(path, "old\n", newText, `Change ${path}`),
    id,
    status: "applied",
  });
  const messages: ChatMessage[] = [
    { id: "u1", role: "user", content: "First task", createdAt: 1, runId: "r1" },
    {
      id: "a1",
      role: "assistant",
      content: "",
      createdAt: 2,
      runId: "r1",
      edits: [applied("a.ts", "a1\n", "x1"), applied("b.ts", "b1\n", "x2")],
    },
    { id: "u2", role: "user", content: "Second task", createdAt: 3, runId: "r2" },
    {
      id: "a2",
      role: "assistant",
      content: "",
      createdAt: 4,
      runId: "r2",
      edits: [applied("a.ts", "a2\n", "x3")],
    },
    { id: "u3", role: "user", content: "Rejected task", createdAt: 5, runId: "r3" },
    {
      id: "a3",
      role: "assistant",
      content: "",
      createdAt: 6,
      runId: "r3",
      edits: [{ ...edit("c.ts", "", "c\n"), status: "rejected" }],
    },
  ];
  const receipts = receiptsForSend(messages, [
    { path: "a.ts", content: "a2\n" },
    { path: "b.ts", content: "b1\n" },
    { path: "c.ts", content: "by hand\n" },
  ]);
  assert.deepEqual(
    receipts.map((r) => [r.request, r.files.map((f) => f.path)]),
    [
      ["Second task", ["a.ts"]],
      ["First task", ["b.ts"]],
    ],
  );
  // A file edited by hand after the run is not the run's to explain.
  assert.deepEqual(receiptsForSend(messages, [{ path: "b.ts", content: "b1 and more\n" }]), []);
  assert.equal(
    receiptsForSend(
      messages,
      [
        { path: "a.ts", content: "a2\n" },
        { path: "b.ts", content: "b1\n" },
      ],
      1,
    ).length,
    1,
  );
});

test("a run with no tool calls, such as an imported patch, is not said to edit without reading", () => {
  const receipt = receiptFor({
    request: "",
    traces: [],
    edits: [edit("src/c.ts", "const c = 1;\n", "const c = 2;\n")],
  });
  assert.deepEqual(
    receipt.files.map((f) => [f.risk, f.reasons]),
    [["low", []]],
  );
});
