/**
 * The Bot page's team-wide switch for the daily brief: on every repository,
 * a daily brief that does its top idea without asking (`always-allow:
 * brief`), or back to one that only suggests. Each repository's other jobs
 * stay as they are; a repository whose schedule already runs another job is
 * left alone, since a workflow has one schedule. Pure, for tests.
 */
import { NIGHTLY, type Jobs } from "./tasks.ts";

/** Where a repository's daily brief stands, for the Automation view's row. */
export type BriefState =
  /** The brief runs and does its top idea. */
  | "auto"
  /** The brief runs and only suggests. */
  | "brief"
  /** Nothing on the schedule: the switch adds the brief. */
  | "none"
  /** The schedule runs another job (fix-ci, or a task). */
  | "other";

export function briefState(jobs: Jobs): BriefState {
  if (jobs.scheduled === "look-over") return jobs.autoBrief ? "auto" : "brief";
  return jobs.scheduled ? "other" : "none";
}

/** What the schedule runs instead, in words, for a row the switch leaves alone. */
export function otherJob(jobs: Jobs): string {
  if (jobs.scheduled === "fix-ci") return "Its schedule fixes red CI";
  return "Its schedule runs a task of its own";
}

/**
 * The repository's jobs with the switch applied, or why they stay as they
 * are. On: the brief is scheduled (nightly when nothing was) and does its top
 * idea. Off: the brief stays, and only suggests.
 */
export function withTeamBrief(jobs: Jobs, on: boolean): { jobs: Jobs } | { skip: string } {
  const state = briefState(jobs);
  if (on) {
    if (state === "auto") return { skip: "Already on" };
    if (state === "other") return { skip: `${otherJob(jobs)}; change it on its Setup panel` };
    return {
      jobs: { ...jobs, scheduled: "look-over", cron: jobs.cron ?? NIGHTLY, autoBrief: true },
    };
  }
  if (state !== "auto") return { skip: "Already off" };
  return { jobs: { ...jobs, autoBrief: false } };
}
