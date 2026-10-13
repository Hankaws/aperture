/**
 * Standing jobs: what the bot does when the workflow's schedule (or a manual
 * run) starts it, set by the `scheduled` input. `fix-ci` fixes whatever is
 * red on the default branch; `look-over` reads how the repository stands and
 * suggests what to do, changing nothing (`look.ts`); any other text is a task
 * to do each time.
 *
 * A job reports on a tracking issue, one per job, found again by its title,
 * so its pull requests say `Fixes #n` and the Bot page sees it like any task.
 * A job that changes code does nothing when there is nothing to do: the
 * branch is green, or a pull request it opened for that issue is still
 * waiting for review. A look-over always runs: saying all is quiet is news.
 */
import type { Command } from "./event.ts";
import type { CheckFailure, GitHub } from "./github.ts";

export type Job = { kind: "fix-ci" } | { kind: "look-over" } | { kind: "task"; task: string };

export function jobFrom(scheduled: string | undefined): Job | null {
  const text = scheduled?.trim() ?? "";
  if (!text) return null;
  const word = text.toLowerCase();
  if (word === "fix-ci") return { kind: "fix-ci" };
  if (word === "look-over") return { kind: "look-over" };
  return { kind: "task", task: text };
}

/** The task a look-over's summary carries, as the Bot page shows it. */
export const LOOK_TASK = "Look the repository over and suggest what to do next.";

export function jobTitle(job: Job, branch: string): string {
  if (job.kind === "fix-ci") return `Aperture Bot: fix what is red on ${branch}`;
  if (job.kind === "look-over") return "Aperture Bot: looking things over";
  const first = job.task.split("\n")[0]!.trim();
  return `Aperture Bot: ${first.length <= 60 ? first : `${first.slice(0, 59)}…`}`;
}

const MAX_FAILURES = 8;
const MAX_ANNOTATIONS = 10;
const DETAIL_CHARS = 1_500;

/** The task for a red branch: which checks fail, and what they said. */
export function fixCiTask(branch: string, sha: string, failures: CheckFailure[]): string {
  const lines = [
    `These checks fail on ${branch} at ${sha.slice(0, 7)}. Find why in the code, and fix it so they pass.`,
    "Never skip, delete or weaken a test to get there: if a test is wrong, say why in your answer and leave it.",
    "",
  ];
  for (const f of failures.slice(0, MAX_FAILURES)) {
    lines.push(`- ${f.name}`);
    if (f.detail.trim())
      lines.push(`  ${f.detail.trim().slice(0, DETAIL_CHARS).replace(/\n/g, "\n  ")}`);
    for (const a of f.annotations.slice(0, MAX_ANNOTATIONS)) lines.push(`  ${a}`);
  }
  if (failures.length > MAX_FAILURES) lines.push(`- and ${failures.length - MAX_FAILURES} more`);
  return lines.join("\n");
}

export type Planned = { command: Command } | { skip: string };

/** The command a job comes to on this run, or why it does nothing. */
export async function planJob(
  gh: GitHub,
  job: Job,
  repo: { owner: string; repo: string },
): Promise<Planned> {
  const branch = await gh.defaultBranch();
  let task = job.kind === "task" ? job.task : "";
  let body =
    job.kind === "task"
      ? `A standing job for Aperture Bot, run on the workflow's schedule:\n\n> ${job.task.replace(/\n/g, "\n> ")}`
      : "";
  if (job.kind === "look-over") {
    task = LOOK_TASK;
    body = [
      "Aperture Bot looks this repository over on its workflow's schedule and posts what it finds here: how things stand, and what it would do next.",
      "",
      "It changes nothing. To have a suggestion done, send it from the Bot page, or comment `/aperture` and the task.",
    ].join("\n");
  }
  if (job.kind === "fix-ci") {
    const sha = await gh.head(branch);
    const failures = sha ? await gh.failures(sha) : [];
    if (failures.length === 0) return { skip: `${branch} is green: nothing to fix.` };
    task = fixCiTask(branch, sha, failures);
    body = `Aperture Bot's nightly job found checks failing on ${branch}.\n\n${task}`;
  }
  const title = jobTitle(job, branch);
  const open = await gh.openIssues();
  const existing = open.find((i) => !i.isPull && i.title === title);
  if (existing && job.kind !== "look-over") {
    const waiting = (await gh.openPulls()).find((p) =>
      p.headRef.startsWith(`aperture/${existing.number}-`),
    );
    if (waiting)
      return {
        skip: `a pull request for #${existing.number} is waiting for review: ${waiting.url}`,
      };
  }
  const number = existing?.number ?? (await gh.createIssue(title, body));
  return {
    command: {
      number,
      isPull: false,
      title,
      body,
      task,
      commentId: null,
      author: "schedule",
      via: "schedule",
      ...(job.kind === "look-over" ? { look: true } : {}),
      owner: repo.owner,
      repo: repo.repo,
      defaultBranch: branch,
    },
  };
}
