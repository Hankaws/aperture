import assert from "node:assert/strict";
import { test } from "node:test";
import { botChatSystem } from "./chat.ts";
import { FOLLOW_UPS, followUpRules, replyFollowUps } from "./follow-ups.ts";
import { privateSystem } from "./private-chat.ts";

test("a reply's suggestions come out of its text, each once, at most three", () => {
  const out = replyFollowUps(
    [
      "Here's your plan.",
      "",
      "[[ask: Turn this into a checklist]]",
      "[[ask:  Explain   step 2 ]]",
      "[[ask: turn this into a checklist]]",
      "[[ask: ]]",
      `[[ask: ${"x".repeat(FOLLOW_UPS.chars + 1)}]]`,
      "[[ask: Plan next week too]]",
      "[[ask: A fourth one]]",
    ].join("\n"),
  );
  assert.equal(out.text, "Here's your plan.");
  assert.deepEqual(out.asks, [
    "Turn this into a checklist",
    "Explain step 2",
    "Plan next week too",
  ]);
});

test("markers inside a line leave the line, and a reply without any is untouched", () => {
  assert.deepEqual(replyFollowUps("Done. [[ask: What next?]] [[ask: Why?]]"), {
    text: "Done.",
    asks: ["What next?", "Why?"],
  });
  assert.deepEqual(replyFollowUps("- [[ask: Show #7]]\nCI is green."), {
    text: "CI is green.",
    asks: ["Show #7"],
  });
  const plain = "Use `arr[0]` and [[go:editor]]\n\n  indented";
  assert.deepEqual(replyFollowUps(plain), { text: plain, asks: [] });
});

test("both chats tell the model how to suggest what to ask next", () => {
  assert.match(followUpRules(["A", "B"]), /\[\[ask: A\]\] \[\[ask: B\]\]/);
  assert.match(privateSystem("2026-11-19"), /\[\[ask: Turn this into a checklist\]\]/);
  assert.match(botChatSystem("acme/shop", "2026-11-19"), /\[\[ask: Send that as a task\]\]/);
});
