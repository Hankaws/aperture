import assert from "node:assert/strict";
import { test } from "node:test";
import { readSummary, summaryMarker, unpushedDiff, type BotSummary } from "./summary.ts";
import {
  cleanScheduled,
  endedRun,
  NIGHTLY,
  NO_JOBS,
  runId,
  SILENT_AFTER_MS,
  tasksFrom,
  WEEKLY,
  withJobs,
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
  assert.deepEqual(workflowUse(grok), {
    uses: true,
    secret: "XAI_API_KEY",
    trigger: "/aperture",
    version: "v1",
    jobs: NO_JOBS,
    app: false,
  });
  assert.doesNotMatch(grok, /provider:|^ {2}issues:$|schedule:/m);
  const openai = workflowFile("openai", "main");
  assert.match(openai, /uses: hankaws\/aperture-bot@main\n/);
  assert.match(openai, /provider: openai\n/);
  assert.equal(workflowUse(openai).secret, "OPENAI_API_KEY");
  assert.equal(workflowUse("steps:\n  - uses: actions/checkout@v4\n").uses, false);
  assert.equal(
    workflowUse("    - uses: Hankaws/aperture-bot@v1\n      with:\n        trigger: /bot\n")
      .trigger,
    "/bot",
  );
});

test("standing jobs go into the workflow and read back the same", () => {
  const jobs = { label: true, scheduled: "fix-ci", cron: NIGHTLY };
  const text = workflowFile("grok", "v1", jobs);
  assert.match(
    text,
    /^ {2}issues:\n {4}types: \[labeled\]\n {2}schedule:\n {4}- cron: "17 3 \* \* \*"\n {2}workflow_dispatch:\n/m,
  );
  assert.match(
    text,
    /\|\| \(github\.event_name == 'issues' && github\.event\.label\.name == 'aperture'\)/,
  );
  assert.match(
    text,
    /\|\| github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/,
  );
  assert.match(text, / {10}scheduled: "fix-ci"\n/);
  assert.deepEqual(workflowUse(text).jobs, jobs);
  const weekly = { label: false, scheduled: 'Update "docs" links\nthat 404', cron: WEEKLY };
  assert.deepEqual(workflowUse(workflowFile("grok", "v1", weekly)).jobs, weekly);
});

test("changing the jobs keeps the bot's other settings, and a task cannot carry an expression", () => {
  const custom = [
    "name: Aperture Bot",
    "on:",
    "  issue_comment:",
    "    types: [created]",
    "jobs:",
    "  bot:",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: hankaws/aperture-bot@v1",
    "        with:",
    "          model-key: ${{ secrets.MY_KEY }}",
    "          provider: anthropic",
    "          test-script: test:unit # the fast ones",
    "          scheduled: old task",
    "",
  ].join("\n");
  const next = withJobs(custom, { label: true, scheduled: "fix-ci", cron: NIGHTLY })!;
  assert.match(
    next,
    / {10}model-key: \$\{\{ secrets\.MY_KEY \}\}\n {10}provider: anthropic\n {10}test-script: test:unit # the fast ones\n {10}scheduled: "fix-ci"\n/,
  );
  assert.doesNotMatch(next, /old task/);
  assert.deepEqual(workflowUse(next).jobs, { label: true, scheduled: "fix-ci", cron: NIGHTLY });
  const off = withJobs(next, NO_JOBS)!;
  assert.deepEqual(workflowUse(off).jobs, NO_JOBS);
  assert.match(off, /test-script: test:unit/);
  assert.equal(withJobs("name: CI\n", NO_JOBS), null);
  assert.equal(cleanScheduled("echo ${{ secrets.MY_KEY }}  "), "echo  secrets.MY_KEY }}");
});

test("a task the label or the schedule asked for is read from the bot's own comment", () => {
  const [labelled, scheduled] = tasksFrom(
    [
      botSays(
        30,
        9,
        "Opened …",
        {
          v: 1,
          state: "clear",
          asked: 0,
          run: RUN,
          via: "label",
          by: "grace",
          task: "Do what this issue asks: Currency",
        },
        5,
      ),
      botSays(
        31,
        12,
        "On it",
        {
          v: 1,
          state: "working",
          asked: 0,
          run: RUN,
          via: "schedule",
          by: "schedule",
          task: "These checks fail on main",
        },
        9,
      ),
    ],
    threads,
    { now: NOW },
  );
  assert.deepEqual(
    [labelled!.id, labelled!.via, labelled!.author, labelled!.state, labelled!.task],
    [30, "label", "grace", "clear", "Do what this issue asks: Currency"],
  );
  assert.deepEqual(
    [scheduled!.via, scheduled!.state, scheduled!.number],
    ["schedule", "working", 12],
  );
});

test("posting as a GitHub App adds the token step, uses it everywhere, and comes off again", () => {
  const plain = workflowFile("grok", "v1");
  const app = withJobs(plain, NO_JOBS, true)!;
  assert.match(
    app,
    /- uses: actions\/create-github-app-token@v1\n {8}id: app\n {8}with:\n {10}app-id: \$\{\{ vars\.APERTURE_BOT_APP_ID \}\}\n {10}private-key: \$\{\{ secrets\.APERTURE_BOT_PRIVATE_KEY \}\}\n {6}- uses: actions\/checkout@v4\n {8}with:\n {10}token: \$\{\{ steps\.app\.outputs\.token \}\}\n/,
  );
  assert.match(app, / {10}github-token: \$\{\{ steps\.app\.outputs\.token \}\}\n/);
  assert.equal(workflowUse(app).app, true);
  // Changing the jobs keeps the app; turning the app off takes its token with it.
  const jobs = withJobs(app, { label: true, scheduled: null, cron: null })!;
  assert.equal(workflowUse(jobs).app, true);
  assert.equal(jobs.match(/github-token:/g)?.length, 1);
  const off = withJobs(jobs, { label: true, scheduled: null, cron: null }, false)!;
  assert.equal(workflowUse(off).app, false);
  assert.doesNotMatch(off, /github-token|create-github-app-token/);
  // A token of the person's own is theirs: it stays.
  const pat = plain.replace(
    "model-key: ${{ secrets.XAI_API_KEY }}",
    "model-key: ${{ secrets.XAI_API_KEY }}\n          github-token: ${{ secrets.BOT_PAT }}",
  );
  assert.match(withJobs(pat, NO_JOBS)!, /github-token: \$\{\{ secrets\.BOT_PAT \}\}/);
});
