import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KEEP_MAX_CHARS,
  MAX_KEPT,
  OutputStore,
  readOutput,
  RepeatGuard,
  SHOW_CHARS,
  spillLong,
  stableArgs,
  withTimeLimit,
} from "./guards.ts";

test("the same call in another key order is the same call", () => {
  assert.equal(
    stableArgs({ b: 1, a: { d: [1, 2], c: "x" } }),
    stableArgs({ a: { c: "x", d: [1, 2] }, b: 1 }),
  );
  assert.notEqual(stableArgs({ a: 1 }), stableArgs({ a: 2 }));
});

test("a repeated read gets the same answer back, without the work, and a firmer nudge each time", () => {
  const guard = new RepeatGuard();
  const args = { path: "src/cart.ts" };
  assert.equal(guard.before("read_file", args, "0"), null);
  assert.equal(
    guard.after("read_file", args, "0", "   1 export const total = 1;"),
    "   1 export const total = 1;",
  );
  const second = guard.before("read_file", { ...args }, "0");
  assert.match(
    second!,
    /^You already called read_file with these arguments, and nothing has changed since/,
  );
  assert.match(second!, /\n\n {3}1 export const total = 1;$/);
  assert.match(
    guard.before("read_file", args, "0")!,
    /^This is call 3 of read_file with the same arguments, and nothing has changed\. Stop repeating it/,
  );
  // Other arguments, or after an edit: a new call.
  assert.equal(guard.before("read_file", { path: "src/price.ts" }, "0"), null);
  assert.equal(guard.before("read_file", args, "1"), null);
});

test("a call with effects always runs; a repeat of one is told so after its answer", () => {
  const guard = new RepeatGuard();
  const args = { server: "linear", tool: "create_issue", arguments: "{}" };
  assert.equal(guard.before("mcp_call", args, "0"), null);
  assert.equal(guard.after("mcp_call", args, "0", "Created ENG-1."), "Created ENG-1.");
  assert.equal(guard.before("mcp_call", args, "0"), null);
  assert.match(
    guard.after("mcp_call", args, "0", "Created ENG-2."),
    /^Created ENG-2\.\n\nYou already called mcp_call/,
  );
  assert.equal(guard.before("propose_edit", { path: "a" }, "0"), null);
});

test("a long previous answer is cut in the reminder", () => {
  const guard = new RepeatGuard();
  guard.after("grep", { pattern: "x" }, "0", "y".repeat(5_000));
  const again = guard.before("grep", { pattern: "x" }, "0")!;
  assert.ok(again.length < 2_400);
  assert.match(again, /cut here; it is the same as before\)$/);
});

test("a read that hangs comes back as too slow; a write is never cut short", async () => {
  const never = new Promise<string>(() => undefined);
  assert.equal(
    await withTimeLimit("grep", never, 20),
    "grep took longer than 0 s and was stopped. Try a narrower call, or go on without it.",
  );
  assert.equal(await withTimeLimit("grep", Promise.resolve("3 matches"), 1_000), "3 matches");
  let done = false;
  const slowEdit = new Promise<string>((resolve) => setTimeout(() => resolve("Edit staged"), 40));
  void slowEdit.then(() => (done = true));
  assert.equal(await withTimeLimit("propose_edit", slowEdit, 10), "Edit staged");
  assert.ok(done);
});

test("a long output shows its start and end, and the whole is kept to read back", () => {
  const store = new OutputStore();
  const log = Array.from(
    { length: 2_000 },
    (_, i) => `line ${i + 1}${i === 1_499 ? " Error: expected 100 to be 1" : ""}`,
  ).join("\n");
  const shown = spillLong(store, log);
  assert.ok(shown.length < SHOW_CHARS + 600, String(shown.length));
  assert.match(shown, /^line 1\nline 2\n/);
  assert.match(shown, /\n… \d+ characters left out here …\n/);
  assert.match(
    shown,
    /line 2000\n\nThe whole output is kept as output 1 \(2000 lines\)\. Read any part with read_output/,
  );
  // Read back by search: the failure from the middle.
  assert.equal(
    readOutput(store, { id: 1, grep: "ERROR" }),
    '1 line of output 1 contains "ERROR":\n 1500 line 1500 Error: expected 100 to be 1',
  );
  // By lines, numbered as in the whole.
  assert.equal(
    readOutput(store, { id: 1, startLine: 1499, endLine: 1500 }),
    "Output 1, lines 1499–1500 of 2000:\n 1499 line 1499\n 1500 line 1500 Error: expected 100 to be 1",
  );
  assert.equal(spillLong(store, "short"), "short");
});

test("reading back stays within bounds and says where to go on", () => {
  const store = new OutputStore();
  store.keep(Array.from({ length: 3_000 }, (_, i) => `${i + 1} ${"x".repeat(60)}`).join("\n"));
  const page = readOutput(store, { id: 1, startLine: 1, endLine: 3_000 });
  assert.ok(page.length < 9_000);
  assert.match(page, /\n… cut here; read on with "startLine": \d+$/);
  assert.equal(readOutput(store, { id: 1, startLine: 5_000 }), "Output 1 has 3000 lines.");
  assert.equal(readOutput(store, { id: 2 }), "No output 2 was kept in this turn.");
  assert.equal(readOutput(undefined, { id: 1 }), "No output 1 was kept in this turn.");
  const many = readOutput(store, { id: 1, grep: "x" });
  assert.match(many, /^3000 lines of output 1 contain "x":/);
  assert.match(many, /\n… 2940 more lines match; search for something narrower\.$/);
  assert.equal(readOutput(store, { id: 1, grep: "nope" }), 'No line of output 1 contains "nope".');
});

test("a turn keeps a bounded number of outputs, each bounded; past that, the end is shown as before", () => {
  const store = new OutputStore();
  for (let i = 0; i < MAX_KEPT; i++) assert.equal(store.keep(`out ${i}`), i + 1);
  assert.equal(store.keep("one more"), null);
  const shown = spillLong(store, "z".repeat(SHOW_CHARS + 10));
  assert.match(shown, /^… 10 earlier characters omitted …\n/);
  assert.doesNotMatch(shown, /read_output/);
  const big = new OutputStore();
  big.keep("q".repeat(KEEP_MAX_CHARS + 50));
  assert.equal(big.get(1)!.length, KEEP_MAX_CHARS);
});
