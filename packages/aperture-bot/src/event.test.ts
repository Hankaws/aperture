import assert from "node:assert/strict";
import { test } from "node:test";
import { threadContext } from "./context.ts";
import { isCheck, parseEvent, taskFrom } from "./event.ts";

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
  assert.match(
    ignored("push", payload()),
    /answers comments, new issues, its label, its schedule, pull requests and red runs/,
  );
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

test("/aperture check asks for Agent Check alone; with more words it is a task", () => {
  const onPull = parseEvent(
    "issue_comment",
    payload({
      comment: { id: 9, body: "/aperture Check.", user: { login: "ada", type: "User" } },
      issue: { number: 3, title: "Prices", body: "", pull_request: {} },
    }),
  );
  assert.ok("command" in onPull);
  assert.equal(onPull.command.check, true);
  assert.equal(onPull.command.task, "Check this pull request");
  const onIssue = parseEvent(
    "issue_comment",
    payload({ comment: { id: 9, body: "/aperture check", user: { login: "ada", type: "User" } } }),
  );
  assert.ok("command" in onIssue);
  assert.equal(onIssue.command.check, true);
  assert.equal(onIssue.command.isPull, false);
  const more = parseEvent(
    "issue_comment",
    payload({
      comment: { id: 9, body: "/aperture check the login flow", user: { login: "ada" } },
      issue: { number: 3, title: "Prices", body: "", pull_request: {} },
    }),
  );
  assert.ok("command" in more);
  assert.equal(more.command.check, undefined);
  assert.equal(more.command.task, "check the login flow");
});

test("a push to a pull request is a check for whoever pushed, but not a draft's or a bot's", () => {
  const pull = (more: Record<string, unknown> = {}) => ({
    action: "synchronize",
    sender: { login: "grace", type: "User" },
    pull_request: { number: 12, title: "Dollars", body: null, draft: false },
    repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
    ...more,
  });
  const parsed = parseEvent("pull_request", pull());
  assert.ok("command" in parsed);
  assert.deepEqual(parsed.command, {
    number: 12,
    isPull: true,
    title: "Dollars",
    body: "",
    task: "Check this pull request",
    commentId: null,
    author: "grace",
    via: "pull",
    check: true,
    owner: "acme",
    repo: "shop",
    defaultBranch: "main",
  });
  assert.ok("ignored" in parseEvent("pull_request", pull({ action: "closed" })));
  assert.ok("ignored" in parseEvent("pull_request", pull({ action: "labeled" })));
  assert.ok(
    "ignored" in
      parseEvent("pull_request", pull({ pull_request: { number: 12, title: "WIP", draft: true } })),
  );
  assert.ok(
    "ignored" in parseEvent("pull_request", pull({ sender: { login: "x[bot]", type: "Bot" } })),
  );
  assert.ok("command" in parseEvent("pull_request", pull({ action: "ready_for_review" })));
});

test("a check is the first line alone: a signature under it is fine, more words make a task", () => {
  assert.equal(isCheck("check\n\n---\n_Sent from my phone_"), true);
  assert.equal(isCheck("  Check!  \nthanks"), true);
  assert.equal(isCheck("check the login flow\nplease"), false);
  assert.equal(isCheck("please\ncheck"), false);
});

test("a question is marked to be answered; a request and a check are not", () => {
  const asked = (body: string) => {
    const parsed = parseEvent(
      "issue_comment",
      payload({ comment: { id: 9, body, user: { login: "ada", type: "User" } } }),
    );
    assert.ok("command" in parsed);
    return parsed.command;
  };
  const question = asked("/aperture why does the cart show 100?");
  assert.equal(question.ask, true);
  assert.equal(question.task, "why does the cart show 100?");
  assert.equal(asked("/aperture can you show dollars?").ask, undefined);
  assert.equal(asked("/aperture add a currency").ask, undefined);
  assert.equal(asked("/aperture").ask, undefined);
  assert.equal(asked("/aperture check").ask, undefined);
});

/** The bot's reply with its suggestions, the second ticked or not. */
const botReply = (
  mark: string,
  summaryNext = ["Add a test for an empty cart", "Round half cents up"],
) =>
  [
    "Opened #8.",
    "",
    "**Next, I would suggest**",
    "- [ ] Add a test for an empty cart",
    `- [${mark}] Round half cents up`,
    "",
    `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", asked: 9, run: "https://github.com/acme/shop/actions/runs/1", next: summaryNext })} -->`,
  ].join("\n");

const tick = (more: Record<string, unknown> = {}) =>
  payload({
    action: "edited",
    sender: { login: "ada", type: "User" },
    comment: {
      id: 900,
      body: botReply("x"),
      user: { login: "github-actions[bot]", type: "Bot" },
    },
    changes: { body: { from: botReply(" ") } },
    ...more,
  });

test("ticking a suggestion in the bot's reply is that task, for whoever ticked it", () => {
  const parsed = parseEvent("issue_comment", tick());
  assert.ok("command" in parsed, JSON.stringify(parsed));
  assert.deepEqual(parsed.command, {
    number: 3,
    isPull: false,
    title: "Prices",
    body: "They show cents.",
    task: "Round half cents up",
    commentId: null,
    author: "ada",
    via: "tick",
    ticked: { commentId: 900, body: botReply("x"), postedBy: null },
    owner: "acme",
    repo: "shop",
    defaultBranch: "trunk",
  });
  // A reply a person posted (a personal token): their words, so they must be able to write too.
  const personal = parseEvent(
    "issue_comment",
    tick({ comment: { id: 900, body: botReply("x"), user: { login: "owner", type: "User" } } }),
  );
  assert.ok("command" in personal);
  assert.equal(personal.command.ticked?.postedBy, "owner");
});

