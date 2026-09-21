import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addWorker,
  availableSeats,
  canConfirm,
  proposeReviewer,
  proposeWorkers,
  selectedSeats,
  toggleWorkerRole,
} from "./crew.ts";
import type { PlanEntry } from "../workspace/types.ts";

const plan = (content: string): PlanEntry => ({ id: content, content, status: "pending" });

const twoKeys = {
  keys: {
    grok: { set: false },
    openai: { set: true },
    anthropic: { set: true },
    gemini: { set: false },
    deepseek: { set: false },
  },
  acp: true,
};

test("availableSeats marks BYOK and ACP readiness", () => {
  const seats = availableSeats(twoKeys);
  assert.equal(seats.find((s) => s.id === "openai")?.ready, true);
  assert.equal(seats.find((s) => s.id === "gemini")?.ready, false);
  assert.equal(seats.find((s) => s.id === "builtin:claude-code")?.ready, true);
  assert.equal(seats.filter((s) => s.label === "Grok").length, 1);
});

test("proposeWorkers assigns Build then Review across Claude and GPT", () => {
  const seats = selectedSeats(availableSeats(twoKeys), ["anthropic", "openai"]);
  const workers = proposeWorkers(
    [plan("Fix src/store.ts listTasks"), plan("Fix src/index.ts bootstrap")],
    ["src/store.ts", "src/index.ts"],
    seats,
  );
  assert.ok(workers.length >= 2);
  assert.equal(workers.some((w) => (w.role ?? "build") === "build"), true);
  assert.equal(workers.some((w) => w.role === "review"), true);
  assert.equal(canConfirm(workers), true);
});

test("one file plan with two seats is Build + Review", () => {
  const seats = selectedSeats(availableSeats(twoKeys), ["anthropic", "openai"]);
  const workers = proposeWorkers([plan("Fix src/store.ts listTasks")], ["src/store.ts"], seats);
  assert.equal(workers.length, 2);
  assert.equal(workers[0]?.role ?? "build", "build");
  assert.equal(workers[1]?.role, "review");
});

test("toggleWorkerRole flips Build and Review", () => {
  const seats = selectedSeats(availableSeats(twoKeys), ["anthropic"]);
  const workers = addWorker([], seats, ["src/store.ts", "src/index.ts"], [plan("Do the work")]);
  const next = toggleWorkerRole(workers, 0, seats);
  assert.equal(next[0]?.role, "review");
});

test("proposeReviewer picks a different seat when it can", () => {
  const seats = selectedSeats(availableSeats(twoKeys), ["anthropic", "openai"]);
  const [reviewer] = proposeReviewer(["src/store.ts"], seats, "anthropic");
  assert.equal(reviewer?.role, "review");
  assert.equal(reviewer?.source, "openai");
});

test("Grok Build appears as a crew seat alongside the other ACP agents", () => {
  const seats = availableSeats(twoKeys);
  const grokBuild = seats.find((s) => s.id === "builtin:grok-build");
  assert.equal(grokBuild?.kind, "acp");
  assert.equal(grokBuild?.label, "Grok Build");
  assert.equal(grokBuild?.ready, true);
  // The hosted xAI model seat is labelled "Grok" — the agent seat must not
  // collide with it or be mistaken for it.
  assert.equal(seats.filter((s) => s.label === "Grok").length, 1);
  assert.equal(seats.filter((s) => s.kind === "acp").length, 4);
});
