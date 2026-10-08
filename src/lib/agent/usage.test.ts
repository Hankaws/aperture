import assert from "node:assert/strict";
import test from "node:test";
import { anthropicUsage, openAiUsage } from "./usage.ts";

test("OpenAI-compatible usage is read from prompt and completion tokens", () => {
  assert.deepEqual(openAiUsage({ usage: { prompt_tokens: 1200, completion_tokens: 80 } }), {
    input: 1200,
    output: 80,
  });
  assert.equal(openAiUsage({}), undefined);
  assert.deepEqual(openAiUsage({ usage: { prompt_tokens: "lots", completion_tokens: -3 } }), {
    input: 0,
    output: 0,
  });
});

test("Anthropic usage counts cache reads and writes as input", () => {
  assert.deepEqual(
    anthropicUsage({
      usage: {
        input_tokens: 40,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 500,
        output_tokens: 120,
      },
    }),
    { input: 9540, output: 120 },
  );
  assert.equal(anthropicUsage({}), undefined);
});
