import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_LIMITS } from "./chat.ts";
import {
  ACTIONS,
  APERTURE_GUIDE,
  replyActions,
  PRIVATE_SUGGESTIONS,
  privateChatId,
  privateMessages,
  privateReply,
  privateSystem,
  replyBlocks,
} from "./private-chat.ts";

test("the private chat is the person's own assistant: no repository, nothing posted, no tools", () => {
  const system = privateSystem("2026-11-18");
  assert.match(system, /the person's own assistant, in a private chat/);
  assert.match(system, /Today is 2026-11-18\./);
  assert.match(system, /belongs to no repository, and nothing said here is posted anywhere/);
  assert.match(system, /cannot browse the web, run code, or see their files/);
  assert.match(system, /Never invent facts, links or quotes/);
  // A repository's work is the Bot page's and the editor's, not this chat's.
  assert.match(system, /the Bot page has a bot for each repository/);
  assert.doesNotMatch(system, /propose_task|GitHub repository \S+\/\S+/);
});

test("the model reads the latest turns, each clipped, after the rules", () => {
  const turns = Array.from({ length: CHAT_LIMITS.turns + 5 }, (_, i) => ({
    role: i % 2 ? ("assistant" as const) : ("user" as const),
    text: `turn ${i}`,
  }));
  turns.push({ role: "user", text: "x".repeat(CHAT_LIMITS.turnChars + 50) });
  turns.push({ role: "assistant", text: "   " });
  const messages = privateMessages(turns, "2026-11-18");
  assert.equal(messages[0]!.role, "system");
  assert.equal(messages[0]!.cache, true);
  // The blank turn is left out; the oldest beyond the limit too.
  assert.equal(messages.length, CHAT_LIMITS.turns);
  assert.equal(messages[1]!.content, "turn 7");
  assert.match(String(messages.at(-1)!.content), /\n… \(cut\)$/);
});

test("an empty answer still says something, and each person has one private chat", () => {
  assert.equal(privateReply("  Sure.  "), "Sure.");
  assert.equal(privateReply(""), "I have nothing to add to that.");
  assert.equal(privateReply(null), "I have nothing to add to that.");
  assert.equal(privateChatId("u_123"), "private:u_123");
});

test("a reply keeps its numbered lists as lists, and code as it is", () => {
  const blocks = replyBlocks(
    [
      "Here is a plan:",
      "",
      "1. Write the outline",
      "2. Draft each part",
      "   with examples",
      "3) Edit",
      "",
      "- a bullet",
      "",
      "```ts",
      "1. not a list",
      "```",
      "Done.",
    ].join("\n"),
  );
  assert.deepEqual(blocks, [
    { type: "p", text: "Here is a plan:" },
    {
      type: "ol",
      start: 1,
      items: ["Write the outline", "Draft each part with examples", "Edit"],
    },
    { type: "ul", items: ["a bullet"] },
    { type: "code", lang: "ts", text: "1. not a list" },
    { type: "p", text: "Done." },
  ]);
  assert.deepEqual(replyBlocks("4. Fourth\n5. Fifth"), [
    { type: "ol", start: 4, items: ["Fourth", "Fifth"] },
  ]);
});

test("it shows someone new around Aperture, in the words of the site's own pages and buttons", () => {
  const system = privateSystem("2026-11-18");
  assert.ok(system.includes(APERTURE_GUIDE));
  for (const words of [
    "Settings, on the Models tab",
    "connect GitHub first",
    'under "Your bots", press + (New bot)',
    "Name, pick the repository it Looks after, and say How it works",
    "chat bubble appears in the corner of every page",
    "Open, in the top bar",
    "`.aperture/skills/`",
    "say so rather than guess",
  ])
    assert.ok(APERTURE_GUIDE.includes(words), words);
  assert.equal(PRIVATE_SUGGESTIONS[0], "How do I make my first bot?");
});

test("a reply's buttons: the places the site has, each once, at most three, out of the text", () => {
  const out = replyActions(
    [
      "First, add your model key, then make a bot.",
      "",
      "[[go:model-key]]",
      "- [[go:new-bot]]",
      "[[go:model-key]] [[go:nowhere]] [[go:constructor]]",
      "Or open the editor: [[go:editor]] it checks every change.",
      "[[go:pricing]]",
    ].join("\n"),
  );
  assert.deepEqual(out.actions, [
    { id: "model-key", label: "Add a model key" },
    { id: "new-bot", label: "Make a bot" },
    { id: "editor", label: "Open the editor" },
  ]);
  assert.equal(
    out.text,
    "First, add your model key, then make a bot.\n\nOr open the editor: it checks every change.",
  );
  // No markers: the text as it was, and no buttons.
  assert.deepEqual(replyActions("Just an answer.\n\n- a point"), {
    text: "Just an answer.\n\n- a point",
    actions: [],
  });
});

test("the model is told every button, by the marker the chat reads, and no other", () => {
  const system = privateSystem("2026-11-18");
  for (const id of Object.keys(ACTIONS)) assert.ok(system.includes(`[[go:${id}]]`), id);
  assert.equal(system.match(/\[\[go:/g)?.length, Object.keys(ACTIONS).length);
  assert.match(system, /never make up another/);
});

test("what it remembers rides in its own instructions, after the cached rules", () => {
  const turns = [{ role: "user" as const, text: "Hi" }];
  // A visitor, with nowhere to keep anything: no memory at all.
  assert.deepEqual(
    privateMessages(turns, "2026-11-18").map((m) => m.role),
    ["system", "user"],
  );
  const withMemory = privateMessages(turns, "2026-11-18", [
    { id: "1", text: "Prefers TypeScript.", status: "kept", at: "" },
  ]);
  assert.deepEqual(
    withMemory.map((m) => [m.role, Boolean(m.cache)]),
    [
      ["system", true],
      ["system", false],
      ["user", false],
    ],
  );
  assert.match(String(withMemory[1]!.content), /\[\[remember: /);
  assert.match(String(withMemory[1]!.content), /- Prefers TypeScript\.$/);
});
