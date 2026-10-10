import assert from "node:assert/strict";
import { test } from "node:test";
import type { Command } from "./event.ts";
import { readSummary } from "../../../src/lib/bot/summary.ts";
import { doneReply, notDoneReply, pullBody, titleFor, workingReply } from "./replies.ts";
import type { BotResult } from "./run.ts";

const command: Command = {
  number: 12,
  isPull: false,
  title: "Cart total is wrong",
  body: "",
  task: "Fix the total for discounts",
  commentId: 1,
  author: "ada",
  via: "comment",
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
  next: [],
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
    { asked: 9, run: "https://github.com/acme/shop/actions/runs/1", tests: null },
  );
  assert.match(
    reply,
    /^I stopped before the change was finished, and pushed nothing\.\n\n> Stopped at the token budget/,
  );
  assert.match(reply, /Tests were not run\./);
  assert.doesNotMatch(reply, /```diff/);
});

const ctx = { asked: 9, run: "https://github.com/acme/shop/actions/runs/1", tests: null };

test("every reply ends with a hidden summary that reads back as what it says", () => {
  const done = doneReply(
    result(),
    { url: "https://github.com/acme/shop/pull/3", what: "pull" },
    ctx,
  );
  assert.match(
    done,
    /^Opened https:\/\/github\.com\/acme\/shop\/pull\/3, changing `src\/cart\.ts`/,
  );
  assert.match(done, /\n<!-- aperture-bot \{.*\} -->$/);
  assert.deepEqual(readSummary(done), {
    v: 1,
    state: "clear",
    asked: 9,
    run: ctx.run,
    plan: ["Read the cart"],
    checks: [
      { status: "pass", label: "Parses", detail: "1 file parses." },
      { status: "pass", label: "Types", detail: "No errors | none." },
    ],
    files: ["src/cart.ts"],
    link: { url: "https://github.com/acme/shop/pull/3", what: "pull" },
    tests: null,
    usage: "1,000 input and 50 output tokens in 2 model calls",
  });
});

test("the working comment says the phase and round, and links the run", () => {
  const body = workingReply({ phase: "fixing", round: 2, rounds: 2, plan: ["Read the cart"] }, ctx);
  assert.match(
    body,
    /^\*\*Aperture Bot is on it\.\*\* Fixing what Agent Check found \(round 2 of 2\)\.\n\n\*\*Plan\*\*\n- Read the cart\n\n\[Follow the run\]/,
  );
  assert.equal(readSummary(body)?.phase, "fixing");
});

test("text in the summary cannot end the hidden comment early", () => {
  const body = notDoneReply(result({ outcome: "red", error: "bad --> <script>" }), "", ctx);
  const hidden = body.slice(body.lastIndexOf("<!-- aperture-bot "));
  assert.equal(hidden.match(/-->/g)?.length, 1);
  assert.ok(hidden.endsWith(" -->"));
  assert.equal(readSummary(body)?.error, "bad --> <script>");
});

test("a finished run lists what it would do next, and the Bot page reads them back", () => {
  const next = ["Add a test for an empty cart", "Round half cents up"];
  const body = doneReply(
    result({ next }),
    { url: "https://github.com/acme/shop/pull/13", what: "pull" },
    { asked: 1, run: "https://github.com/acme/shop/actions/runs/1", tests: null },
  );
  assert.match(
    body,
    /\*\*Next, I would suggest\*\*\n- Add a test for an empty cart\n- Round half cents up\n\nAsk for one with `\/aperture`/,
  );
  assert.deepEqual(readSummary(body)?.next, next);
  const quiet = doneReply(
    result(),
    { url: "https://github.com/acme/shop/pull/13", what: "pull" },
    { asked: 1, run: "https://github.com/acme/shop/actions/runs/1", tests: null },
  );
  assert.doesNotMatch(quiet, /Next, I would suggest/);
  assert.equal(readSummary(quiet)?.next, undefined);
});
