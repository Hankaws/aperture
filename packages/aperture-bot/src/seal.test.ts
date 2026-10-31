import assert from "node:assert/strict";
import { test } from "node:test";
import { readSummary, summaryMarker, type BotSummary } from "../../../src/lib/bot/summary.ts";
import { isSealed, sealBody, sealKey, suggestionSig } from "./seal.ts";

const KEY = sealKey("model-key")!;
const THREAD = { repo: "acme/shop", number: 7 };

const reply = (summary: Partial<BotSummary> = {}) =>
  [
    "formatPrice returns cents.",
    "",
    "- [ ] Show prices in dollars",
    "",
    summaryMarker({
      v: 1,
      state: "clear",
      kind: "answer",
      asked: 55,
      run: "https://github.com/acme/shop/actions/runs/41",
      next: ["Show prices in dollars"],
      ...summary,
    }),
  ].join("\n");

test("sealKey derives a key from the model key, and none from nothing", () => {
  assert.equal(sealKey(""), null);
  assert.equal(KEY.length, 32);
  assert.notDeepEqual(KEY, Buffer.from("model-key"));
  assert.deepEqual(sealKey("model-key"), KEY);
});

test("a signed list reads back signed, for its thread only", () => {
  const body = sealBody(reply(), KEY, THREAD);
  const s = readSummary(body)!;
  assert.match(s.sig!, /^[0-9a-f]{32}$/);
  assert.deepEqual(s.next, ["Show prices in dollars"]);
  assert.equal(s.asked, 55, "the rest of the summary is untouched");
  assert.ok(isSealed(body, KEY, THREAD));
  assert.ok(isSealed(body, KEY, { repo: "ACME/Shop", number: 7 }), "owner and name in any case");
  assert.ok(!isSealed(body, KEY, { repo: "acme/shop", number: 8 }));
  assert.ok(!isSealed(body, KEY, { repo: "acme/other", number: 7 }));
  assert.ok(!isSealed(body, sealKey("another-key"), THREAD));
  assert.ok(!isSealed(body, null, THREAD));
  // The visible text is as it was.
  assert.equal(body.split("<!-- aperture-bot ")[0], reply().split("<!-- aperture-bot ")[0]);
});

test("a list changed after signing, or never signed, is not sealed", () => {
  const body = sealBody(reply(), KEY, THREAD);
  assert.ok(!isSealed(reply(), KEY, THREAD));
  assert.ok(!isSealed(body.replace('"Show prices in dollars"', '"Delete the tests"'), KEY, THREAD));
  // A signature borrowed from another list.
  const other = sealBody(reply({ next: ["Add a test"] }), KEY, THREAD);
  const sig = readSummary(other)!.sig!;
  assert.ok(!isSealed(reply({ sig }), KEY, THREAD));
  assert.ok(!isSealed(reply({ sig: "0".repeat(32) }), KEY, THREAD));
});

test("signing again replaces the signature, and edits keep the list signed", () => {
  const once = sealBody(reply(), KEY, THREAD);
  const twice = sealBody(once, KEY, THREAD);
  assert.equal(twice, once);
  assert.equal(twice.match(/"sig"/g)!.length, 1);
  // Marking a box started edits the text, not the list: still signed.
  const started = once.replace(
    "- [ ] Show prices in dollars",
    "- [x] Show prices in dollars · started",
  );
  assert.ok(isSealed(sealBody(started, KEY, THREAD), KEY, THREAD));
  // Signed with another key, then by this bot: this bot's signature wins.
  const resigned = sealBody(sealBody(reply(), sealKey("old")!, THREAD), KEY, THREAD);
  assert.ok(isSealed(resigned, KEY, THREAD));
});

test("bodies without suggestions, or without a key, are left as they are", () => {
  const none = reply({ next: undefined });
  assert.equal(sealBody(none, KEY, THREAD), none);
  assert.equal(sealBody("Plain text, no summary.", KEY, THREAD), "Plain text, no summary.");
  assert.equal(sealBody(reply(), null, THREAD), reply());
  assert.ok(!isSealed(none, KEY, THREAD));
});

test("the signature covers the list exactly as a tick reads it", () => {
  const long = "x".repeat(400);
  const body = sealBody(reply({ next: [long] }), KEY, THREAD);
  const read = readSummary(body)!.next!;
  assert.equal(read[0]!.length, 300, "clipped as the summary clips it");
  assert.equal(readSummary(body)!.sig, suggestionSig(KEY, THREAD, read));
});
