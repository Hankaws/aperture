import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { cleanMemory, MEMORY_LIMITS, MEMORY_RULES, memoryPrompt, replyMemories } from "./memory.ts";
import {
  forgetAll,
  forgetMemory,
  keepMemory,
  listMemories,
  proposeMemories,
  type Query,
} from "./memory-store.ts";

test("a reply's offers to remember come out of its text: two at most, each once, never a secret", () => {
  const out = replyMemories(
    [
      "Noted: TypeScript it is.",
      "",
      "[[remember: Prefers TypeScript over JavaScript.]]",
      "[[remember: prefers typescript over javascript.]]",
      "[[remember: Their password is hunter2]]",
      "[[remember: Ships the shop on Fridays.]]",
      "[[remember: A third one.]]",
    ].join("\n"),
  );
  assert.equal(out.text, "Noted: TypeScript it is.");
  assert.deepEqual(out.proposed, [
    "Prefers TypeScript over JavaScript.",
    "Ships the shop on Fridays.",
  ]);
  assert.deepEqual(replyMemories("Just an answer."), { text: "Just an answer.", proposed: [] });
});

test("a line is cleaned to keep: one line, short, and never a key", () => {
  assert.equal(cleanMemory("  - Works\n in  Bangkok "), "Works in Bangkok");
  assert.equal(cleanMemory("   "), null);
  assert.equal(cleanMemory("Their OpenRouter key is sk-or-v1-abcdefgh1234"), null);
  assert.equal(cleanMemory("The api key is in 1Password"), null);
  assert.ok(cleanMemory("x".repeat(400))!.length <= MEMORY_LIMITS.chars);
});

test("the bot is told how to offer a line, and knows only the lines kept", () => {
  assert.equal(memoryPrompt([]), MEMORY_RULES);
  assert.match(MEMORY_RULES, /\[\[remember: /);
  assert.match(MEMORY_RULES, /Never offer to remember a password, key, token/);
  const prompt = memoryPrompt([
    { id: "1", text: "Prefers TypeScript.", status: "kept", at: "" },
    { id: "2", text: "Not agreed yet.", status: "pending", at: "" },
  ]);
  assert.match(prompt, /each line kept by them[^\n]*\n- Prefers TypeScript\.$/);
  assert.doesNotMatch(prompt, /Not agreed yet/);
});

async function database(): Promise<{ q: Query; close: () => Promise<void> }> {
  const pg = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  return {
    q: async (text, params) => (await pg.query<Record<string, unknown>>(text, params)).rows,
    close: () => pg.close(),
  };
}

test("lines wait for the person, are kept or edited by them, and only theirs", async () => {
  const { q, close } = await database();
  try {
    const [first] = await proposeMemories(q, "ada", "private:ada", ["Prefers TypeScript."]);
    assert.equal(first!.status, "pending");
    // Offered again: not a second line.
    assert.deepEqual(await proposeMemories(q, "ada", "private:ada", ["prefers typescript."]), []);
    // Someone else cannot keep or forget it.
    assert.equal(await keepMemory(q, "eve", first!.id), false);
    await forgetMemory(q, "eve", first!.id);
    assert.equal((await listMemories(q, "ada", "private:ada")).length, 1);
    // Kept as edited; an edit to nothing (or a secret) is refused.
    assert.equal(await keepMemory(q, "ada", first!.id, "sk-live-123456789"), false);
    assert.equal(await keepMemory(q, "ada", first!.id, "Prefers TypeScript, strict mode."), true);
    assert.deepEqual(
      (await listMemories(q, "ada", "private:ada")).map((m) => [m.text, m.status]),
      [["Prefers TypeScript, strict mode.", "kept"]],
    );
    // Each bot's lines are its own.
    await proposeMemories(q, "ada", "bot123456789012", ["Ships on Fridays."]);
    assert.equal((await listMemories(q, "ada", "private:ada")).length, 1);
    await forgetMemory(q, "ada", first!.id);
    assert.equal((await listMemories(q, "ada", "private:ada")).length, 0);
    await forgetAll(q, "ada", "bot123456789012");
    assert.equal((await listMemories(q, "ada", "bot123456789012")).length, 0);
  } finally {
    await close();
  }
});

test("past the limit of waiting lines, the oldest go", async () => {
  const { q, close } = await database();
  try {
    for (let i = 0; i < MEMORY_LIMITS.pending + 3; i++)
      await proposeMemories(q, "ada", "private:ada", [`Line ${i}.`]);
    const left = await listMemories(q, "ada", "private:ada");
    assert.equal(left.length, MEMORY_LIMITS.pending);
    assert.equal(left.at(-1)!.text, `Line ${MEMORY_LIMITS.pending + 2}.`);
    assert.ok(!left.some((m) => m.text === "Line 0."));
  } finally {
    await close();
  }
});
