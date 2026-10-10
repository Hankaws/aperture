import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activityFrom,
  byDay,
  dayLabel,
  feedOf,
  headline,
  statusOf,
  type Activity,
} from "./activity.ts";
import { sampleActivity } from "./activity-sample.ts";
import type { BotSummary } from "./summary.ts";
import type { BotTask } from "./tasks.ts";

const NOW = Date.parse("2026-10-09T12:00:00");
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const RUN = "https://github.com/acme/shop/actions/runs/1";

const make = (over: Partial<BotTask> & { summary?: BotSummary | null }): BotTask => ({
  id: 1,
  via: "comment",
  number: 7,
  thread: { title: "Prices show cents", isPull: false, open: true },
  task: "Show prices in dollars",
  author: "ada",
  askedAt: at(30),
  askedUrl: "https://github.com/acme/shop/issues/7#issuecomment-1",
  state: "waiting",
  summary: null,
  replyUrl: null,
  updatedAt: at(30),
  diff: null,
  ...over,
});

test("an ask and its pull request become two entries, the outcome at the time it settled", () => {
  const items = activityFrom("acme/shop", [
    make({
      state: "clear",
      updatedAt: at(20),
      replyUrl: "https://github.com/acme/shop/issues/7#issuecomment-2",
      summary: {
        v: 1,
        state: "clear",
        asked: 1,
        run: RUN,
        link: { url: "https://github.com/acme/shop/pull/8", what: "pull" },
        checks: [
          { status: "pass", label: "Parses", detail: "" },
          { status: "pass", label: "Types", detail: "" },
        ],
        files: ["src/price.ts"],
      },
    }),
  ]);
  assert.deepEqual(
    items.map((a) => [a.kind, a.at, a.url, a.detail, headline(a)]),
    [
      ["asked", at(30), "https://github.com/acme/shop/issues/7#issuecomment-1", null, "@ada asked"],
      [
        "opened",
        at(20),
        "https://github.com/acme/shop/pull/8",
        "2 checks clear · 1 file",
        "Opened pull request #8",
      ],
    ],
  );
  assert.equal(items[1]!.title, "Prices show cents");
});

test("each state reads as what happened, with the right detail", () => {
  const items = activityFrom("acme/shop", [
    make({ id: 1, state: "waiting" }),
    make({
      id: 2,
      state: "working",
      summary: {
        v: 1,
        state: "working",
        asked: 2,
        run: RUN,
        phase: "checking",
        round: 1,
        rounds: 2,
      },
    }),
    make({
      id: 3,
      state: "red",
      summary: {
        v: 1,
        state: "red",
        asked: 3,
        run: RUN,
        checks: [
          { status: "pass", label: "Parses", detail: "" },
          { status: "fail", label: "Types", detail: "" },
        ],
      },
    }),
    make({
      id: 4,
      state: "error",
      summary: { v: 1, state: "error", asked: 4, run: RUN, error: "No model key." },
    }),
    make({
      id: 5,
      state: "clear",
      summary: {
        v: 1,
        state: "clear",
        asked: 5,
        run: RUN,
        link: { url: "https://github.com/acme/shop/commit/abc", what: "commit" },
      },
    }),
    make({ id: 6, state: "silent" }),
  ]);
  const by = (id: string) => items.find((a) => a.id === `acme/shop#${id}`)!;
  assert.equal(by("1:asked").detail, "Waiting for the workflow to pick it up.");
  assert.equal(items.filter((a) => a.id.startsWith("acme/shop#1:")).length, 1, "no outcome yet");
  assert.match(by("2:working").detail!, /round 1 of 2/);
  assert.equal(by("3:red").detail, "1 of 2 checks red");
  assert.equal(headline(by("3:red")), "Stopped: Agent Check still red, nothing pushed");
  assert.equal(by("4:error").detail, "No model key.");
  assert.equal(headline(by("5:pushed")), "Pushed a commit to the pull request");
  assert.equal(headline(by("6:silent")), "No answer from the workflow");
});

test("the label and the schedule are named as who asked", () => {
  const [label] = activityFrom("acme/shop", [make({ via: "label", author: "grace" })]);
  const [job] = activityFrom("acme/shop", [make({ via: "schedule", author: "schedule" })]);
  assert.equal(headline(label!), "@grace's label asked");
  assert.equal(headline(job!), "A standing job asked");
});

test("the feed merges repositories newest first, an outcome before its ask, up to a limit", () => {
  const shop = activityFrom("acme/shop", [
    make({
      id: 1,
      askedAt: at(30),
      updatedAt: at(30),
      state: "no-change",
      summary: { v: 1, state: "no-change", asked: 1, run: RUN },
    }),
  ]);
  const docs = activityFrom("acme/docs", [make({ id: 9, askedAt: at(10) })]);
  const feed = feedOf([shop, docs]);
  assert.deepEqual(
    feed.map((a) => a.id),
    ["acme/docs#9:asked", "acme/shop#1:no-change", "acme/shop#1:asked"],
  );
  assert.equal(feedOf([shop, docs], 2).length, 2);
  // A busy repository keeps only its newest few, so the others still show.
  const busy = activityFrom(
    "acme/busy",
    Array.from({ length: 8 }, (_, i) => make({ id: 100 + i, askedAt: at(i), updatedAt: at(i) })),
  );
  const fair = feedOf([busy, shop], 4, 3);
  assert.equal(fair.filter((a) => a.repo === "acme/busy").length, 3);
  assert.ok(fair.some((a) => a.repo === "acme/shop"));
});

