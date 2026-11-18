import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS } from "./private-chat.ts";
import { hasModel, tourProgress, tourSteps } from "./tour.ts";

test("the tour's three steps tick themselves off from what the account says", () => {
  const fresh = tourSteps({ modelKey: false, github: false, bots: 0 });
  assert.deepEqual(
    fresh.map((s) => [s.id, s.title, s.done]),
    [
      ["model-key", "Add a model key", false],
      ["github", "Connect GitHub", false],
      ["new-bot", "Make your first bot", false],
    ],
  );
  assert.deepEqual(tourProgress(fresh), { done: 0, total: 3, next: fresh[0] });
  // Done out of order: the next is the first still open.
  const some = tourSteps({ modelKey: false, github: true, bots: 2 });
  assert.equal(tourProgress(some).done, 2);
  assert.equal(tourProgress(some).next?.id, "model-key");
  const all = tourSteps({ modelKey: true, github: true, bots: 1 });
  assert.deepEqual(tourProgress(all), { done: 3, total: 3, next: null });
  // Each step's button is one of the chat's, so it opens the same place.
  for (const step of fresh) assert.ok(Object.hasOwn(ACTIONS, step.id), step.id);
});

test("a model is a saved key, or a custom endpoint with its model and a key, unless it is local", () => {
  const none = { base: null, model: null, keySet: false };
  assert.equal(hasModel({ keyCount: 0, custom: none }), false);
  assert.equal(hasModel({ keyCount: 1, custom: none }), true);
  const openrouter = { base: "https://openrouter.ai/api/v1", model: "x/y" };
  // OpenRouter with no key refuses every answer ("No cookie auth credentials found").
  assert.equal(hasModel({ keyCount: 0, custom: { ...openrouter, keySet: false } }), false);
  assert.equal(hasModel({ keyCount: 0, custom: { ...openrouter, keySet: true } }), true);
  // Ollama and LM Studio on the person's machine need none.
  for (const base of ["http://127.0.0.1:11434/v1", "http://localhost:1234/v1"])
    assert.equal(
      hasModel({ keyCount: 0, custom: { base, model: "m", keySet: false } }),
      true,
      base,
    );
  assert.equal(
    hasModel({ keyCount: 0, custom: { base: "https://x.test/v1", model: null, keySet: true } }),
    false,
  );
});
