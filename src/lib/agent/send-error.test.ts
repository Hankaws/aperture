import assert from "node:assert/strict";
import { test } from "node:test";
import { describeSendError, isNetworkError } from "./send-error.ts";

test("a dropped connection, in each browser's words, reads as one plain line", () => {
  for (const message of [
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
    "Load failed",
  ]) {
    assert.equal(isNetworkError(new TypeError(message)), true, message);
    assert.equal(
      describeSendError(new TypeError(message), true),
      "Could not reach Aperture. Check your connection, then press Retry.",
    );
    // No Retry button, no promise of one.
    assert.equal(
      describeSendError(new TypeError(message)),
      "Could not reach Aperture. Check your connection.",
    );
  }
});

test("other failures keep their own message", () => {
  assert.equal(isNetworkError(new Error("Failed to fetch")), false);
  assert.equal(isNetworkError(new TypeError("x is not a function")), false);
  assert.equal(describeSendError(new Error("Session cap reached")), "Session cap reached");
  assert.match(describeSendError(new Error("Unauthorized")), /Sign in to run Composer/);
  assert.equal(describeSendError("nope"), "Request failed");
});
