import assert from "node:assert/strict";
import { test } from "node:test";
import { NIGHTLY, NO_JOBS, WEEKLY, workflowFile, workflowUse, withJobs } from "./tasks.ts";
import { briefState, otherJob, withTeamBrief } from "./team-jobs.ts";

const WITH_REVIEW = { ...NO_JOBS, pulls: true, review: true, label: true };

test("briefState reads where the daily brief stands", () => {
  assert.equal(briefState(NO_JOBS), "none");
  assert.equal(briefState({ ...NO_JOBS, scheduled: "look-over" }), "brief");
  assert.equal(briefState({ ...NO_JOBS, scheduled: "look-over", autoBrief: true }), "auto");
  assert.equal(briefState({ ...NO_JOBS, scheduled: "fix-ci" }), "other");
  assert.equal(briefState({ ...NO_JOBS, scheduled: "Update the docs" }), "other");
});

test("on: the brief is scheduled and does its top idea; the other jobs stay", () => {
  const added = withTeamBrief(WITH_REVIEW, true);
  assert.ok("jobs" in added);
  assert.deepEqual(added.jobs, {
    ...WITH_REVIEW,
    scheduled: "look-over",
    cron: NIGHTLY,
    autoBrief: true,
  });
  // A weekly brief stays weekly.
  const weekly = withTeamBrief({ ...NO_JOBS, scheduled: "look-over", cron: WEEKLY }, true);
  assert.ok("jobs" in weekly);
  assert.equal(weekly.jobs.cron, WEEKLY);
  assert.deepEqual(withTeamBrief({ ...NO_JOBS, scheduled: "look-over", autoBrief: true }, true), {
    skip: "Already on",
  });
  // A schedule that runs another job is left alone.
  assert.deepEqual(withTeamBrief({ ...NO_JOBS, scheduled: "fix-ci" }, true), {
    skip: "Its schedule fixes red CI; change it on its Setup panel",
  });
  assert.equal(
    otherJob({ ...NO_JOBS, scheduled: "Update the docs" }),
    "Its schedule runs a task of its own",
  );
});

test("off: the brief stays and only suggests", () => {
  const on = { ...WITH_REVIEW, scheduled: "look-over", cron: NIGHTLY, autoBrief: true };
  const off = withTeamBrief(on, false);
  assert.ok("jobs" in off);
  assert.deepEqual(off.jobs, { ...on, autoBrief: false });
  assert.deepEqual(withTeamBrief(NO_JOBS, false), { skip: "Already off" });
  assert.deepEqual(withTeamBrief({ ...NO_JOBS, scheduled: "look-over" }, false), {
    skip: "Already off",
  });
});

test("the switch round-trips through the workflow file, keeping its other jobs", () => {
  const text = workflowFile("grok", "v1", { ...WITH_REVIEW, red: ["CI"], autoRed: true });
  const now = workflowUse(text).jobs;
  const on = withTeamBrief(now, true);
  assert.ok("jobs" in on);
  const written = withJobs(text, on.jobs)!;
  assert.match(written, /always-allow: "red, brief"/);
  assert.deepEqual(workflowUse(written).jobs, on.jobs);
  const off = withTeamBrief(workflowUse(written).jobs, false);
  assert.ok("jobs" in off);
  assert.match(withJobs(written, off.jobs)!, / {10}always-allow: red\n/);
});
