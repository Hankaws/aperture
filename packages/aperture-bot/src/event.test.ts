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
    via: "comment",
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
  assert.match(ignored("pull_request", payload()), /answers comments, its label and its schedule/);
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

const labelled = (more: Record<string, unknown> = {}) => ({
  action: "labeled",
  label: { name: "aperture" },
  sender: { login: "grace", type: "User" },
  issue: { number: 4, title: "Add a currency", body: "Let the shop pick one." },
  repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
  ...more,
});

test("the bot's label on an issue asks for what the issue says, for whoever added it", () => {
  const parsed = parseEvent("issues", labelled());
  assert.ok("command" in parsed);
  assert.deepEqual(parsed.command, {
    number: 4,
    isPull: false,
    title: "Add a currency",
    body: "Let the shop pick one.",
    task: "Do what this issue asks: Add a currency",
    commentId: null,
    author: "grace",
    via: "label",
    owner: "acme",
    repo: "shop",
    defaultBranch: "main",
  });
  assert.ok("command" in parseEvent("issues", labelled({ label: { name: "Aperture" } })));
  assert.ok(
    "command" in parseEvent("issues", labelled({ label: { name: "bot" } }), "/aperture", "bot"),
  );
  const why = (p: unknown) => {
    const out = parseEvent("issues", p);
    assert.ok("ignored" in out);
    return out.ignored;
  };
  assert.match(why(labelled({ label: { name: "bug" } })), /the label bug is not aperture/);
  assert.match(why(labelled({ action: "unlabeled" })), /only an added label/);
  assert.match(why(labelled({ sender: { login: "x[bot]", type: "Bot" } })), /added by bots/);
  assert.match(
    why(labelled({ issue: { number: 4, title: "t", pull_request: {} } })),
    /only asks on issues/,
  );
});

test("the schedule and a manual run are standing jobs", () => {
  assert.deepEqual(parseEvent("schedule", {}), { scheduled: true });
  assert.deepEqual(parseEvent("workflow_dispatch", {}), { scheduled: true });
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
