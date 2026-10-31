import assert from "node:assert/strict";
import { test } from "node:test";
import { quiet } from "./quiet.ts";

test("@mentions in text the bot did not write are made inert, and stay readable", () => {
  assert.equal(quiet("thanks @alice and @bob!"), "thanks @\u200balice and @\u200bbob!");
  assert.equal(quiet("@acme/core please look"), "@\u200bacme/core please look");
  assert.equal(quiet("(@carol)"), "(@\u200bcarol)");
  // Not mentions: emails, a lone @, decorators inside a word, a path.
  assert.equal(quiet("mail ada@example.com"), "mail ada@example.com");
  assert.equal(quiet("an @ sign"), "an @ sign");
  assert.equal(quiet("see src/@types/node"), "see src/@types/node");
  // Twice is the same as once, so a box still matches its hidden summary.
  assert.equal(quiet(quiet("hi @alice")), quiet("hi @alice"));
});

test("an HTML comment opener cannot hide the rest of the bot's comment", () => {
  assert.equal(quiet("before <!-- after"), "before <\u200b!-- after");
  assert.equal(quiet(quiet("<!--")), quiet("<!--"));
});
