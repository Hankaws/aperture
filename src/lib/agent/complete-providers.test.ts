import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

/** The module imports without extensions, as the app does: load it from a bundle. */
async function load(): Promise<typeof import("./complete.server.ts")> {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = mkdtempSync(join(tmpdir(), "aperture-complete-"));
  process.on("exit", () => rmSync(out, { recursive: true, force: true }));
  await build({
    input: { complete: join(here, "complete.server.ts") },
    platform: "node",
    cwd: join(here, "../../.."),
    output: { dir: out, format: "cjs", entryFileNames: "[name].cjs" },
    logLevel: "silent",
  });
  return createRequire(join(out, "complete.cjs"))("./complete.cjs");
}
const { complete, completeStreaming } = await load();

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

/** Anthropic's Messages API, in memory: answers with `reply` and records each request. */
function anthropic(reply: Record<string, unknown> | unknown[] | string, status = 200) {
  const sent: Sent[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    return typeof reply === "string"
      ? new Response(reply, { headers: { "content-type": "text/event-stream" } })
      : new Response(JSON.stringify(reply), {
          status,
          headers: { "content-type": "application/json" },
        });
  }) as typeof fetch;
  return { sent, restore: () => (globalThis.fetch = real) };
}

const cfg = { provider: "anthropic" as const, apiKey: "test-key" };
const ask = [
  { role: "system" as const, content: "You fix code." },
  { role: "user" as const, content: "Show prices in dollars." },
];

test("Claude is asked on the current model, with room to think and a fallback on a decline", async () => {
  const api = anthropic({
    content: [
      { type: "thinking", thinking: "", signature: "s" },
      { type: "text", text: "Done." },
      { type: "tool_use", id: "t1", name: "set_plan", input: { entries: [] } },
    ],
    stop_reason: "tool_use",
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  try {
    const out = await complete(cfg, ask, true);
    assert.equal(out.content, "Done.");
    assert.equal(out.tool_calls?.[0]?.function.name, "set_plan");
    const [req] = api.sent;
    assert.equal(req!.url, "https://api.anthropic.com/v1/messages");
    assert.equal(req!.body.model, "claude-opus-5-5");
    assert.ok(Number(req!.body.max_tokens) >= 16000);
    assert.deepEqual(req!.body.output_config, { effort: "medium" });
    assert.equal(req!.body.fallbacks, "default");
    assert.equal(req!.body.temperature, undefined);
    assert.equal(req!.body.thinking, undefined);
    assert.equal(req!.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
  } finally {
    api.restore();
  }
});

test("a request Claude declines says so, instead of an empty answer", async () => {
  const api = anthropic({
    content: [],
    stop_reason: "refusal",
    stop_details: { type: "refusal", category: "cyber", explanation: "" },
  });
  try {
    await assert.rejects(
      complete(cfg, ask, false),
      /^Error: Claude declined this request \(cyber\)\./,
    );
  } finally {
    api.restore();
  }
  const stream = anthropic(
    [
      `data: ${JSON.stringify({ type: "message_start", message: {} })}`,
      `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "refusal", stop_details: { category: null } } })}`,
      "",
    ].join("\n\n"),
  );
  try {
    await assert.rejects(
      completeStreaming(cfg, ask, false, () => {}),
      /^Error: Claude declined this request\. /,
    );
    assert.equal(stream.sent[0]!.body.model, "claude-opus-5-5");
    assert.equal(stream.sent[0]!.body.stream, true);
  } finally {
    stream.restore();
  }
});

test("a provider's refusal says what it said, never the key", async () => {
  const gemini = { provider: "gemini" as const, apiKey: "AIza-secret" };
  const api = anthropic(
    [
      {
        error: {
          code: 404,
          message: "models/x is not found for key AIza-secret.\n Call ListModels.",
        },
      },
    ],
    404,
  );
  try {
    await assert.rejects(
      complete(gemini, ask, false),
      (error: Error & { status?: number }) =>
        /^gemini refused the request \(404\): models\/x is not found for key \[key\]\. Call ListModels\.$/.test(
          error.message,
        ) && error.status === 404,
    );
    assert.equal(api.sent[0]!.body.model, "gemini-3.8-flash");
  } finally {
    api.restore();
  }
  const claude = anthropic(
    { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
    401,
  );
  try {
    await assert.rejects(
      complete(cfg, ask, false),
      /^Error: anthropic refused the request \(401\): invalid x-api-key$/,
    );
  } finally {
    claude.restore();
  }
});

test("a reply that is not JSON says what came back, not 'Unexpected token'", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("OK\r\n", { headers: { "content-type": "text/plain" } })) as typeof fetch;
  try {
    await assert.rejects(
      complete({ provider: "openai", apiKey: "k" }, ask, false),
      /^Error: openai answered with something that is not a model's reply: "OK"\. Check the address and the model name\.$/,
    );
  } finally {
    globalThis.fetch = real;
  }
});
