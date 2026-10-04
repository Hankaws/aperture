import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteRun, quoteRuns, replayQuote, type QuoteAccount } from "./cost.ts";

const hosted: QuoteAccount = {
  remaining: 40,
  hostedTurns: 50,
  modelSource: "hosted",
  keys: {
    grok: { set: true, last4: "1234" },
    openai: { set: false, last4: null },
    anthropic: { set: false, last4: null },
    gemini: { set: false, last4: null },
    deepseek: { set: false, last4: null },
  },
  session: { on: true, capTurns: 8, capCents: 100, turns: 1, cents: 0 },
};

test("quoteRun uses the signed-in user's Grok key", () => {
  const q = quoteRun(hosted, "hosted");
  assert.equal(q.hosted, false);
  assert.equal(q.label, "on your Grok key, ~$0.08");
  assert.equal(q.blocked, false);
});

test("quoteRun blocks Hosted Grok when the user has no Grok key", () => {
  const q = quoteRun(
    { ...hosted, keys: { ...hosted.keys, grok: { set: false, last4: null } } },
    "hosted",
  );
  assert.equal(q.blocked, true);
  assert.match(q.blockReason ?? "", /your Grok key/);
});

test("quoteRuns bills the user's Grok key, not a shared turn pool", () => {
  const two = quoteRuns(hosted, "hosted", 2);
  assert.equal(two.label, "on your Grok key, ~$0.16");
  assert.equal(two.blocked, false);

  const tight: QuoteAccount = {
    ...hosted,
    session: { ...hosted.session, cents: 90 },
  };
  const blocked = quoteRuns(tight, "hosted", 2);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.blockReason ?? "", /session cap/);
});

test("signed-out quoteRuns still names the user's key", () => {
  const q = quoteRuns(null, "hosted", 2);
  assert.equal(q.label, "on your Grok key, ~$0.16");
  assert.equal(q.blocked, true);
});

test("a model on this computer is free, and blocked only until it is set up in this browser", () => {
  const store = new Map<string, string>();
  const realStorage = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  try {
    const before = quoteRun({ ...hosted, modelSource: "local" });
    assert.equal(before.blocked, true);
    assert.match(before.blockReason ?? "", /Settings → Models/);

    store.set("aperture-local-model", JSON.stringify({ base: "http://127.0.0.1:11434/v1", model: "qwen2.5-coder:7b" }));
    const ready = quoteRun({ ...hosted, modelSource: "local" });
    assert.equal(ready.blocked, false);
    assert.equal(ready.cents, 0);
    assert.equal(ready.label, "This computer · qwen2.5-coder:7b");
    // A replay deployment replays hosted models, not the one on this machine.
    assert.equal(replayQuote(ready).label, "This computer · qwen2.5-coder:7b");
    assert.equal(replayQuote(quoteRun(hosted, "hosted")).label, "Replay model");
    assert.equal(quoteRuns({ ...hosted, modelSource: "local" }, "local", 3).label, "This computer · 3 calls");
  } finally {
    (globalThis as { localStorage?: unknown }).localStorage = realStorage;
  }
});
