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

test("nextAction applies once the checks are clear", () => {
  const next = nextAction({
    running: false,
    awaiting: false,
    pending: 1,
    workerCount: 0,
    crewModels: 2,
    keyReady: 2,
    messages: 4,
    checks: "clear",
  });
  assert.equal(next.kind, "apply");
  assert.equal(next.cta, "Apply");
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
