import assert from "node:assert/strict";
import { test } from "node:test";
import { bundled } from "./test-bundle.ts";

test("settings come from flags, and the key only from APERTURE_MODEL_KEY", async () => {
  const { main } = await bundled();
  const options = main.parseArgs(
    ["run", "--task", "Fix the cart", "--sandbox", "none", "--max-tokens", "5000", "--rounds", "3"],
    { APERTURE_MODEL_KEY: "xai-key" },
  );
  assert.equal(options.task, "Fix the cart");
  assert.deepEqual(options.model, { provider: "grok", apiKey: "xai-key" });
  assert.equal(options.sandbox?.kind, "none");
  assert.equal(options.maxTokens, 5000);
  assert.equal(options.rounds, 3);
  assert.equal(options.testScript, "test");
  assert.equal(options.timeoutMs, 600_000);
});

test("a missing task, key or endpoint is a clear error", async () => {
  const { main } = await bundled();
  assert.throws(
    () => main.parseArgs(["run"], { APERTURE_MODEL_KEY: "k" }),
    /--task or --task-file/,
  );
  assert.throws(() => main.parseArgs(["run", "--task", "x"], {}), /APERTURE_MODEL_KEY/);
  assert.throws(
    () => main.parseArgs(["run", "--task", "x", "--provider", "custom"], {}),
    /--base-url and --model/,
  );
  assert.throws(
    () =>
      main.parseArgs(["run", "--task", "x", "--provider", "llama"], { APERTURE_MODEL_KEY: "k" }),
    /--provider must be one of/,
  );
  assert.throws(() => main.parseArgs(["fix"], {}), /Usage: aperture-bot run --task/);
});
