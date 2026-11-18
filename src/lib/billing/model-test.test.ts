import assert from "node:assert/strict";
import { test } from "node:test";
import { TEST_MESSAGES, testError, testLine } from "./model-test.ts";

test("a test asks as little as a model can answer", () => {
  assert.equal(TEST_MESSAGES.length, 2);
  assert.match(String(TEST_MESSAGES[0]!.content), /single word OK/);
});

test("a test's result reads as Settings shows it", () => {
  assert.equal(testLine({ ok: true, ms: 1234 }), "Works: it answered in 1.2 s.");
  assert.equal(testLine({ ok: true, ms: 12_600 }), "Works: it answered in 13 s.");
  const refused =
    "Endpoint refused the request (401): No cookie auth credentials found It needs an API key: add the endpoint's key in Settings, on the Models tab.";
  assert.equal(testLine({ ok: false, error: refused }), refused);
});

test("a test that runs out of time says so; any other error is passed on", () => {
  const late = Object.assign(new Error("The operation was aborted due to timeout"), {
    name: "TimeoutError",
  });
  assert.equal(
    testError(late),
    "No answer in 30 s. The endpoint may be down, or too slow for the model.",
  );
  assert.equal(
    testError(new Error("openai refused the request (429).")),
    "openai refused the request (429).",
  );
  assert.equal(testError("odd"), "The model could not answer.");
});
