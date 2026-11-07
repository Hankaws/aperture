import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_OPTIONS, parseQuestion, questionReply } from "./ask.ts";

test("a question with answers to click: trimmed, each once, at most four", () => {
  assert.deepEqual(
    parseQuestion({
      question: "  Which   currency\nshould prices show? ",
      options: ["Dollars", " dollars ", "Euros", "", 7, "Pounds", "Yen", "Francs"],
    }),
    { text: "Which currency should prices show?", options: ["Dollars", "Euros", "Pounds", "Yen"] },
  );
  assert.equal(MAX_OPTIONS, 4);
});

test("one option is no choice, a long one is cut, and a question is needed", () => {
  assert.deepEqual(parseQuestion({ question: "Name the store?", options: ["cart"] }), {
    text: "Name the store?",
    options: [],
  });
  assert.deepEqual(parseQuestion({ question: "Why?", options: "a,b" }), {
    text: "Why?",
    options: [],
  });
  const long = parseQuestion({ question: "q".repeat(400), options: ["x".repeat(100), "y"] });
  assert.ok(!("error" in long));
  assert.equal(long.text.length, 300);
  assert.equal(long.options[0]!.length, 80);
  assert.ok(long.options[0]!.endsWith("…"));
  assert.deepEqual(parseQuestion({ question: "   " }), { error: "ask_user needs a question." });
});

test("the turn's reply is what the model said, else the question", () => {
  const q = { text: "Dollars or euros?", options: [] };
  assert.equal(questionReply("  I can show either.  ", q), "I can show either.");
  assert.equal(questionReply("", q), "Dollars or euros?");
  assert.equal(questionReply(null, q), "Dollars or euros?");
});
