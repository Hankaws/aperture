import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MASCOT } from "./mascot.ts";
import { botChatSystem } from "./chat.ts";
import {
  FOCUSES,
  PERSONALITY_MAX,
  cleanName,
  cleanPersonality,
  profileFrom,
  rosterOrder,
} from "./team.ts";

const row = (over: Record<string, unknown> = {}) => ({
  id: "a1b2c3d4e5f6a7b8c9",
  name: "Iris",
  repo: "acme/shop",
  mascot: '{"color":"teal","body":"iris","face":"wink"}',
  personality: "Keep CI green.",
  model: "anthropic",
  last_line: "You: what's\nred?",
  created_at: new Date("2026-10-01T10:00:00Z"),
  updated_at: "2026-10-02T10:00:00Z",
  ...over,
});

test("a stored row reads back as a profile, its mascot parsed", () => {
  assert.deepEqual(profileFrom(row()), {
    id: "a1b2c3d4e5f6a7b8c9",
    name: "Iris",
    repo: "acme/shop",
    mascot: { color: "teal", body: "iris", face: "wink" },
    personality: "Keep CI green.",
    model: "anthropic",
    allow: "ask",
    lastLine: "You: what's red?",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
  });
  assert.deepEqual(profileFrom(row({ mascot: "{broken" }))!.mascot, DEFAULT_MASCOT);
  // A model it cannot run on (the browser's local one, or anything unknown) is the account's choice.
  assert.equal(profileFrom(row({ model: "local" }))!.model, "");
  assert.equal(profileFrom(row({ model: undefined, last_line: undefined }))!.lastLine, "");
  // Its rule: checks may send themselves; anything else, or none, asks first.
  assert.equal(profileFrom(row({ allow: "checks" }))!.allow, "checks");
  assert.equal(profileFrom(row({ allow: "everything" }))!.allow, "ask");
});

test("a row that is not a profile is dropped", () => {
  assert.equal(profileFrom(row({ id: "x" })), null);
  assert.equal(profileFrom(row({ repo: "not a repo" })), null);
  assert.equal(profileFrom(row({ name: "  \n " })), null);
});

test("names are one line, instructions keep their lines, both are cut", () => {
  assert.equal(cleanName("  Iris\n the\tbot  "), "Iris the bot");
  assert.equal(cleanName("x".repeat(80)).length, 40);
  assert.equal(cleanPersonality("a\r\nb\u0007\n\n\n\nc"), "a\nb \n\nc");
  assert.equal(cleanPersonality("y".repeat(2000)).length, PERSONALITY_MAX);
});

test("the roster keeps the order bots were made in", () => {
  const a = profileFrom(row({ id: "aaaaaaaaaaaa", created_at: "2026-10-03T00:00:00Z" }))!;
  const b = profileFrom(row({ id: "bbbbbbbbbbbb", created_at: "2026-10-01T00:00:00Z" }))!;
  assert.deepEqual(
    rosterOrder([a, b]).map((x) => x.id),
    ["bbbbbbbbbbbb", "aaaaaaaaaaaa"],
  );
});

test("each focus gives instructions, and the chat follows the bot's name and instructions", () => {
  assert.equal(new Set(FOCUSES.map((f) => f.id)).size, FOCUSES.length);
  assert.ok(FOCUSES.every((f) => f.personality.length > 40));
  const plain = botChatSystem("acme/shop", "2026-10-09");
  assert.match(
    plain,
    /^You are Aperture Bot, talking with a maintainer of the GitHub repository acme\/shop\./,
  );
  assert.doesNotMatch(plain, /<instructions>/);
  const iris = botChatSystem("acme/shop", "2026-10-09", {
    name: "Iris",
    instructions: "Keep CI green.",
  });
  assert.match(iris, /^You are Iris, one of the maintainer's Aperture Bots, talking with/);
  assert.match(iris, /<instructions>\nKeep CI green\.\n<\/instructions>/);
  // The rules about GitHub's text still come last, after the person's instructions.
  assert.ok(iris.indexOf("<instructions>") < iris.indexOf("<github> tags"));
});
