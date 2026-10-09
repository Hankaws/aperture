/**
 * What Aperture Bot leaves on GitHub for Aperture to read back. Every comment
 * the bot writes ends with one hidden line, `<!-- aperture-bot {…} -->`, that
 * says the same thing as the visible text in a form a page can trust: which
 * comment asked, the run, where the work is, and how it ended. The bot writes
 * it and the Bot page reads it, so both import this file.
 *
 * Pure, with no imports, so the bot's bundle and the browser both take it.
 */

export type BotState = "working" | "clear" | "red" | "stopped" | "no-change" | "declined" | "error";

export type BotPhase = "starting" | "planning" | "building" | "checking" | "fixing" | "publishing";

export type BotCheckRow = { status: string; label: string; detail: string };

export type BotSummary = {
  v: 1;
  state: BotState;
  /** The id of the comment that asked; 0 when a label or the schedule did. */
  asked: number;
  /** How the bot was asked, when it was not a comment. */
  via?: "label" | "schedule";
  /** Who asked, when it was not a comment: whoever added the label, or "schedule". */
  by?: string;
  /** What was asked, when it was not a comment. */
  task?: string;
  /** The Actions run, as a github.com URL. */
  run: string;
  /** While working: what the bot is doing. */
  phase?: BotPhase;
  /** While checking or fixing: which Agent Check round, of how many. */
  round?: number;
  rounds?: number;
  plan?: string[];
  checks?: BotCheckRow[];
  files?: string[];
  /** Where the change went, when it was published. */
  link?: { url: string; what: "pull" | "commit" };
  /** Where tests ran; null when they were not run. */
  tests?: string | null;
  usage?: string;
  error?: string;
};

const OPEN = "<!-- aperture-bot ";
const CLOSE = " -->";

const LIMITS = { plan: 7, checks: 30, files: 100, text: 300, error: 1_000 };

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/** The summary kept to a size a comment can always carry. */
function bounded(summary: BotSummary): BotSummary {
  return {
    ...summary,
    plan: summary.plan?.slice(0, LIMITS.plan).map((step) => clip(step, LIMITS.text)),
    checks: summary.checks?.slice(0, LIMITS.checks).map((row) => ({
      status: row.status,
      label: clip(row.label, LIMITS.text),
      detail: clip(row.detail, LIMITS.text),
    })),
    files: summary.files?.slice(0, LIMITS.files),
    task: summary.task === undefined ? undefined : clip(summary.task, LIMITS.error),
    error: summary.error === undefined ? undefined : clip(summary.error, LIMITS.error),
  };
}

/**
 * The hidden line. `<` and `>` are written as JSON escapes, so nothing in the
 * text can end the HTML comment early.
 */
export function summaryMarker(summary: BotSummary): string {
  const json = JSON.stringify(bounded(summary)).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `${OPEN}${json}${CLOSE}`;
}

const STATES = new Set<string>([
  "working",
  "clear",
  "red",
  "stopped",
  "no-change",
  "declined",
  "error",
]);

function isString(value: unknown): value is string {
  return typeof value === "string";
}

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter(isString) : undefined;

/**
 * The summary a comment carries, or null when it has none. Comments are
 * written by anyone who can comment, so every field is checked, and only a
 * github.com link is kept.
 */
export function readSummary(body: string): BotSummary | null {
  const start = body.lastIndexOf(OPEN);
  if (start < 0) return null;
  const end = body.indexOf(CLOSE, start + OPEN.length);
  if (end < 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body.slice(start + OPEN.length, end));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.state !== "string" || !STATES.has(r.state)) return null;
  if (typeof r.asked !== "number" || !Number.isSafeInteger(r.asked)) return null;
  const out: BotSummary = {
    v: 1,
    state: r.state as BotState,
    asked: r.asked,
    run: isGithubUrl(r.run) ? r.run : "",
  };
  if (r.via === "label" || r.via === "schedule") out.via = r.via;
  if (typeof r.by === "string") out.by = r.by.slice(0, 100);
  if (typeof r.task === "string") out.task = r.task;
  if (typeof r.phase === "string" && r.phase in PHASE_TEXT) out.phase = r.phase as BotPhase;
  if (typeof r.round === "number") out.round = r.round;
  if (typeof r.rounds === "number") out.rounds = r.rounds;
  out.plan = strings(r.plan);
  out.files = strings(r.files);
  if (Array.isArray(r.checks))
    out.checks = r.checks.flatMap((row) => {
      const c = row as Record<string, unknown>;
      return typeof c?.status === "string" &&
        typeof c.label === "string" &&
        typeof c.detail === "string"
        ? [{ status: c.status, label: c.label, detail: c.detail }]
        : [];
    });
  const link = r.link as Record<string, unknown> | undefined;
  if (link && isGithubUrl(link.url) && (link.what === "pull" || link.what === "commit"))
    out.link = { url: link.url, what: link.what };
  if (typeof r.tests === "string" || r.tests === null) out.tests = r.tests;
  if (typeof r.usage === "string") out.usage = r.usage;
  if (typeof r.error === "string") out.error = r.error;
  return out;
}

function isGithubUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com";
  } catch {
    return false;
  }
}

/** What the bot is doing, in a few words. */
export const PHASE_TEXT: Record<BotPhase, string> = {
  starting: "Reading the thread and setting up",
  planning: "Planning the change",
  building: "Making the change",
  checking: "Running Aperture Agent Check",
  fixing: "Fixing what Agent Check found",
  publishing: "Agent Check is clear: publishing",
};

/** The phase as a line, with the round when there is one. */
export function phaseLine(summary: Pick<BotSummary, "phase" | "round" | "rounds">): string {
  const text = PHASE_TEXT[summary.phase ?? "starting"];
  const round =
    (summary.phase === "checking" || summary.phase === "fixing") && summary.round
      ? ` (round ${summary.round}${summary.rounds ? ` of ${summary.rounds}` : ""})`
      : "";
  return `${text}${round}.`;
}

/** The diff a reply shows in its "The change I did not push" block, if it has one. */
export function unpushedDiff(body: string): string | null {
  const match = /<summary>The change I did not push<\/summary>\s*```diff\n([\s\S]*?)\n```/.exec(
    body,
  );
  return match ? match[1]! : null;
}
