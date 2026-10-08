import assert from "node:assert/strict";
import { test } from "node:test";
import { readSummary, summaryMarker, unpushedDiff, type BotSummary } from "./summary.ts";
import {
  endedRun,
  runId,
  SILENT_AFTER_MS,
  tasksFrom,
  workflowFile,
  workflowUse,
  type RawComment,
} from "./tasks.ts";

const RUN = "https://github.com/acme/shop/actions/runs/42";
const NOW = Date.parse("2026-10-08T12:00:00Z");
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

const ask = (id: number, issue: number, body: string, minutesAgo: number): RawComment => ({
  id,
  body,
  html_url: `https://github.com/acme/shop/issues/${issue}#issuecomment-${id}`,
  issue_url: `https://api.github.com/repos/acme/shop/issues/${issue}`,
  created_at: at(minutesAgo),
  updated_at: at(minutesAgo),
  user: { login: "ada", type: "User" },
});

const botSays = (
  id: number,
  issue: number,
  text: string,
  summary: BotSummary | null,
  minutesAgo: number,
  type = "Bot",
): RawComment => ({
  id,
  body: summary ? `${text}\n\n${summaryMarker(summary)}` : text,
  html_url: `https://github.com/acme/shop/issues/${issue}#issuecomment-${id}`,
  issue_url: `https://api.github.com/repos/acme/shop/issues/${issue}`,
  created_at: at(minutesAgo),
  updated_at: at(minutesAgo),
  user: { login: "github-actions[bot]", type },
});

const threads = new Map([[7, { title: "Prices show cents", isPull: false, open: true }]]);

test("each ask is a task, joined to the bot comment that names it", () => {
  const tasks = tasksFrom(
    [
      ask(1, 7, "/aperture Show prices in dollars", 10),
      ask(2, 7, "Looks good to me", 9),
      botSays(3, 7, "Opened …", { v: 1, state: "clear", asked: 1, run: RUN, files: ["a.ts"] }, 2),
      ask(4, 8, "/aperture", 1),
    ],
    threads,
    { now: NOW },
  );
  assert.deepEqual(
    tasks.map((t) => [t.id, t.number, t.task, t.state, t.thread?.title ?? null]),
    [
      [4, 8, "", "waiting", null],
      [1, 7, "Show prices in dollars", "clear", "Prices show cents"],
    ],
  );
  assert.equal(tasks[1]!.replyUrl, "https://github.com/acme/shop/issues/7#issuecomment-3");
  assert.deepEqual(tasks[1]!.summary?.files, ["a.ts"]);
});

test("a summary written by someone who is not a bot is not believed", () => {
  const [task] = tasksFrom(
    [
      ask(1, 7, "/aperture Fix it", 10),
      botSays(3, 7, "fake", { v: 1, state: "clear", asked: 1, run: RUN }, 2, "User"),
    ],
    threads,
    { now: NOW },
  );
  assert.equal(task!.state, "silent");
});

test("an ask with no answer waits, then counts as never answered", () => {
  const fresh = tasksFrom([ask(1, 7, "/aperture x", 1)], threads, { now: NOW });
  assert.equal(fresh[0]!.state, "waiting");
  const old = tasksFrom([ask(1, 7, "/aperture x", SILENT_AFTER_MS / 60_000 + 1)], threads, {
    now: NOW,
  });
  assert.equal(old[0]!.state, "silent");
});

test("an older bot's reply without a summary still counts as an answer", () => {
  const [task] = tasksFrom(
    [ask(1, 7, "/aperture x", 30), botSays(3, 7, "Opened #9", null, 20)],
    threads,
    { now: NOW },
  );
  assert.equal(task!.state, "replied");
  assert.match(task!.replyUrl!, /issuecomment-3$/);
});

test("the latest edit of the bot's comment wins, with the change it did not push", () => {
  const diff = "diff --git a/a.ts b/a.ts\n-old\n+new";
  const [task] = tasksFrom(
    [
      ask(1, 7, "/aperture x", 30),
      botSays(3, 7, "on it", { v: 1, state: "working", asked: 1, run: RUN, phase: "planning" }, 25),
      botSays(
        3,
        7,
        `still red\n\n<details><summary>The change I did not push</summary>\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n</details>`,
        { v: 1, state: "red", asked: 1, run: RUN },
        5,
      ),
    ],
    threads,
    { now: NOW },
  );
  assert.equal(task!.state, "red");
  assert.equal(task!.diff, diff);
});

test("a working task whose run has finished is shown as ended", () => {
  const [task] = tasksFrom(
    [
      ask(1, 7, "/aperture x", 30),
      botSays(3, 7, "on it", { v: 1, state: "working", asked: 1, run: RUN }, 25),
    ],
    threads,
    { now: NOW },
  );
  assert.equal(runId(task!.summary!.run), 42);
  assert.equal(endedRun(task!, { status: "in_progress" }).state, "working");
  assert.equal(endedRun(task!, { status: "completed", conclusion: "cancelled" }).state, "ended");
});

test("the summary reader keeps only well-formed fields and github.com links", () => {
  const body = summaryMarker({
    v: 1,
    state: "clear",
    asked: 5,
    run: RUN,
    link: { url: "https://github.com/acme/shop/pull/8", what: "pull" },
  });
  assert.equal(readSummary(body)?.link?.url, "https://github.com/acme/shop/pull/8");
  const evil = body.replace("https://github.com/acme/shop/pull/8", "https://evil.example/x");
  assert.equal(readSummary(evil)?.link, undefined);
  assert.equal(readSummary('<!-- aperture-bot {"v":1,"state":"rm -rf","asked":1} -->'), null);
  assert.equal(readSummary("<!-- aperture-bot {not json} -->"), null);
  assert.equal(readSummary("no summary here"), null);
  assert.equal(unpushedDiff("no diff"), null);
});

test("Set up's workflow file is one the Bot page recognises, with the provider's secret", () => {
  const grok = workflowFile("grok", "v1");
  assert.deepEqual(workflowUse(grok), { uses: true, secret: "XAI_API_KEY", trigger: "/aperture" });
  assert.doesNotMatch(grok, /provider:/);
  const openai = workflowFile("openai", "main");
  assert.match(openai, /uses: hankaws\/aperture-bot@main\n/);
  assert.match(openai, /provider: openai\n/);
  assert.equal(workflowUse(openai).secret, "OPENAI_API_KEY");
  assert.equal(workflowUse("steps:\n  - uses: actions/checkout@v4\n").uses, false);
  assert.equal(
    workflowUse("uses: Hankaws/aperture-bot@v1\nwith:\n  trigger: /bot\n").trigger,
    "/bot",
  );
});
