import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_MS, quoteRun, quoteRuns, replayQuote, sessionLive, sessionSnapshot, type QuoteAccount } from "./cost.ts";

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

test("a cap block says so, so the editor links to Limits; a missing key links to Models", () => {
  const spent = { ...hosted, session: { ...hosted.session, cents: 95 } };
  assert.equal(quoteRun(spent, "hosted").capped, true);
  assert.equal(quoteRuns(spent, "hosted", 3).capped, true);
  assert.equal(quoteRuns({ ...hosted, session: { ...hosted.session, cents: 80 } }, "hosted", 3).capped, true);
  const noKey = quoteRun({ ...hosted, keys: { ...hosted.keys, grok: { set: false, last4: null } } }, "hosted");
  assert.equal(noKey.blocked, true);
  assert.equal(noKey.capped, undefined);
  assert.equal(quoteRun(hosted, "hosted").capped, undefined);
});

test("a session counts for 24 hours from its start", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms);
  assert.equal(sessionLive(ago(0), now), true);
  assert.equal(sessionLive(ago(SESSION_MS - 60_000), now), true);
  assert.equal(sessionLive(ago(SESSION_MS + 60_000), now), false);
  assert.equal(sessionLive(ago(SESSION_MS + 60_000).toISOString(), now), false);
  assert.equal(sessionLive(null, now), false);
  assert.equal(sessionLive("not a date", now), false);
  assert.equal(sessionLive(new Date(now + 2 * 60_000), now), false);
});

test("an expired session reads as empty, so its cap no longer blocks a send", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  const row = { on: true, capTurns: 8, capCents: 100, turns: 7, cents: 95 };
  const live = sessionSnapshot({ ...row, startedAt: new Date(now - 60 * 60_000) }, now);
  assert.equal(live.cents, 95);
  assert.equal(live.resetsAt, new Date(now - 60 * 60_000 + SESSION_MS).toISOString());
  assert.equal(quoteRun({ ...hosted, session: live }, "hosted").blocked, true);

  const expired = sessionSnapshot({ ...row, startedAt: new Date(now - SESSION_MS - 1) }, now);
  assert.deepEqual([expired.turns, expired.cents, expired.resetsAt], [0, 0, null]);
  assert.equal(quoteRun({ ...hosted, session: expired }, "hosted").blocked, false);

  const never = sessionSnapshot({ ...row, startedAt: null }, now);
  assert.equal(never.cents, 0);
});

test("the cap message says how to get going again", () => {
  const spent = { ...hosted, session: { ...hosted.session, cents: 95 } };
  assert.match(quoteRun(spent, "hosted").blockReason ?? "", /reset it in Settings → Limits/);
  assert.match(quoteRuns(spent, "hosted", 3).blockReason ?? "", /reset it in Settings → Limits/);
});