test("an edit that is not a tick of one of the bot's own suggestions is ignored", () => {
  const ignored = (p: unknown) => {
    const parsed = parseEvent("issue_comment", p);
    assert.ok("ignored" in parsed, JSON.stringify(parsed));
    return parsed.ignored;
  };
  // An edit by a bot: the bot's own, marking a line started.
  assert.match(ignored(tick({ sender: { login: "aperture[bot]", type: "Bot" } })), /by bots/);
  // Unticking, or an edit that leaves the boxes as they were.
  assert.match(ignored(tick({ changes: { body: { from: botReply("x") } } })), /ticks none/);
  // A box whose words are not among the suggestions the summary carries.
  assert.match(
    ignored(
      tick({
        comment: {
          id: 900,
          body: botReply("x", ["Add a test for an empty cart"]),
          user: { login: "b", type: "Bot" },
        },
        changes: { body: { from: botReply(" ", ["Add a test for an empty cart"]) } },
      }),
    ),
    /ticks none/,
  );
  // A comment with no summary, or a summary with nothing suggested.
  assert.match(
    ignored(
      tick({
        comment: { id: 900, body: "- [x] Round half cents up", user: { login: "b", type: "Bot" } },
      }),
    ),
    /not edits/,
  );
});

test("a new issue is read unasked, from anyone but a bot", () => {
  const opened = (more: Record<string, unknown> = {}) =>
    parseEvent("issues", {
      action: "opened",
      sender: { login: "visitor", type: "User" },
      issue: { number: 4, title: "Prices show cents", body: "100 for a dollar." },
      repository: { name: "shop", owner: { login: "acme" }, default_branch: "trunk" },
      ...more,
    });
  const parsed = opened();
  assert.ok("command" in parsed);
  assert.deepEqual(parsed.command, {
    number: 4,
    isPull: false,
    title: "Prices show cents",
    body: "100 for a dollar.",
    task: "Read issue #4 and say what you would do: Prices show cents",
    commentId: null,
    author: "visitor",
    via: "issue",
    triage: true,
    owner: "acme",
    repo: "shop",
    defaultBranch: "trunk",
  });
  const byBot = opened({ sender: { login: "dependabot[bot]", type: "Bot" } });
  assert.ok("ignored" in byBot && /by bots/.test(byBot.ignored));
  // The label still asks for the work itself.
  const labelled = parseEvent("issues", {
    action: "labeled",
    label: { name: "aperture" },
    sender: { login: "ada", type: "User" },
    issue: { number: 4, title: "Prices", body: "" },
    repository: { name: "shop", owner: { login: "acme" } },
  });
  assert.ok("command" in labelled && labelled.command.via === "label");
});

test("a workflow red on the default branch is explained; anything else is ignored", () => {
  const run = (more: Record<string, unknown> = {}) => ({
    action: "completed",
    workflow_run: {
      name: "CI",
      conclusion: "failure",
      head_branch: "trunk",
      head_sha: "abc1234def",
      html_url: "https://github.com/acme/shop/actions/runs/77",
      event: "push",
      ...more,
    },
    repository: { name: "shop", owner: { login: "acme" }, default_branch: "trunk" },
  });
  assert.deepEqual(parseEvent("workflow_run", run()), {
    red: {
      workflow: "CI",
      sha: "abc1234def",
      branch: "trunk",
      url: "https://github.com/acme/shop/actions/runs/77",
      owner: "acme",
      repo: "shop",
    },
  });
  assert.ok("red" in parseEvent("workflow_run", run({ conclusion: "timed_out" })));
  const ignored = (p: unknown) => {
    const parsed = parseEvent("workflow_run", p);
    assert.ok("ignored" in parsed, JSON.stringify(parsed));
    return parsed.ignored;
  };
  assert.match(ignored(run({ conclusion: "success" })), /not red/);
  assert.match(ignored(run({ conclusion: "cancelled" })), /not red/);
  assert.match(ignored(run({ head_branch: "feature" })), /on feature, not trunk/);
  assert.match(ignored(run({ event: "pull_request" })), /not trunk/);
  // A fork's branch of the same name.
  assert.match(ignored(run({ head_repository: { full_name: "someone/shop" } })), /not trunk/);
  assert.ok(
    "red" in parseEvent("workflow_run", run({ head_repository: { full_name: "acme/shop" } })),
  );
  assert.match(ignored(run({ name: "Aperture Bot" })), /own runs/);
  assert.match(ignored({ ...run(), action: "requested" }), /finished/);
});

test("/aperture review asks for a review; a sentence that starts with review is a task", () => {
  const parsed = (body: string) => {
    const p = parseEvent(
      "issue_comment",
      payload({
        issue: { number: 3, title: "Prices", body: "", pull_request: {} },
        comment: { id: 9, body, user: { login: "ada", type: "User" } },
      }),
    );
    assert.ok("command" in p);
    return p.command;
  };
  const review = parsed("/aperture review");
  assert.equal(review.review, true);
  assert.equal(review.task, "Review this pull request");
  assert.equal(review.ask, undefined);
  assert.equal(parsed("/aperture Review.\nthanks").review, true);
  const task = parsed("/aperture review the login flow and fix it");
  assert.equal(task.review, undefined);
  assert.equal(task.task, "review the login flow and fix it");
});
