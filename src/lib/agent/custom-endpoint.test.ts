import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanCustomModel, isMetadataAddress, isPrivateAddress, localEndpointsAllowed, normalizeCustomBase } from "./custom-endpoint.ts";
import { assertFetchableBase } from "./custom-endpoint.server.ts";

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
  assert.equal(isPrivateAddress("::ffff:a9fe:a9fe"), true);
  assert.equal(isPrivateAddress("[::ffff:169.254.169.254]"), true);
  assert.equal(isMetadataAddress("169.254.169.254"), true);
  assert.equal(isMetadataAddress("metadata.google.internal"), true);
  assert.equal(isMetadataAddress("10.0.0.1"), false);
});

test("cleanCustomModel allows vendor/name and rejects blanks", () => {
  assert.equal(cleanCustomModel("openai/gpt-4o-mini"), "openai/gpt-4o-mini");
  assert.equal(cleanCustomModel(" llama3.1 "), "llama3.1");
  assert.equal(cleanCustomModel(""), null);
  assert.equal(cleanCustomModel("has space"), null);
});

test("loopback endpoints are for local dev only, unless the server opts in", async () => {
  assert.equal(localEndpointsAllowed({ NODE_ENV: "development" }), true);
  assert.equal(localEndpointsAllowed({ NODE_ENV: "production" }), false);
  assert.equal(localEndpointsAllowed({ NODE_ENV: "development", VERCEL: "1" }), false);
  assert.equal(localEndpointsAllowed({ NODE_ENV: "production", APERTURE_LOCAL_ENDPOINTS: "1" }), true);
  assert.equal(localEndpointsAllowed({ NODE_ENV: "development", APERTURE_LOCAL_ENDPOINTS: "0" }), false);

  const ollama = "http://127.0.0.1:11434/v1";
  assert.equal(await assertFetchableBase(ollama, { NODE_ENV: "development" }), ollama);
  await assert.rejects(assertFetchableBase(ollama, { NODE_ENV: "production" }), /your own machine/);
  await assert.rejects(assertFetchableBase("http://localhost:1234/v1", { VERCEL: "1" }), /your own machine/);
});
