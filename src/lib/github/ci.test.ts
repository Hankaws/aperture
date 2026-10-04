import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checksFromGithub,
  ciFixLabel,
  ciFixPrompt,
  failureNotes,
  logExcerpt,
  overallState,
  runState,
  statusState,
  type CiCheck,
} from "./ci.ts";

test("a check run's state: running until completed, then by its conclusion", () => {
  assert.equal(runState("queued", null), "pending");
  assert.equal(runState("in_progress", null), "pending");
  assert.equal(runState("completed", "success"), "success");
  assert.equal(runState("completed", "failure"), "failure");
  assert.equal(runState("completed", "timed_out"), "failure");
  assert.equal(runState("completed", "cancelled"), "failure");
  assert.equal(runState("completed", "skipped"), "neutral");
  assert.equal(runState("completed", "neutral"), "neutral");
  assert.equal(statusState("error"), "failure");
  assert.equal(statusState("pending"), "pending");
});

test("CI as a whole: a red check is reported while others still run; no checks is not a pass", () => {
  assert.equal(overallState([]), "none");
  assert.equal(overallState([{ state: "pending" }, { state: "failure" }]), "failure");
  assert.equal(overallState([{ state: "pending" }, { state: "success" }]), "pending");
  assert.equal(overallState([{ state: "success" }, { state: "neutral" }]), "success");
});

test("a job log is cut to the failure, without timestamps, colours or group markers", () => {
  const esc = String.fromCharCode(27);
  const raw = [
    "2026-10-04T12:00:00.0000000Z ##[group]Run npm test",
    "2026-10-04T12:00:00.1000000Z > node --test",
    ...Array.from({ length: 100 }, (_, i) => `2026-10-04T12:00:01.0000000Z ok ${i + 1} - passes`),
    `2026-10-04T12:00:02.0000000Z ${esc}[31mnot ok 101 - listTasks starts at the first task${esc}[0m`,
    "2026-10-04T12:00:02.1000000Z   AssertionError: expected tsk_100, got tsk_101",
    "2026-10-04T12:00:02.2000000Z # pass 100",
    "2026-10-04T12:00:02.3000000Z ##[endgroup]",
    "2026-10-04T12:00:02.4000000Z ##[error]Process completed with exit code 1.",
  ].join("\n");
  const out = logExcerpt(raw, 10);
  const lines = out.split("\n");
  assert.ok(lines.length <= 10);
  assert.ok(out.includes("not ok 101 - listTasks starts at the first task"));
  assert.ok(out.includes("AssertionError: expected tsk_100, got tsk_101"));
  assert.ok(!out.includes(esc), "colour codes are stripped");
  assert.ok(!/\d{4}-\d\d-\d\dT/.test(out), "timestamps are stripped");
  assert.ok(!out.includes("##[group]"));
  // Nothing that looks like trouble: the plain tail.
  assert.equal(logExcerpt("a\nb\nc", 2), "b\nc");
});

test("the fix request names each failing check, where it failed, and its log", () => {
  const failures: CiCheck[] = [
    {
      id: "1",
      name: "typecheck · lint · test",
      state: "failure",
      url: null,
      summary: "1 failing test",
      annotations: [{ path: "src/store.ts", line: 31, message: "expected tsk_100" }],
      log: "not ok 1 - listTasks",
    },
  ];
  assert.equal(ciFixLabel(12, failures), "CI failed on #12: typecheck · lint · test. Fixing it.");
  const prompt = ciFixPrompt(12, failures);
  assert.match(prompt, /pull request #12/);
  assert.match(prompt, /Check: typecheck · lint · test/);
  assert.match(prompt, /- src\/store\.ts:31 expected tsk_100/);
  assert.match(prompt, /not ok 1 - listTasks/);
  assert.match(prompt, /Below 0\.8 the edit is dropped/);
  const huge = ciFixPrompt(12, [{ ...failures[0]!, log: "x".repeat(50_000) }]);
  assert.ok(huge.length < 13_000);
});

// Trimmed from GitHub's real responses for a failed CI run on this repository.
const RUNS = {
  check_runs: [
    {
      id: 111149885268,
      name: "Deploy demo to Vercel",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/Hankaws/aperture/actions/runs/37104358345/job/111149885268",
      app: {
        slug: "github-actions",
      },
      output: {
        title: null,
        summary: null,
      },
    },
    {
      id: 111149884899,
      name: "Grok export did not delete source",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/Hankaws/aperture/actions/runs/37104358269/job/111149884899",
      app: {
        slug: "github-actions",
      },
      output: {
        title: null,
        summary: null,
      },
    },
    {
      id: 111149884795,
      name: "typecheck · lint · test",
      status: "completed",
      conclusion: "failure",
      html_url: "https://github.com/Hankaws/aperture/actions/runs/37104358245/job/111149884795",
      app: {
        slug: "github-actions",
      },
      output: {
        title: null,
        summary: null,
      },
    },
  ],
};
const NOTES = [
  {
    path: ".github",
    start_line: 2,
    annotation_level: "warning",
    message:
      "Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/che",
  },
  {
    path: ".github",
    start_line: 21,
    annotation_level: "failure",
    message: "Process completed with exit code 1.",
  },
  {
    path: "src/lib/github/api.ts",
    start_line: 286,
    annotation_level: "failure",
    message: "Unexpected control character(s) in regular expression: \\x00, \\x1f",
  },
  {
    path: "src/lib/github/api.ts",
    start_line: 154,
    annotation_level: "failure",
    message: "Unexpected control character(s) in regular expression: \\x00, \\x1f",
  },
  {
    path: ".github",
    start_line: 73,
    annotation_level: "warning",
    message:
      "React Hook useMemo has a missing dependency: 'raw'. Either include it or remove the dependency array",
  },
  {
    path: ".github",
    start_line: 1,
    annotation_level: "notice",
    message:
      '"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.',
  },
];

test("GitHub's check runs and statuses become checks; Actions jobs are known by id", () => {
  const { checks, actionsJobs } = checksFromGithub(RUNS, { state: "pending", statuses: [] });
  assert.deepEqual(
    checks.map((check) => [check.name, check.state]),
    [
      ["Deploy demo to Vercel", "success"],
      ["Grok export did not delete source", "success"],
      ["typecheck · lint · test", "failure"],
    ],
  );
  assert.equal(overallState(checks), "failure");
  assert.ok(actionsJobs.has("111149884795"));
  assert.match(checks[2]!.url ?? "", /\/actions\/runs\/\d+\/job\/111149884795$/);
  // A combined status of "pending" with no statuses in it adds nothing: no CI reported that way.
  const legacy = checksFromGithub(null, {
    statuses: [{ context: "ci/circle", state: "error", description: "Build failed" }],
  });
  assert.deepEqual(
    legacy.checks.map((check) => [check.name, check.state, check.summary]),
    [["ci/circle", "failure", "Build failed"]],
  );
  assert.deepEqual(checksFromGithub({}, {}).checks, []);
});

test("only failure annotations are kept, without the exit-code line every failed job ends with", () => {
  const notes = failureNotes(NOTES);
  assert.deepEqual(
    notes.map((note) => `${note.path}:${note.line}`),
    ["src/lib/github/api.ts:286", "src/lib/github/api.ts:154"],
  );
  assert.match(notes[0]!.message, /Unexpected control character/);
  assert.deepEqual(
    failureNotes([
      { path: "../etc/passwd", start_line: 1, annotation_level: "failure", message: "x" },
    ]),
    [],
  );
  assert.deepEqual(failureNotes("nope"), []);
});
