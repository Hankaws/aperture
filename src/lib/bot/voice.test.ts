import assert from "node:assert/strict";
import { test } from "node:test";
import { joinDraft, transcriptOf, VOICE_NOTE, voiceError } from "./voice.ts";

test("what is said goes after what was typed, one space between", () => {
  assert.equal(joinDraft("", "plan my week"), "plan my week");
  assert.equal(joinDraft("Please  ", "  plan   my week "), "Please plan my week");
  assert.equal(joinDraft("Line one\n", "and two"), "Line one and two");
  // Nothing said yet: what was typed stays as it was.
  assert.equal(joinDraft("Typed ", "   "), "Typed ");
});

test("each result's best guess, in order, as one line", () => {
  const results = [
    [{ transcript: "plan my" }, { transcript: "plan me" }],
    [{ transcript: " week " }],
  ];
  assert.equal(transcriptOf(results), "plan my week");
  assert.equal(transcriptOf([]), "");
});

test("the browser's errors say what to do, and stopping on purpose says nothing", () => {
  assert.equal(voiceError("aborted"), null);
  assert.match(voiceError("not-allowed")!, /microphone is blocked/);
  assert.match(voiceError("no-speech")!, /Didn't hear anything/);
  assert.match(voiceError("network")!, /needs a connection/);
  assert.match(voiceError("anything-else")!, /Try again/);
  // Where the voice goes is said, not hidden.
  assert.match(VOICE_NOTE, /Chrome uses Google's speech service, Safari Apple's/);
});
