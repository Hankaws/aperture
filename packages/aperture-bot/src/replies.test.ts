import assert from "node:assert/strict";
import { test } from "node:test";
import type { Command } from "./event.ts";
import { notDoneReply, pullBody, titleFor } from "./replies.ts";
import type { BotResult } from "./run.ts";

const command: Command = {
  number: 12,
  isPull: false,
  title: "Cart total is wrong",
  body: "",
  task: "Fix the total for discounts",
  commentId: 1,
  author: "ada",
  owner: "acme",
  repo: "shop",
  defaultBranch: "main",
};

const result = (more: Partial<BotResult> = {}): BotResult => ({
  outcome: "clear",
  summary: "Fixed the discount.",
  plan: [{ id: "p1", content: "Read the cart", status: "completed", priority: "medium" }],
  written: ["src/cart.ts"],
  refused: [],
  check: {
    rows: [
      { id: "parse", label: "Parses", status: "pass", detail: "1 file parses." },
      { id: "types", label: "Types", status: "pass", detail: "No errors | none." },
    ],
    meta: { changed: 1, deleted: 0, notChecked: [] },
    verdict: "clear",
    exitCode: 0,
    text: "",
  },
  checks: 1,
  usage: "1,000 input and 50 output tokens in 2 model calls",
  text: "",
  ...more,
});

test("the title is the task's first line, or the issue's title when the task is the default", () => {
  assert.equal(titleFor(command), "Fix the total for discounts");
  assert.equal(
    titleFor({ ...command, task: "Do what this issue asks: Cart total is wrong" }),
    "Cart total is wrong",
  );
  assert.equal(titleFor({ ...command, task: "x".repeat(100) }).length, 72);
});

test("the pull request says who asked, what it fixes, the plan and the checks", () => {
  const body = pullBody(command, result(), "https://run", "in a container with no network");
  assert.equal(
    body,
    [
      "@ada asked in #12:",
      "",
      "> Fix the total for discounts",
      "",
      "Fixes #12",
      "",
      "**Plan**",
      "- Read the cart",
      "",
      "**Aperture Agent Check**: nothing red.",
      "",
      "| | Check | Result |",
      "|---|---|---|",
      "| ✓ | Parses | 1 file parses. |",
      "| ✓ | Types | No errors \\| none. |",
      "",
      "<details><summary>What the agent said</summary>",
      "",
      "Fixed the discount.",
      "",
      "</details>",
      "",
      "Tests ran in a container with no network. Used 1,000 input and 50 output tokens in 2 model calls. [The run](https://run) · [Aperture Bot](https://aperturesais.grok.me)",
    ].join("\n"),
  );
  assert.doesNotMatch(pullBody({ ...command, isPull: true }, result(), "r", null), /Fixes #/);
});

test("a stopped run says it pushed nothing, and why", () => {
  const reply = notDoneReply(
    result({
      outcome: "stopped",
      error: "Stopped at the token budget: 120 of 100 tokens used.",
      check: null,
    }),
    "",
    "https://run",
    null,
  );
  assert.match(
    reply,
    /^I stopped before the change was finished, and pushed nothing\.\n\n> Stopped at the token budget/,
  );
  assert.match(reply, /Tests were not run\./);
  assert.doesNotMatch(reply, /```diff/);
});
