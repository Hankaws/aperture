import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agentOfCommit,
  parseGitLog,
  pullsFromCommits,
  scoreboard,
  type GitCommit,
} from "./scoreboard.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 26);
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
let seq = 0;
function commit(subject: string, more: Partial<GitCommit> = {}): GitCommit {
  seq += 1;
  return {
    sha: seq.toString(16).padStart(40, "0"),
    date: at(10),
    author: "Sam Person",
    email: "sam@example.com",
    subject,
    body: "",
    ...more,
  };
}

test("an agent is told by who made the commit, a merge's branch, or Claude Code's co-author line", () => {
  const as = (more: Partial<GitCommit>, branch?: string) =>
    agentOfCommit(commit("x (#1)", more), branch);
  assert.equal(
    as({ author: "Copilot", email: "198982749+Copilot@users.noreply.github.com" }),
    "Copilot",
  );
  assert.equal(as({ author: "devin-ai-integration[bot]" }), "Devin");
  assert.equal(as({ author: "google-labs-jules[bot]" }), "Jules");
  assert.equal(
    as({ author: "claude[bot]", email: "209825114+claude[bot]@users.noreply.github.com" }),
    "Claude",
  );
  assert.equal(as({ author: "Cursor Agent", email: "cursoragent@cursor.com" }), "Cursor");
  assert.equal(as({}, "codex/fix-total"), "Codex");
  assert.equal(as({}, "copilot/fix-123"), "Copilot");
  assert.equal(
    as({ body: "Fix it.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" }),
    "Claude Code",
  );
  assert.equal(
    as({ body: "🤖 Generated with [Claude Code](https://claude.com/claude-code)" }),
    "Claude Code",
  );
  // A person who applied Copilot's review suggestions is still the author; a person named Claude is a person.
  assert.equal(
    as({ body: "Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>" }),
    null,
  );
  assert.equal(as({ author: "Claude Monet", email: "claude@example.com" }), null);
  assert.equal(as({}), null);
});

test("commits become pull requests by their number; a straight push or a bot is read but not counted", () => {
  const pulls = pullsFromCommits("acme/shop", [
    commit("Add CSV export (#10)", { author: "Copilot" }),
    commit("Merge pull request #11 from acme/codex/cache", { body: "Cache the cart\n\nMore." }),
    commit("Tidy the readme"),
    commit("Bump zod from 3.1 to 3.2 (#12)", {
      author: "dependabot[bot]",
      email: "49699333+dependabot[bot]@users.noreply.github.com",
    }),
  ]);
  assert.deepEqual(
    pulls.map((p) => [p.number > 0 ? p.number : "not counted", p.title, p.agent]),
    [
      [10, "Add CSV export", "Copilot"],
      [11, "Cache the cart", "Codex"],
      ["not counted", "Tidy the readme", null],
      ["not counted", "Bump zod from 3.1 to 3.2", null],
    ],
  );
});

test("a revert counts by the commit it names, GitHub's wording, or the title it undoes", () => {
  const original = commit("Add CSV export (#10)", { author: "Copilot", date: at(30) });
  const other = commit("Cache the cart (#11)", { author: "Copilot", date: at(30) });
  const third = commit("Faster search (#12)", { author: "Copilot", date: at(30) });
  const pulls = pullsFromCommits("acme/shop", [
    original,
    other,
    third,
    // `git revert`, pushed straight to the branch, with the title cut short.
    commit('Revert "Add CSV exp…"', { body: `This reverts commit ${original.sha}.` }),
    // GitHub's Revert button, squashed.
    commit('Revert "Cache the cart" (#20)', { body: "Reverts acme/shop#11" }),
    // A revert of a squash whose title carries the number.
    commit('Revert "Faster search (#12)" (#21)'),
  ]);
  const card = scoreboard([{ repo: "acme/shop", commits: [] }], NOW); // empty: no agents, no repos
  assert.equal(card.repos.length, 0);
  const board = scoreboard(
    [
      {
        repo: "acme/shop",
        commits: [
          original,
          other,
          third,
          commit('Revert "Add CSV exp…"', { body: `This reverts commit ${original.sha}.` }),
          commit('Revert "Cache the cart" (#20)', { body: "Reverts acme/shop#11" }),
          commit('Revert "Faster search (#12)" (#21)'),
        ],
      },
    ],
    NOW,
  );
  assert.deepEqual(board.totals, [
    { agent: "Copilot", merged: 3, reverted: [10, 11, 12], fixedAfter: [] },
  ]);
  // The two squashed reverts are people's pull requests; the straight push is not counted.
  assert.equal(board.people.merged, 2);
  assert.match(pulls[3]!.body ?? "", /^Reverts acme\/shop#10/);
});

test("a fix soon after counts on the commit's own words; every repository adds up", () => {
  const board = scoreboard(
    [
      {
        repo: "acme/shop",
        commits: [
          commit("Add CSV export (#10)", { author: "Copilot", date: at(30) }),
          commit("Fix the CSV header from #10 (#13)", { date: at(25) }),
          commit("Old change (#1)", { author: "Copilot", date: at(200) }),
        ],
      },
      {
        repo: "acme/api",
        commits: [
          commit("Add rate limits (#5)", {
            body: "Co-Authored-By: Claude <noreply@anthropic.com>",
            date: at(20),
          }),
          commit("Add search (#6)", { author: "Copilot", date: at(20) }),
        ],
      },
    ],
    NOW,
  );
  assert.deepEqual(
    board.totals.map((t) => [t.agent, t.merged, t.reverted, t.fixedAfter]),
    [
      ["Copilot", 2, [], [10]],
      ["Claude Code", 1, [], []],
    ],
  );
  assert.deepEqual(board.people, { merged: 1, reverted: 0, fixedAfter: 0 });
  assert.deepEqual(
    board.repos.map((r) => r.repo),
    ["acme/shop", "acme/api"],
  );
  assert.equal(board.days, 90);
  assert.equal(board.fixDays, 14);
});

test("git log's records are read back field by field, a body with blank lines included", () => {
  const log = [
    [
      "a".repeat(40),
      "2026-11-20T10:00:00+01:00",
      "Copilot",
      "1+Copilot@users.noreply.github.com",
      "Add CSV (#10)",
      "First line.\n\nCo-authored-by: x <x@y>\n",
    ],
    ["b".repeat(40), "2026-11-19T10:00:00Z", "Sam", "sam@example.com", "Tidy", ""],
  ]
    .map((fields) => fields.join("\x1f"))
    .join("\x1e\n");
  const commits = parseGitLog(`${log}\x1e\n`);
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[0], {
    sha: "a".repeat(40),
    date: "2026-11-20T10:00:00+01:00",
    author: "Copilot",
    email: "1+Copilot@users.noreply.github.com",
    subject: "Add CSV (#10)",
    body: "First line.\n\nCo-authored-by: x <x@y>",
  });
  assert.equal(commits[1]!.body, "");
});
