/**
 * A pull request's CI, read from GitHub's check runs and commit statuses, and
 * what Composer is told when it fails. Nothing here fetches; api.ts does.
 */

export type CiState = "pending" | "success" | "failure" | "neutral";

export type CiAnnotation = { path: string; line: number | null; message: string };

export type CiCheck = {
  id: string;
  name: string;
  state: CiState;
  url: string | null;
  /** The check's own one-paragraph account: its output title and summary. */
  summary: string;
  /** Lines GitHub pinned the failure to. */
  annotations: CiAnnotation[];
  /** The end of the job's log, around the failure, when GitHub Actions ran it. */
  log: string;
};

export type CiOverall = "none" | "pending" | "failure" | "success";

const FAILED = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
  "stale",
  "error",
]);

/** A check run's state from its status and conclusion. */
export function runState(
  status: string | null | undefined,
  conclusion: string | null | undefined,
): CiState {
  if (status !== "completed") return "pending";
  if (conclusion === "success") return "success";
  if (conclusion && FAILED.has(conclusion)) return "failure";
  return "neutral";
}

/** A commit status's state (the older API some CI services still use). */
export function statusState(state: string | null | undefined): CiState {
  if (state === "success") return "success";
  if (state === "failure" || state === "error") return "failure";
  return "pending";
}

/** A known failure is reported at once, even while other checks still run. */
export function overallState(checks: Array<{ state: CiState }>): CiOverall {
  if (checks.length === 0) return "none";
  if (checks.some((check) => check.state === "failure")) return "failure";
  if (checks.some((check) => check.state === "pending")) return "pending";
  return "success";
}

type RawRun = {
  id?: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  details_url?: string;
  app?: { slug?: string };
  output?: { title?: string | null; summary?: string | null };
};
type RawStatus = {
  context?: string;
  state?: string;
  description?: string | null;
  target_url?: string | null;
};
type RawAnnotation = {
  path?: unknown;
  start_line?: unknown;
  message?: unknown;
  annotation_level?: unknown;
};

/**
 * Checks from GitHub's check-runs and combined-status responses. Also the
 * check runs GitHub Actions made, whose id is the job's, so its log can be read.
 */
export function checksFromGithub(
  runs: unknown,
  statuses: unknown,
): { checks: CiCheck[]; actionsJobs: Set<string> } {
  const checks: CiCheck[] = [];
  const actionsJobs = new Set<string>();
  const runRows = (runs as { check_runs?: unknown } | null)?.check_runs;
  for (const run of (Array.isArray(runRows) ? (runRows as RawRun[]) : []).slice(0, 50)) {
    const id = String(run.id ?? "");
    if (run.app?.slug === "github-actions") actionsJobs.add(id);
    checks.push({
      id,
      name: String(run.name ?? "Check").slice(0, 200),
      state: runState(run.status, run.conclusion),
      url: run.html_url ?? run.details_url ?? null,
      summary: [run.output?.title, run.output?.summary].filter(Boolean).join("\n").slice(0, 1500),
      annotations: [],
      log: "",
    });
  }
  const statusRows = (statuses as { statuses?: unknown } | null)?.statuses;
  for (const row of (Array.isArray(statusRows) ? (statusRows as RawStatus[]) : []).slice(0, 30)) {
    checks.push({
      id: `status:${row.context ?? ""}`,
      name: String(row.context ?? "Status").slice(0, 200),
      state: statusState(row.state),
      url: row.target_url ?? null,
      summary: String(row.description ?? "").slice(0, 500),
      annotations: [],
      log: "",
    });
  }
  return { checks, actionsJobs };
}

function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..")
  );
}

/**
 * The lines a failed check was pinned to. Failures only: warnings are runner
 * notices (a deprecated Node, an image moving), and "Process completed with
 * exit code 1" closes every failed job without saying why.
 */
export function failureNotes(raw: unknown): CiAnnotation[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawAnnotation[])
    .filter(
      (note) =>
        note.annotation_level === "failure" &&
        typeof note.path === "string" &&
        safePath(note.path) &&
        !/^Process completed with exit code/.test(String(note.message ?? "")),
    )
    .slice(0, 20)
    .map((note) => ({
      path: note.path as string,
      line: typeof note.start_line === "number" && note.start_line > 0 ? note.start_line : null,
      message: String(note.message ?? "").slice(0, 400),
    }));
}

// Built from strings so the source holds no control characters.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");
const STAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z ?/;
const NOISE = /^##\[(?:group|endgroup)\]/;
const TROUBLE =
  /\b(?:error|errors|failed|failing|failure|fail)\b|✗|✖|not ok\b|AssertionError|Exception|exit code [1-9]/i;

/**
 * The part of a job log worth reading: timestamps, colours and group markers
 * stripped, ending a few lines after the first sign of trouble from the end,
 * or the plain tail when nothing stands out.
 */
export function logExcerpt(raw: string, maxLines = 60): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(STAMP, "").replace(ANSI, "").trimEnd())
    .filter((line) => line.trim() && !NOISE.test(line));
  // "Process completed with exit code 1" closes every failed job; the cause is above it.
  let last = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (
      TROUBLE.test(lines[i]!) &&
      !/^##\[error\]Process completed with exit code/.test(lines[i]!)
    ) {
      last = i;
      break;
    }
  }
  const end = last >= 0 ? Math.min(lines.length, last + 6) : lines.length;
  return lines
    .slice(Math.max(0, end - maxLines), end)
    .join("\n")
    .slice(-6000);
}

/** The line Composer posts in the chat for a CI fix. The full detail goes in the instruction. */
export function ciFixLabel(pull: number, failures: CiCheck[]): string {
  const names = failures.map((check) => check.name).join(" · ");
  return `CI failed on #${pull}: ${names}. Fixing it.`;
}

const PROMPT_CAP = 12_000;

/** What Composer is told: each failing check, where GitHub pinned it, and the end of its log. */
export function ciFixPrompt(pull: number, failures: CiCheck[]): string {
  const parts = [
    `CI failed on pull request #${pull}. Fix only what makes these checks fail, with propose_edit. Pass confidence from 0 to 1. Below 0.8 the edit is dropped and the turn stops.`,
    "Change a test only when the test itself is wrong, and say so.",
  ];
  for (const check of failures) {
    const lines = [`Check: ${check.name}`];
    if (check.summary) lines.push(check.summary);
    if (check.annotations.length > 0) {
      lines.push("Where GitHub pinned it:");
      for (const note of check.annotations.slice(0, 12)) {
        lines.push(`- ${note.path}${note.line ? `:${note.line}` : ""} ${note.message}`);
      }
    }
    if (check.log) lines.push("End of the log:", "```", check.log, "```");
    parts.push(lines.join("\n"));
  }
  const text = parts.join("\n\n");
  return text.length > PROMPT_CAP ? `${text.slice(0, PROMPT_CAP)}\n…(cut)` : text;
}
