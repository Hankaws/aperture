import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanCustomModel, isPrivateAddress, normalizeCustomBase } from "./custom-endpoint.ts";

test("normalizeCustomBase accepts the three presets and strips a completions suffix", () => {
  assert.equal(normalizeCustomBase("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1");
  assert.equal(normalizeCustomBase("http://localhost:1234/v1/"), "http://localhost:1234/v1");
  assert.equal(
    normalizeCustomBase("https://openrouter.ai/api/v1/chat/completions"),
    "https://openrouter.ai/api/v1",
  );
});

test("normalizeCustomBase rejects remote http and private https", () => {
  assert.equal(normalizeCustomBase("http://evil.example/v1"), null);
  assert.equal(normalizeCustomBase("http://169.254.169.254/"), null);
  assert.equal(normalizeCustomBase("https://127.0.0.1/v1"), null);
  assert.equal(normalizeCustomBase("https://192.168.1.2/v1"), null);
  assert.equal(normalizeCustomBase("file:///etc/passwd"), null);
});

test("isPrivateAddress covers metadata and carrier-grade NAT", () => {
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("100.64.0.1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
});

test("cleanCustomModel allows vendor/name and rejects blanks", () => {
  assert.equal(cleanCustomModel("openai/gpt-4o-mini"), "openai/gpt-4o-mini");
  assert.equal(cleanCustomModel(" llama3.1 "), "llama3.1");
  assert.equal(cleanCustomModel(""), null);
  assert.equal(cleanCustomModel("has space"), null);
});
