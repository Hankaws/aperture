import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAction } from "./next-action.ts";

test("nextAction prefers confirm workers over a single build", () => {
  const next = nextAction({
    running: false,
    awaiting: true,
    pending: 0,
    workerCount: 2,
    crewModels: 2,
    keyReady: 2,
    messages: 4,
  });
  assert.equal(next.kind, "workers");
});

test("nextAction asks to connect a second model when keys exist", () => {
  const next = nextAction({
    running: false,
    awaiting: false,
    pending: 0,
    workerCount: 0,
    crewModels: 1,
    keyReady: 2,
    messages: 2,
  });
  assert.equal(next.kind, "crew");
});

test("nextAction offers a reviewer pass on staged diffs", () => {
  const next = nextAction({
    running: false,
    awaiting: false,
    pending: 2,
    workerCount: 0,
    crewModels: 2,
    keyReady: 2,
    messages: 4,
    noteCount: 0,
    reviewerLabel: "GPT",
  });
  assert.equal(next.kind, "reviewer");
  assert.match(next.title, /GPT/);
});

test("nextAction sends notes instead of applying", () => {
  const next = nextAction({
    running: false,
    awaiting: false,
    pending: 1,
    workerCount: 0,
    crewModels: 2,
    keyReady: 2,
    messages: 4,
    noteCount: 2,
  });
  assert.equal(next.kind, "notes");
});

test("nextAction reviews a clear diff once, then applies", () => {
  const base = {
    running: false,
    awaiting: false,
    pending: 1,
    workerCount: 0,
    crewModels: 1,
    keyReady: 1,
    messages: 4,
    checks: "clear" as const,
  };
  const before = nextAction(base);
  assert.equal(before.kind, "reviewer");
  assert.equal(before.cta, "Review");
  assert.equal(before.altKind, "apply");
  const after = nextAction({ ...base, reviewed: true });
  assert.equal(after.kind, "apply");
  assert.equal(after.cta, "Apply");
});

test("nextAction offers to send a failed check back, or apply and remember it", () => {
  const next = nextAction({
    running: false,
    awaiting: false,
    pending: 1,
    workerCount: 0,
    crewModels: 1,
    keyReady: 1,
    messages: 4,
    checks: "failed",
  });
  assert.equal(next.kind, "fix");
  assert.equal(next.cta, "Send back");
  assert.equal(next.altKind, "apply");
  assert.equal(next.altCta, "Apply anyway");
});

test("with the checks in, skipping the review is Apply now, not Apply anyway", () => {
  const clear = {
    running: false,
    awaiting: false,
    pending: 1,
    workerCount: 0,
    crewModels: 1,
    keyReady: 1,
    messages: 4,
    checks: "clear" as const,
  };
  const next = nextAction(clear);
  assert.equal(next.kind, "reviewer");
  assert.equal(next.cta, "Review");
  assert.equal(next.altKind, "apply");
  assert.equal(next.altCta, "Apply now");
  assert.equal(nextAction({ ...clear, copies: 2 }).altCta, "Keep now");
});

test("nextAction keeps reviewing while checks are still running", () => {
  const next = nextAction({
    running: false,
    awaiting: false,
    pending: 1,
    workerCount: 0,
    crewModels: 1,
    keyReady: 1,
    messages: 4,
    checks: "running",
  });
  assert.equal(next.kind, "review");
});

test("nextAction says the check verdict itself once the checks are in, not a second vaguer line", () => {
  const base = { running: false, awaiting: false, pending: 1, workerCount: 0, crewModels: 1, keyReady: 1, messages: 3, noteCount: 0 };
  const safe = nextAction({ ...base, checks: "clear", verdict: "Safe to apply: all 5 checks passed" });
  assert.equal(safe.kind, "reviewer");
  assert.equal(safe.title, "Safe to apply: all 5 checks passed. Review the diff?");
  assert.equal(safe.tone, "ok");
  const held = nextAction({ ...base, checks: "failed", verdict: "Held back: this change fails 2 of 6 checks" });
  assert.equal(held.kind, "fix");
  assert.equal(held.title, "Held back: this change fails 2 of 6 checks");
  assert.equal(held.tone, "danger");
  assert.equal(held.altCta, "Apply anyway");
  const applied = nextAction({ ...base, checks: "clear", reviewed: true, verdict: "Safe to apply: all 5 checks passed" });
  assert.equal(applied.kind, "apply");
  assert.equal(applied.title, "Safe to apply: all 5 checks passed");
});

test("nextAction keeps its own words when there is no verdict yet", () => {
  const base = { running: false, awaiting: false, pending: 1, workerCount: 0, crewModels: 1, keyReady: 1, messages: 3, noteCount: 0 };
  const safe = nextAction({ ...base, checks: "clear" });
  assert.equal(safe.title, "Checks done. Review the diff?");
  assert.equal(safe.tone, undefined);
});
