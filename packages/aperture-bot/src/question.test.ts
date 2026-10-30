import assert from "node:assert/strict";
import { test } from "node:test";
import { isQuestion, questionText } from "./question.ts";

test("a question is answered; a request, even a polite one, is a task", () => {
  for (const asked of [
    "why does the cart show 100?",
    "What does formatPrice return",
    "how are prices rounded",
    "explain this pull request",
    "Summarize the open bugs",
    "is the checkout test flaky?",
    "the login test fails on main, is it the new session code?",
    "ask: which files read the session cookie",
    "Ask where prices are rounded",
  ])
    assert.equal(isQuestion(asked), true, asked);
  for (const asked of [
    "Show prices in dollars",
    "fix the login test",
    "Can you add a dark mode?",
    "could you round half cents up?",
    "please would you rename formatPrice?",
    "",
    "check",
    // Only the first line says what kind of ask it is.
    "Add a currency\nWhy: the shop sells in euros?",
  ])
    assert.equal(isQuestion(asked), false, asked);
});

test("an explicit ask is how it was asked, not part of the question", () => {
  assert.equal(questionText("ask: which files read the cookie"), "which files read the cookie");
  assert.equal(questionText("  Ask why it fails "), "why it fails");
  assert.equal(questionText("why does it fail?"), "why does it fail?");
  assert.equal(questionText("ask"), "ask");
});
