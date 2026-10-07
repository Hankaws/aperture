import assert from "node:assert/strict";
import { test } from "node:test";
import { threadContext } from "./context.ts";
import { parseEvent, taskFrom } from "./event.ts";

test("only a comment that starts with the trigger is a task", () => {
  assert.equal(taskFrom("/aperture fix the cart"), "fix the cart");
  assert.equal(taskFrom("  /Aperture   fix it\nwith care"), "fix it\nwith care");
  assert.equal(taskFrom("/aperture"), "");
  assert.equal(taskFrom("/aperturex fix"), null);
  assert.equal(taskFrom("please /aperture fix"), null);
  assert.equal(taskFrom("!bot go", "!bot"), "go");
});

const payload = (more: Record<string, unknown> = {}) => ({
  action: "created",
  comment: { id: 9, body: "/aperture add a currency", user: { login: "ada", type: "User" } },
  issue: { number: 3, title: "Prices", body: "They show cents." },
  repository: { name: "shop", owner: { login: "acme" }, default_branch: "trunk" },
  ...more,
});

test("an issue comment becomes a command with everything the run needs", () => {
  const parsed = parseEvent("issue_comment", payload());
  assert.ok("command" in parsed);
  assert.deepEqual(parsed.command, {
    number: 3,
    isPull: false,
    title: "Prices",
    body: "They show cents.",
    task: "add a currency",
    commentId: 9,
    author: "ada",
    owner: "acme",
    repo: "shop",
    defaultBranch: "trunk",
  });
  const bare = parseEvent(
    "issue_comment",
    payload({ comment: { id: 9, body: "/aperture", user: { login: "ada", type: "User" } } }),
  );
  assert.ok("command" in bare);
  assert.equal(bare.command.task, "Do what this issue asks: Prices");
});

test("everything else is ignored, with the reason", () => {
  const ignored = (name: string, p: unknown) => {
    const parsed = parseEvent(name, p);
    assert.ok("ignored" in parsed, JSON.stringify(p));
    return parsed.ignored;
  };
  assert.match(ignored("pull_request", payload()), /answers issue comments/);
  assert.match(ignored("issue_comment", payload({ action: "edited" })), /not edits/);
  assert.match(
    ignored(
      "issue_comment",
      payload({ comment: { id: 9, body: "/aperture go", user: { login: "x[bot]", type: "Bot" } } }),
    ),
    /from bots/,
  );
  assert.match(ignored("issue_comment", payload({ repository: {} })), /missing/);
});

test("the thread is the issue and its recent comments, not the bot's or the asking one", () => {
  const command = parseEvent("issue_comment", payload());
  assert.ok("command" in command);
  const text = threadContext(
    command.command,
    [
      { id: 1, author: "bo", authorType: "User", body: "Use the locale's currency." },
      { id: 2, author: "aperture-bot", authorType: "Bot", body: "I opened #4." },
      { id: 9, author: "ada", authorType: "User", body: "/aperture add a currency" },
    ],
    "diff --git a/x b/x",
  );
  assert.equal(
    text,
    "Issue #3: Prices\n\nThey show cents.\n\nComments, oldest first:\n\n@bo: Use the locale's currency.\n\nThe pull request's diff:\ndiff --git a/x b/x",
  );
});
