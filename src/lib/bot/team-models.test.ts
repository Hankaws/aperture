import assert from "node:assert/strict";
import { test } from "node:test";
import { modelChoices, modelLabel, type ModelAccount } from "./team-models.ts";

const account = (over: Partial<ModelAccount> = {}): ModelAccount => ({
  modelSource: "hosted",
  keys: {
    grok: { set: true },
    openai: { set: false },
    anthropic: { set: true },
    gemini: { set: false },
    deepseek: { set: false },
  },
  custom: { base: null, model: null },
  ...over,
});

test("a bot can talk on the account's choice, any saved key, or the custom endpoint", () => {
  assert.deepEqual(modelChoices(account()), [
    { id: "", label: "Default (Grok)" },
    { id: "grok", label: "Grok" },
    { id: "anthropic", label: "Claude" },
  ]);
  const custom = account({
    modelSource: "custom",
    custom: { base: "https://openrouter.ai/api/v1", model: "qwen/qwen3-coder" },
  });
  assert.deepEqual(modelChoices(custom).at(0), { id: "", label: "Default (qwen/qwen3-coder)" });
  assert.deepEqual(modelChoices(custom).at(-1), { id: "custom", label: "qwen/qwen3-coder" });
  assert.equal(
    modelChoices(account({ modelSource: "local" }))[0]!.label,
    "Default (a local model, not for bots: pick one)",
  );
});

test("a model whose key is gone says so", () => {
  const choices = modelChoices(account());
  assert.equal(modelLabel(choices, "anthropic"), "Claude");
  assert.equal(modelLabel(choices, "openai"), "GPT (no key)");
  assert.equal(modelLabel(choices, "custom"), "Custom endpoint (not set)");
});