test("days read as Today, Yesterday, then the date, and entries group under them", () => {
  assert.equal(dayLabel(at(60), NOW), "Today");
  assert.equal(dayLabel(at(24 * 60), NOW), "Yesterday");
  assert.doesNotMatch(dayLabel(at(3 * 24 * 60), NOW), /Today|Yesterday/);
  assert.equal(dayLabel("not a date", NOW), "Earlier");
  const items = [at(5), at(60), at(24 * 60), at(3 * 24 * 60)].map(
    (t, i) => ({ id: String(i), at: t }) as Activity,
  );
  assert.deepEqual(
    byDay(items, NOW).map((g) => [
      g.day === "Today" || g.day === "Yesterday" ? g.day : "date",
      g.items.length,
    ]),
    [
      ["Today", 2],
      ["Yesterday", 1],
      ["date", 1],
    ],
  );
});

test("the sample is a believable week: every kind of entry, newest first, links on github.com", () => {
  const sample = sampleActivity(NOW);
  const kinds = new Set(sample.map((a) => a.kind));
  for (const kind of ["asked", "working", "opened", "red", "no-change"] as const)
    assert.ok(kinds.has(kind), kind);
  const times = sample.map((a) => Date.parse(a.at));
  assert.deepEqual(
    times,
    [...times].sort((a, b) => b - a),
  );
  assert.ok(sample.every((a) => a.url.startsWith("https://github.com/acme/")));
  assert.equal(new Set(sample.map((a) => a.id)).size, sample.length);
  assert.ok(
    sample.some((a) => a.who === "A standing job") &&
      sample.some((a) => a.who === "@grace's label"),
  );
});

test("a bot's status is the newest news on its repository, and fades after a day", () => {
  const entry = (kind: Activity["kind"], minutesAgo: number, repo = "acme/shop") =>
    ({
      id: `${kind}${minutesAgo}`,
      repo,
      at: at(minutesAgo),
      kind,
      number: 7,
      pull: kind === "opened" ? 8 : null,
    }) as Activity;
  const items = [entry("working", 1, "acme/docs"), entry("opened", 30), entry("asked", 40)];
  assert.deepEqual(statusOf(items, "acme/shop", NOW), {
    mood: "done",
    line: "Opened pull request #8",
    tone: "ok",
    at: at(30),
  });
  assert.equal(statusOf(items, "ACME/Docs", NOW)!.line, "Working on #7");
  assert.equal(statusOf(items, "acme/api", NOW), null);
  const old = statusOf([entry("red", 26 * 60)], "acme/shop", NOW)!;
  assert.deepEqual([old.mood, old.tone, old.line], ["idle", "muted", "Stuck: checks red on #7"]);
  assert.equal(statusOf([entry("asked", 2)], "acme/shop", NOW)!.line, "Queued on #7");
  assert.equal(statusOf([entry("silent", 2)], "acme/shop", NOW)!.mood, "stuck");
});

test("a check on a pull request reads as a review, and a push names who pushed", () => {
  const checks = [
    { status: "pass", label: "Parses", detail: "" },
    { status: "fail", label: "Types", detail: "1 error" },
  ];
  const items = activityFrom("acme/shop", [
    make({
      id: 5,
      via: "pull",
      author: "grace",
      task: "Check this pull request",
      state: "red",
      updatedAt: at(10),
      summary: { v: 1, state: "red", kind: "check", via: "pull", asked: 0, run: RUN, checks },
    }),
    make({
      id: 6,
      task: "check",
      state: "clear",
      updatedAt: at(5),
      summary: { v: 1, state: "clear", kind: "check", asked: 6, run: RUN, checks: [checks[0]!] },
    }),
  ]);
  assert.deepEqual(
    items.map((a) => [a.kind, headline(a), a.detail]),
    [
      ["asked", "@grace pushed", null],
      ["flagged", "Checked the pull request: red, not ready to merge", "1 of 2 checks red"],
      ["asked", "@ada asked", null],
      ["checked", "Checked the pull request: nothing red", "1 checks clear"],
    ],
  );
  assert.equal(statusOf(feedOf([items.slice(0, 2)]), "acme/shop", NOW)?.line, "Found red on #7");
  const clear = statusOf(feedOf([items]), "acme/shop", NOW);
  assert.equal(clear?.line, "Checked #7: clear");
  assert.equal(clear?.mood, "done");
});
