import assert from "node:assert/strict";
import { test } from "node:test";
import { isSealed, sealBody, sealKey } from "../../../packages/aperture-bot/src/seal.ts";
import { strikeIdea, struckIdeas, unstrikeIdea } from "./struck.ts";
import { summaryMarker } from "./summary.ts";
import { tickedTask } from "../../../packages/aperture-bot/src/suggestions.ts";

const NEXT = ["Round half cents up in src/price.ts", "Add a test for formatPrice"];
const reply = [
  "**Ideas from the code**",
  "- [ ] Round half cents up in src/price.ts",
  "- [ ] Add a test for formatPrice",
  "",
  summaryMarker({
    v: 1,
    state: "clear",
    kind: "look",
    asked: 0,
    run: "https://github.com/acme/shop/actions/runs/1",
    next: NEXT,
  }),
].join("\n");

test("dismissing strikes the idea's box out, and restoring puts it back", () => {
  const struck = strikeIdea(reply, "Add a test for formatPrice")!;
  assert.match(struck, /\n- ~~Add a test for formatPrice~~ · dismissed\n/);
  assert.match(struck, /\n- \[ \] Round half cents up in src\/price\.ts\n/);
  assert.deepEqual(struckIdeas(struck, NEXT), ["Add a test for formatPrice"]);
  assert.deepEqual(struckIdeas(reply, NEXT), []);
  // Already struck, or not there: nothing to change.
  assert.equal(strikeIdea(struck, "Add a test for formatPrice"), null);
  assert.equal(strikeIdea(reply, "Something else"), null);
  const back = unstrikeIdea(struck, "Add a test for formatPrice")!;
  assert.equal(back, reply);
  assert.equal(unstrikeIdea(reply, "Add a test for formatPrice"), null);
});

test("a started idea is not dismissed, and a struck one cannot be ticked", () => {
  const started = reply.replace(
    "- [ ] Add a test for formatPrice",
    "- [x] Add a test for formatPrice · started by @ada, [the run](https://x)",
  );
  assert.equal(strikeIdea(started, "Add a test for formatPrice"), null);
  const struck = strikeIdea(reply, "Round half cents up in src/price.ts")!;
  const ticked = struck.replace("- [ ] Add a test", "- [x] Add a test");
  assert.equal(tickedTask(struck, ticked, NEXT), "Add a test for formatPrice");
  // Only struck text that is one of the reply's own ideas counts.
  assert.deepEqual(struckIdeas("- ~~Not an idea of ours~~ · dismissed", NEXT), []);
});

test("striking leaves the reply's signature good: only its boxes change", () => {
  const key = sealKey("model-key");
  const thread = { repo: "acme/shop", number: 3 };
  const signed = sealBody(reply, key, thread);
  const struck = strikeIdea(signed, "Add a test for formatPrice")!;
  assert.ok(isSealed(struck, key, thread));
  assert.ok(isSealed(unstrikeIdea(struck, "Add a test for formatPrice")!, key, thread));
});
