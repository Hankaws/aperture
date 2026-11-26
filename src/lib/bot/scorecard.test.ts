import assert from "node:assert/strict";
import { test } from "node:test";
import { agentOf, scorecard, share, type PullSummary } from "./scorecard.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 25);
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const pull = (
  number: number,
  author: string,
  mergedDaysAgo: number | null,
  more: Partial<PullSummary> = {},
): PullSummary => ({
  number,
  title: `Change ${number}`,
  body: null,
  author,
  createdAt: at((mergedDaysAgo ?? 0) + 1),
  mergedAt: mergedDaysAgo === null ? null : at(mergedDaysAgo),
  ...more,
});

test("agents are told apart by author, or by Claude Code's line", () => {
  assert.equal(agentOf({ author: "copilot-swe-agent[bot]", body: null }), "Copilot");
  assert.equal(agentOf({ author: "Copilot", body: null }), "Copilot");
  assert.equal(agentOf({ author: "chatgpt-codex-connector[bot]", body: null }), "Codex");
  assert.equal(agentOf({ author: "devin-ai-integration[bot]", body: null }), "Devin");
  assert.equal(
    agentOf({ author: "acme-aperture[bot]", authorType: "Bot", body: null }),
    "Aperture Bot",
  );
  assert.equal(
    agentOf({
      author: "sam",
      body: "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    }),
    "Claude Code",
  );
  assert.equal(agentOf({ author: "sam", body: "Fixes the cart." }), null);
  // A person whose name has "aperture" in it is a person.
  assert.equal(agentOf({ author: "aperture-fan", authorType: "User", body: null }), null);
});

test("a revert by GitHub's button or by title counts against the pull request it undoes", () => {
  const pulls = [
    pull(10, "copilot-swe-agent[bot]", 20, { title: "Add CSV export" }),
    pull(11, "copilot-swe-agent[bot]", 19),
    pull(12, "copilot-swe-agent[bot]", 18),
    pull(13, "sam", 15, { title: 'Revert "Add CSV export"' }),
    pull(14, "sam", 14, {
      title: "Undo the cache",
      body: "Reverts acme/shop#11\n\nIt broke checkout.",
    }),
  ];
  const card = scorecard(pulls, NOW);
  assert.deepEqual(card.agents, [
    { agent: "Copilot", merged: 3, reverted: [10, 11], fixedAfter: [] },
  ]);
  // The reverts themselves are people's pull requests, kept.
  assert.deepEqual(card.people, { agent: "People", merged: 2, reverted: [], fixedAfter: [] });
});

test("a fix soon after counts when it names the pull request next to a fix word, within two weeks", () => {
  const pulls = [
    pull(20, "chatgpt-codex-connector[bot]", 30),
    pull(21, "chatgpt-codex-connector[bot]", 30),
    pull(22, "chatgpt-codex-connector[bot]", 30),
    pull(30, "sam", 27, { title: "Fix the total rounding from #20" }),
    // Mentioned without a fix word: not counted.
    pull(31, "sam", 26, { body: "Builds on #21 to add filters." }),
    // A fix too late: not counted.
    pull(32, "sam", 2, { title: "Fix regression from #22" }),
    // Not merged: not counted.
    pull(33, "sam", null, { title: "Fixes #21" }),
  ];
  const card = scorecard(pulls, NOW);
  assert.deepEqual(card.agents[0], { agent: "Codex", merged: 3, reverted: [], fixedAfter: [20] });
});

test("only pull requests merged inside the window are scored", () => {
  const pulls = [
    pull(1, "devin-ai-integration[bot]", 100),
    pull(2, "devin-ai-integration[bot]", 5),
    pull(3, "sam", null),
  ];
  const card = scorecard(pulls, NOW, 90);
  assert.deepEqual(
    card.agents.map((a) => [a.agent, a.merged]),
    [["Devin", 1]],
  );
  assert.equal(card.read, 3);
});

test("share reads as a person would say it", () => {
  assert.equal(share(0, 0), "none");
  assert.equal(share(0, 40), "none of 40");
  assert.equal(share(2, 40), "2 of 40 (5%)");
  assert.equal(share(1, 400), "1 of 400 (0.3%)");
  // Below a tenth of a percent, one decimal would read as none.
  assert.equal(share(1, 6342), "1 of 6342 (0.02%)");
});

test("a fix counts only in the description's own words, not in a quoted example", () => {
  const pulls = [
    pull(15, "chatgpt-codex-connector[bot]", 30),
    pull(16, "chatgpt-codex-connector[bot]", 30),
    pull(76, "sam", 25, {
      body: 'Every card opened a new issue, even one like "Fix #15: give the button more contrast".\n\n> Fixes #16\n\nAlso `fixes #16` in code.',
    }),
  ];
  assert.deepEqual(scorecard(pulls, NOW).agents[0]!.fixedAfter, []);
  const own = [
    ...pulls.slice(0, 2),
    pull(77, "sam", 25, { body: "Fixes #16, which dropped the header." }),
  ];
  assert.deepEqual(scorecard(own, NOW).agents[0]!.fixedAfter, [16]);
});
