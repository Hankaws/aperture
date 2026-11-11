import assert from "node:assert/strict";
import { test } from "node:test";
import { checksLine, skillUsage } from "./skill-usage.ts";
import type { BotSkillCheck } from "./summary.ts";
import type { BotTask } from "./tasks.ts";
import type { Skill } from "../workspace/skills.ts";

const skill = (name: string, checks?: string[]): Skill & { url: string } => ({
  name,
  path: `.aperture/skills/${name}.md`,
  description: `How to do ${name}.`,
  text: "Steps.",
  url: `https://github.com/acme/shop/blob/main/.aperture/skills/${name}.md`,
  ...(checks ? { checks } : {}),
});

let n = 0;
const task = (at: string, skills: string[], skillChecks?: BotSkillCheck[]): BotTask => {
  n += 1;
  return {
    id: n,
    via: "comment",
    number: n,
    thread: null,
    task: "Do it",
    author: "ada",
    askedAt: at,
    askedUrl: `https://github.com/acme/shop/issues/${n}#asked`,
    state: "clear",
    summary: {
      v: 1,
      state: "clear",
      asked: n,
      run: "",
      ...(skills.length ? { skills } : {}),
      ...(skillChecks ? { skillChecks } : {}),
      link: { url: `https://github.com/acme/shop/pull/${100 + n}`, what: "pull" },
    },
    replyUrl: `https://github.com/acme/shop/issues/${n}#reply`,
    updatedAt: at,
    diff: null,
  };
};

test("each skill: the runs that followed it, the latest, and how its checks went", () => {
  const prices = skill("prices", ["prices:check", "test"]);
  const release = skill("release");
  const docs = skill("docs", ["lint"]);
  const tasks = [
    task(
      "2026-11-01T10:00:00Z",
      [prices.path],
      [
        { skill: "prices", script: "prices:check", status: "failed" },
        { skill: "prices", script: "test", status: "passed" },
      ],
    ),
    task(
      "2026-11-05T10:00:00Z",
      [prices.path, release.path],
      [
        { skill: "prices", script: "prices:check", status: "passed" },
        // Another skill's check with the same script is not this one's.
        { skill: "other", script: "test", status: "failed" },
      ],
    ),
    task("2026-11-03T10:00:00Z", []),
  ];
  const rows = skillUsage("acme/shop", [docs, release, prices], tasks);
  assert.deepEqual(
    rows.map((r) => [r.name, r.runs, r.lastAt]),
    [
      ["prices", 2, "2026-11-05T10:00:00Z"],
      ["release", 1, "2026-11-05T10:00:00Z"],
      ["docs", 0, null],
    ],
  );
  assert.equal(rows[0]!.lastUrl, "https://github.com/acme/shop/pull/102");
  assert.deepEqual(rows[0]!.checkRuns, [
    { script: "prices:check", passed: 1, failed: 1, notRun: 0 },
    { script: "test", passed: 1, failed: 0, notRun: 0 },
  ]);
  assert.equal(checksLine(rows[0]!), "prices:check failed in 1 of 2 runs");
  assert.equal(checksLine(rows[1]!), "");
  assert.equal(checksLine(rows[2]!), "Checks: lint. Not run yet.");
  assert.equal(rows[2]!.lastUrl, null);
});

test("checks that passed, and those that have not run yet, say so", () => {
  const prices = skill("prices", ["prices:check", "e2e"]);
  const [row] = skillUsage(
    "acme/shop",
    [prices],
    [
      task(
        "2026-11-05T10:00:00Z",
        [prices.path],
        [
          { skill: "prices", script: "prices:check", status: "passed" },
          { skill: "prices", script: "e2e", status: "not_run" },
        ],
      ),
    ],
  );
  assert.equal(checksLine(row!), "Checks passed: prices:check. 1 not run yet.");
  assert.deepEqual(row!.checkRuns[1], { script: "e2e", passed: 0, failed: 0, notRun: 1 });
});
