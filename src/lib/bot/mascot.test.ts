import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_MASCOT,
  MASCOT_BODIES,
  MASCOT_COLOR_NAMES,
  MASCOT_FACES,
  faceFor,
  mascotFor,
  mascotFrom,
  mascotSvg,
  shade,
  suggestName,
} from "./mascot.ts";

test("a stored mascot is read back as it was, and anything unknown falls back", () => {
  assert.deepEqual(mascotFrom({ color: "teal", body: "iris", face: "wink" }), {
    color: "teal",
    body: "iris",
    face: "wink",
  });
  assert.deepEqual(mascotFrom({ color: "<script>", body: 3, face: null }), DEFAULT_MASCOT);
  assert.deepEqual(mascotFrom("nope"), DEFAULT_MASCOT);
});

test("the face follows the mood, and idle wears the bot's own", () => {
  const m = { ...DEFAULT_MASCOT, face: "wink" as const };
  assert.equal(faceFor(m, "idle"), "wink");
  assert.equal(faceFor(m, "thinking"), "curious");
  assert.equal(faceFor(m, "working"), "focused");
  assert.equal(faceFor(m, "done"), "happy");
  assert.equal(faceFor(m, "stuck"), "worried");
});

test("every body, face and colour draws, with its ids kept to safe characters", () => {
  for (const body of MASCOT_BODIES)
    for (const face of MASCOT_FACES)
      for (const color of MASCOT_COLOR_NAMES) {
        const svg = mascotSvg({ body, face, color }, { id: ':r1:"x' });
        assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
        assert.match(svg, /<\/svg>$/);
        assert.doesNotMatch(svg, /undefined|NaN|"x|:r1:/);
        assert.ok(svg.includes('id="r1x-g"'));
      }
});

test("the moving parts are marked only when asked, and match the mood", () => {
  const still = mascotSvg(DEFAULT_MASCOT, { mood: "working" });
  assert.doesNotMatch(still, /class=/);
  assert.match(
    mascotSvg(DEFAULT_MASCOT, { mood: "working", animate: true }),
    /class="mascot-turn"/,
  );
  assert.match(
    mascotSvg(DEFAULT_MASCOT, { mood: "thinking", animate: true }),
    /class="mascot-bob"/,
  );
  assert.match(mascotSvg(DEFAULT_MASCOT, { animate: true }), /class="mascot-blink"/);
  // Closed eyes do not blink.
  assert.doesNotMatch(
    mascotSvg({ ...DEFAULT_MASCOT, face: "happy" }, { animate: true }),
    /mascot-blink/,
  );
});

test("a seed always gives the same mascot, names are offered in turn, colours shade", () => {
  assert.deepEqual(mascotFor("acme/shop"), mascotFor("acme/shop"));
  assert.equal(suggestName([]), "Iris");
  assert.equal(suggestName(["iris", "Patch"]), "Lumen");
  assert.equal(suggestName([], 2), "Lumen");
  assert.equal(shade("#000000", 1), "#ffffff");
  assert.equal(shade("#ffffff", -1), "#000000");
  assert.equal(shade("#7C5CFF", 0), "#7c5cff");
});
