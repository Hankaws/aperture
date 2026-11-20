import assert from "node:assert/strict";
import { test } from "node:test";
import { handoffView, IDLE_COMPOSER, type ComposerStatus } from "./composer-status.ts";

const at = (over: Partial<ComposerStatus>): ComposerStatus => ({
  ...IDLE_COMPOSER,
  replies: 4,
  ...over,
});
const states = (s: ComposerStatus, since = 4, ended: "applied" | "discarded" | null = null) =>
  handoffView(s, since, ended).steps.map((step) => step.state);

test("a hand-off is followed from Composer starting to the person's Apply", () => {
  // Not started yet.
  let view = handoffView(at({}), 4);
  assert.equal(view.stage, "sent");
  assert.deepEqual(states(at({})), ["done", "active", "todo", "todo"]);

  view = handoffView(at({ running: true }), 4);
  assert.equal(view.stage, "working");
  assert.equal(view.title, "Composer is making the change…");

  // Staged, checks not done.
  view = handoffView(at({ staged: ["src/a.ts", "src/b.ts"], checks: "running" }), 4);
  assert.equal(view.stage, "checking");
  assert.equal(view.title, "Checking the change to 2 files…");
  assert.deepEqual(states(at({ staged: ["a"], checks: null })), ["done", "done", "active", "todo"]);

  view = handoffView(at({ staged: ["src/a.ts"], checks: "clear", replies: 5 }), 4);
  assert.equal(view.stage, "ready");
  assert.equal(view.title, "Ready: 1 file changed and checked, safe to apply.");
  assert.deepEqual(states(at({ staged: ["a"], checks: "clear" })), [
    "done",
    "done",
    "done",
    "active",
  ]);

  view = handoffView(at({ staged: ["a"], checks: "clear" }), 4, "applied");
  assert.equal(view.stage, "applied");
  assert.deepEqual(states(at({}), 4, "applied"), ["done", "done", "done", "done"]);
  assert.equal(handoffView(at({}), 4, "discarded").stage, "discarded");
});

test("what goes wrong is said, and stops the steps where it did", () => {
  const failed = at({ staged: ["a"], checks: "failed", detail: "Types: 'x' is not a number" });
  assert.equal(handoffView(failed, 4).stage, "failed");
  assert.equal(
    handoffView(failed, 4).title,
    "A check failed on the change: Types: 'x' is not a number",
  );
  assert.deepEqual(states(failed), ["done", "done", "failed", "todo"]);

  const notes = at({ staged: ["a", "b"], checks: "clear", notes: 2 });
  assert.equal(handoffView(notes, 4).stage, "notes");
  assert.equal(handoffView(notes, 4).title, "Ready, with 2 notes from Composer to read first.");

  const blocked = at({ blocked: "Sign in to run Composer." });
  assert.equal(handoffView(blocked, 4).stage, "blocked");
  assert.equal(handoffView(blocked, 4).title, "Sign in to run Composer.");
  assert.deepEqual(states(blocked), ["failed", "todo", "todo", "todo"]);
});

test("Composer answering without a change is told apart from not having started", () => {
  // A reply from before the hand-off is not its answer.
  assert.equal(handoffView(at({ latest: "Old reply" }), 4).stage, "sent");
  const answered = at({ replies: 5, latest: "Nothing to change: it already works." });
  assert.equal(handoffView(answered, 4).stage, "answered");
  assert.equal(
    handoffView(answered, 4).title,
    "Composer answered: Nothing to change: it already works.",
  );
  assert.equal(
    handoffView(at({ replies: 5 }), 4).title,
    "Composer finished without changing a file.",
  );
});
