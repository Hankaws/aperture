import assert from "node:assert/strict";
import { test } from "node:test";
import {
  briefMessage,
  isSlackWebhook,
  postToSlack,
  pullMessage,
  redMessage,
  slackEscape,
  slackLines,
  slackLink,
} from "./slack.ts";

const HOOK = "https://hooks.slack.com/services/T000/B000/abcDEF123";

test("only a Slack incoming webhook is posted to", () => {
  assert.ok(isSlackWebhook(HOOK));
  assert.ok(isSlackWebhook("https://hooks.slack-gov.com/services/T1/B2/x"));
  for (const url of [
    "http://hooks.slack.com/services/T/B/x",
    "https://hooks.slack.com.evil.dev/services/T/B/x",
    "https://evil.dev/?u=https://hooks.slack.com/services/T/B/x",
    "https://hooks.slack.com/services/T/B/x?redirect=https://evil.dev",
    "",
  ])
    assert.ok(!isSlackWebhook(url), url);
});

test("words from GitHub or the model cannot ping or link", () => {
  assert.equal(
    slackEscape("<!channel> & <https://evil.dev|click>"),
    "&lt;!channel&gt; &amp; &lt;https://evil.dev|click&gt;",
  );
  assert.equal(
    slackLink("https://github.com/acme/shop/pull/8", "Fix <!here> | now"),
    "<https://github.com/acme/shop/pull/8|Fix &lt;!here&gt; ¦ now>",
  );
  assert.deepEqual(
    slackLines([
      "- ✗ main is red at abc1234: test.",
      "- **Pull requests opened**: 1 (1 merged)",
      "- #8 [Show dollars](https://evil.dev) <!channel>",
    ]),
    [
      "• ✗ main is red at abc1234: test.",
      "• *Pull requests opened*: 1 (1 merged)",
      "• #8 Show dollars &lt;!channel&gt;",
    ],
  );
});

test("the brief, a red run and an unasked pull request read well in Slack", () => {
  const brief = briefMessage({
    repo: "acme/shop",
    repoUrl: "https://github.com/acme/shop",
    branch: "main",
    sha: "abc1234def",
    needs: ["- ✓ main is green at abc1234."],
    week: ["- **Answered**: 2 (2 questions)"],
    ideas: 3,
    url: "https://github.com/acme/shop/issues/3#issuecomment-9",
  });
  assert.equal(
    brief,
    [
      "*Daily brief* · <https://github.com/acme/shop|acme/shop> on main at abc1234",
      "• ✓ main is green at abc1234.",
      "",
      "*Last 7 days*",
      "• *Answered*: 2 (2 questions)",
      "",
      "3 ideas from the code: <https://github.com/acme/shop/issues/3#issuecomment-9|the brief>",
    ].join("\n"),
  );
  const red = redMessage({
    repo: "acme/shop",
    repoUrl: "https://github.com/acme/shop",
    workflow: "CI",
    branch: "main",
    sha: "abc1234def",
    run: "https://github.com/acme/shop/actions/runs/5",
    why: "formatPrice returns cents   (src/price.ts:2).",
    url: "https://github.com/acme/shop/issues/4#issuecomment-10",
    fixing: true,
  });
  assert.match(
    red,
    /^\*CI is red\* on <https:\/\/github\.com\/acme\/shop\|acme\/shop> main at abc1234 · <https:\/\/github\.com\/acme\/shop\/actions\/runs\/5\|the run>\n/,
  );
  assert.match(red, /\nformatPrice returns cents \(src\/price\.ts:2\)\.\n/);
  assert.match(red, /\|The bot's explanation> · it is fixing it now$/);
  assert.equal(
    pullMessage({
      repo: "acme/shop",
      repoUrl: "https://github.com/acme/shop",
      title: "Round half cents up",
      url: "https://github.com/acme/shop/pull/12",
      why: "an idea from its daily brief",
    }),
    "*Opened a pull request* on <https://github.com/acme/shop|acme/shop>: <https://github.com/acme/shop/pull/12|Round half cents up> · an idea from its daily brief",
  );
});

test("posting never fails the run, and never logs the webhook", async () => {
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  const sent: Array<{ url: string; body: unknown }> = [];
  const ok = (async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response("ok");
  }) as typeof fetch;
  assert.equal(await postToSlack(undefined, "hi", ok, log), false);
  assert.equal(await postToSlack(HOOK, "hi", ok, log), true);
  assert.deepEqual(sent, [
    { url: HOOK, body: { text: "hi", unfurl_links: false, unfurl_media: false } },
  ]);
  assert.equal(await postToSlack("https://evil.dev/hook", "hi", ok, log), false);
  assert.equal(sent.length, 1);
  const down = (async () => new Response("no", { status: 404 })) as typeof fetch;
  assert.equal(await postToSlack(HOOK, "hi", down, log), false);
  const broken = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  assert.equal(await postToSlack(HOOK, "hi", broken, log), false);
  assert.deepEqual(lines, [
    "Aperture Bot: slack-webhook is not a Slack incoming webhook (https://hooks.slack.com/services/…); nothing posted.",
    "Aperture Bot: Slack did not take the post (404).",
    "Aperture Bot: could not reach Slack; nothing posted.",
  ]);
  assert.ok(!lines.join("\n").includes("abcDEF123"));
});
