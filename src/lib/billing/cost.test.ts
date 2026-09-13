import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteRun, quoteRuns, type QuoteAccount } from "./cost.ts";

const hosted: QuoteAccount = {
  remaining: 40,
  hostedTurns: 50,
  modelSource: "hosted",
  keys: {
    grok: { set: false, last4: null },
    openai: { set: false, last4: null },
    anthropic: { set: false, last4: null },
    gemini: { set: false, last4: null },
    deepseek: { set: false, last4: null },
  },
  session: { on: true, capTurns: 8, capCents: 100, turns: 1, cents: 0 },
};

test("quoteRun is one hosted turn", () => {
  const q = quoteRun(hosted, "hosted");
  assert.equal(q.label, "This run = 1 hosted turn");
  assert.equal(q.blocked, false);
});

test("quoteRuns scales hosted turns and session room", () => {
  const two = quoteRuns(hosted, "hosted", 2);
  assert.equal(two.label, "This build = 2 hosted turns");
  assert.equal(two.blocked, false);

  const tight: QuoteAccount = {
    ...hosted,
    remaining: 1,
  };
  const blocked = quoteRuns(tight, "hosted", 2);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.blockReason ?? "", /Need 2 hosted turns/);
});

test("signed-out quoteRuns still names the turns", () => {
  const q = quoteRuns(null, "hosted", 2);
  assert.equal(q.label, "This build = 2 hosted turns");
  assert.equal(q.blocked, true);
});
