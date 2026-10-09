/**
 * A made-up week of Aperture Bot's work on two repositories, for the feed
 * before there is any of your own: shown to visitors, and in place of an
 * empty feed, always labelled as an example. Built through activityFrom, so
 * it reads exactly as real activity would.
 */
import { activityFrom, feedOf, type Activity } from "./activity.ts";
import type { BotSummary } from "./summary.ts";
import type { BotTask, TaskState } from "./tasks.ts";

const HOUR = 60;
const DAY = 24 * HOUR;

const checks = (red = 0) =>
  ["Parses", "Imports resolve", "Types", "Tests pass"].map((label, i) => ({
    status: i >= 4 - red ? "fail" : "pass",
    label,
    detail: "",
  }));

type Sample = {
  id: number;
  number: number;
  title: string;
  task: string;
  state: TaskState;
  /** Minutes before now that it was asked, and how long the run took. */
  asked: number;
  took: number;
  via?: BotTask["via"];
  author?: string;
  pull?: number;
  summary?: Partial<BotSummary>;
};

function sampleTask(repo: string, s: Sample, now: number): BotTask {
  const at = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const issue = `https://github.com/${repo}/issues/${s.number}`;
  const via = s.via ?? "comment";
  return {
    id: s.id,
    via,
    number: s.number,
    thread: { title: s.title, isPull: false, open: true },
    task: s.task,
    author: s.author ?? "ada",
    askedAt: at(s.asked),
    askedUrl: `${issue}#issuecomment-${s.id}`,
    state: s.state,
    summary: {
      v: 1,
      state:
        s.state === "working" || s.state === "clear" || s.state === "red" ? s.state : "no-change",
      asked: via === "comment" ? s.id : 0,
      run: `https://github.com/${repo}/actions/runs/${s.id}`,
      ...(s.pull
        ? { link: { url: `https://github.com/${repo}/pull/${s.pull}`, what: "pull" } }
        : {}),
      ...s.summary,
    },
    replyUrl: `${issue}#issuecomment-${s.id + 1}`,
    updatedAt: at(Math.max(0, s.asked - s.took)),
    diff: null,
  };
}

const SAMPLES: Record<string, Sample[]> = {
  "acme/shop": [
    {
      id: 9101,
      number: 41,
      title: "Dark mode",
      task: "Add a dark mode toggle to the header, and remember the choice.",
      state: "working",
      asked: 4,
      took: 0,
      summary: { phase: "checking", round: 1, rounds: 2 },
    },
    {
      id: 9001,
      number: 37,
      title: "Prices show cents",
      task: "Show prices in dollars with two decimals, and update the cart test.",
      state: "clear",
      asked: 3 * HOUR,
      took: 11,
      pull: 42,
      summary: { checks: checks(), files: ["src/price.ts", "test/price.test.js"] },
    },
    {
      id: 8901,
      number: 35,
      title: "Support more currencies",
      task: "Let formatPrice take a currency code.",
      state: "red",
      asked: DAY + 2 * HOUR,
      took: 16,
      author: "grace",
      summary: { checks: checks(1), files: ["src/price.ts"] },
    },
    {
      id: 8801,
      number: 33,
      title: "Aperture Bot: fix what is red on main",
      task: "These checks fail on main. Find why in the code, and fix it so they pass.",
      state: "clear",
      asked: DAY + 9 * HOUR,
      took: 14,
      via: "schedule",
      author: "schedule",
      pull: 34,
      summary: { checks: checks(), files: ["src/cart.ts"] },
    },
  ],
  "acme/docs": [
    {
      id: 7001,
      number: 12,
      title: "Broken links in the guide",
      task: "Do what this issue asks: Broken links in the guide",
      state: "clear",
      asked: 2 * DAY + 5 * HOUR,
      took: 8,
      via: "label",
      author: "grace",
      pull: 13,
      summary: { checks: checks(), files: ["guide/install.md", "guide/deploy.md"] },
    },
    {
      id: 6901,
      number: 9,
      title: "Typo in the README",
      task: "Fix the typo in the install section.",
      state: "no-change",
      asked: 3 * DAY + 2 * HOUR,
      took: 3,
    },
  ],
};

export function sampleActivity(now: number): Activity[] {
  return feedOf(
    Object.entries(SAMPLES).map(([repo, samples]) =>
      activityFrom(
        repo,
        samples.map((s) => sampleTask(repo, s, now)),
      ),
    ),
  );
}
