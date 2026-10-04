import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanLocalModel,
  listLocalModels,
  localFailure,
  localHost,
  LocalModelError,
  normalizeLocalBase,
  parseLocalModel,
} from "./local-model.ts";

test("only an address on this machine is accepted", () => {
  assert.equal(normalizeLocalBase("http://127.0.0.1:11434/v1/"), "http://127.0.0.1:11434/v1");
  assert.equal(normalizeLocalBase("http://localhost:1234/v1/chat/completions"), "http://localhost:1234/v1");
  assert.equal(normalizeLocalBase("http://[::1]:11434/v1"), "http://[::1]:11434/v1");
  for (const bad of [
    "http://192.168.1.20:11434/v1",
    "http://10.0.0.7/v1",
    "https://openrouter.ai/api/v1",
    "http://169.254.169.254/latest",
    "file:///etc/passwd",
    "http://user:pass@127.0.0.1:11434/v1",
    "http://127.0.0.1:11434/v1?x=1",
    "not a url",
  ]) {
    assert.equal(normalizeLocalBase(bad), null, bad);
  }
  assert.equal(cleanLocalModel(" qwen2.5-coder:7b "), "qwen2.5-coder:7b");
  assert.equal(cleanLocalModel("bad model"), null);
  assert.deepEqual(parseLocalModel('{"base":"http://127.0.0.1:11434/v1","model":"llama3.1"}'), {
    base: "http://127.0.0.1:11434/v1",
    model: "llama3.1",
  });
  assert.equal(parseLocalModel('{"base":"http://10.0.0.1/v1","model":"x"}'), null);
  assert.equal(parseLocalModel("{nope"), null);
});

function sse(events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

test("a streamed turn from a local model: text as it arrives, tool calls assembled, nothing extra sent", async () => {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return sse([
      { choices: [{ delta: { content: "Reading " } }] },
      { choices: [{ delta: { content: "the store." } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "read_file", arguments: '{"pa' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'th":"src/store.ts"}' } }] } }] },
    ]);
  }) as typeof fetch;
  try {
    const host = localHost({ base: "http://127.0.0.1:11434/v1", model: "qwen2.5-coder:7b" });
    const pieces: string[] = [];
    const out = await host.completeStreaming(
      { provider: "custom", apiKey: "" },
      [{ role: "system", content: "rules", cache: true }, { role: "user", content: "hi" }],
      true,
      (delta) => pieces.push(delta),
      undefined,
      [],
    );
    assert.deepEqual(pieces, ["Reading ", "the store."]);
    assert.equal(out.content, "Reading the store.");
    assert.deepEqual(out.tool_calls, [
      { id: "c1", type: "function", function: { name: "read_file", arguments: '{"path":"src/store.ts"}' } },
    ]);
    assert.equal(sent[0]!.url, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(sent[0]!.init.credentials, "omit");
    const body = JSON.parse(String(sent[0]!.init.body)) as { model: string; stream: boolean; messages: Array<Record<string, unknown>> };
    assert.equal(body.model, "qwen2.5-coder:7b");
    assert.equal(body.stream, true);
    assert.ok(body.messages.every((message) => !("cache" in message)), "the prompt-cache marker is not sent");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a missing model and an unreachable server each say what to do", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{"error":"model \\"nope\\" not found"}', { status: 404 })) as typeof fetch;
  try {
    const host = localHost({ base: "http://127.0.0.1:11434/v1", model: "nope" });
    await assert.rejects(host.complete({ provider: "custom", apiKey: "" }, [], false), (error: unknown) => {
      assert.ok(error instanceof LocalModelError);
      assert.match(error.message, /ollama pull nope/);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
  const unreachable = localFailure("http://127.0.0.1:11434/v1", "https://aperture.example", new TypeError("Failed to fetch"));
  assert.match(unreachable, /Could not reach your model at http:\/\/127\.0\.0\.1:11434\/v1/);
  assert.match(unreachable, /OLLAMA_ORIGINS=https:\/\/aperture\.example/);
});

test("the model list comes from the server's /models", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    assert.equal(url, "http://127.0.0.1:11434/v1/models");
    return Response.json({ data: [{ id: "llama3.1:latest" }, { id: "qwen2.5-coder:7b" }, { id: "bad name" }, {}] });
  }) as typeof fetch;
  try {
    assert.deepEqual(await listLocalModels("http://127.0.0.1:11434/v1"), ["llama3.1:latest", "qwen2.5-coder:7b"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
