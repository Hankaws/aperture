/**
 * A review receipt: what one Composer run changed and why, put in the order a
 * reviewer should read it. Developers trust an agent's change when they can
 * check it, and reviewing an agent's code takes longer than a colleague's; a
 * receipt says where to start.
 *
 * Each changed file gets the plan step that made it (matched from the edit's
 * own description), its size, and the reasons it deserves a look: it changes
 * the tests, the CI, the dependencies, sign-in or billing code, deletes a
 * file, changes what other files import, is large, or was edited without the
 * agent reading it first. Riskier files come first. Everything is read from
 * the run itself: nothing is asked of a model.
 *
 * Pure: tests import it directly.
 */
import { diffStats } from "../agent/apply-edit.ts";
import { isTestPath } from "../runner/tampering.ts";
import { groupRuns } from "./board.ts";
import type { ChatMessage, PlanEntry, ProposedEdit, ToolTrace } from "./types.ts";

export type Risk = "high" | "look" | "low";

export type ReceiptFile = {
  path: string;
  added: number;
  removed: number;
  deleted: boolean;
  risk: Risk;
  /** Why this file deserves a look, most important first. Empty for a low-risk file. */
  reasons: string[];
  /** What the edit says it does, in the agent's words. */
  change: string;
  /** The plan step it carries out, when one matches. */
  step?: string;
};

export type Receipt = {
  /** What the person asked for. */
  request: string;
  /** The plan, as it stood. */
  steps: string[];
  /** Changed files, riskiest first. */
  files: ReceiptFile[];
  /** Files the agent read and did not change. */
  read: string[];
  /** What it searched for. */
  searched: string[];
  /** One line: where to start reading, and why. */
  lookAt: string;
};

const CI_FILE =
  /^(?:\.github\/|\.gitlab-ci\.ya?ml$|\.circleci\/|azure-pipelines\.ya?ml$|Jenkinsfile$)/;
const DEPS = /(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;
const SENSITIVE =
  /(^|[/._-])(auth|login|logout|session|password|security|secret|token|crypto|billing|payment|checkout|invoice|permission|admin|middleware)s?([/._-]|$)/i;
const CONFIG =
  /(^|\/)([jt]sconfig[\w.-]*\.json|vite\.config\.[cm]?[jt]s|next\.config\.[cm]?[jt]s|eslint\.config\.[cm]?js|\.eslintrc[\w.]*|webpack\.config\.[cm]?js|vercel\.json|netlify\.toml|Dockerfile|docker-compose\.ya?ml|\.env\.[\w.]+)$/;
const QUIET = /\.(md|mdx|txt|css|scss|svg|png|jpe?g|gif|webp|ico)$/i;
const EXPORT_LINE = /^\s*export\s/;
const LARGE = 60;

const STOP = new Set(
  "a an the and or of to in on for with from by is are be it its this that as at into so add make use new update change fix".split(
    " ",
  ),
);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** The plan step an edit's description shares the most words with, two at least. */
export function stepFor(change: string, steps: string[]): string | undefined {
  const mine = words(change);
  let best: { step: string; score: number } | null = null;
  for (const step of steps) {
    let score = 0;
    for (const w of words(step)) if (mine.has(w)) score += 1;
    if (score >= 2 && (!best || score > best.score)) best = { step, score };
  }
  return best?.step;
}

function exportsMoved(oldText: string, newText: string): boolean {
  const before = oldText.split("\n").filter((l) => EXPORT_LINE.test(l));
  const after = newText.split("\n").filter((l) => EXPORT_LINE.test(l));
  if (before.length !== after.length) return true;
  const left = new Set(before.map((l) => l.trim()));
  return after.some((l) => !left.has(l.trim()));
}

/** Why a changed file deserves a look, and how much. */
export function riskOf(edit: ProposedEdit, readFirst: boolean): { risk: Risk; reasons: string[] } {
  const high: string[] = [];
  const look: string[] = [];
  const { added, removed } = diffStats(edit.oldText, edit.newText);
  if (edit.deleted) high.push("deletes the file");
  if (isTestPath(edit.path)) high.push("changes the tests");
  if (CI_FILE.test(edit.path)) high.push("changes the CI");
  if (DEPS.test(edit.path)) high.push("changes the dependencies or scripts");
  if (SENSITIVE.test(edit.path)) high.push("touches sign-in, security or billing code");
  if (CONFIG.test(edit.path)) look.push("changes project config");
  if (!edit.deleted && edit.oldText && exportsMoved(edit.oldText, edit.newText))
    look.push("changes what other files import");
  if (added + removed > LARGE) look.push(`a large change (+${added} −${removed})`);
  if (!readFirst && edit.oldText && !edit.deleted) look.push("edited without reading it first");
  if (high.length > 0) return { risk: "high", reasons: [...high, ...look] };
  if (look.length > 0 && !QUIET.test(edit.path)) return { risk: "look", reasons: look };
  return { risk: "low", reasons: look };
}

function argPath(trace: ToolTrace): string | null {
  const path = trace.args.path;
  return typeof path === "string" && path.trim() ? path.trim().replace(/^\.\//, "") : null;
}

const ORDER: Record<Risk, number> = { high: 0, look: 1, low: 2 };

/** The receipt for one run: its request, plan, what it read and what it changed. */
export function receiptFor(input: {
  request: string;
  plan?: PlanEntry[];
  traces: ToolTrace[];
  edits: ProposedEdit[];
}): Receipt {
  const steps = (input.plan ?? []).map((step) => step.content);
  const readPaths = new Set(
    input.traces
      .filter((t) => t.name === "read_file")
      .map(argPath)
      .filter((p): p is string => p !== null),
  );
  // The latest edit of each file is what it ends as.
  const latest = new Map<string, ProposedEdit>();
  for (const edit of input.edits) latest.set(edit.path, edit);
  const files: ReceiptFile[] = [...latest.values()].map((edit) => {
    const { added, removed } = diffStats(edit.oldText, edit.newText);
    // A run with no tool calls (an imported patch) never read anything: saying so of each file tells no one anything.
    const { risk, reasons } = riskOf(edit, input.traces.length === 0 || readPaths.has(edit.path));
    const step = stepFor(edit.description, steps);
    return {
      path: edit.path,
      added,
      removed,
      deleted: edit.deleted === true,
      risk,
      reasons,
      change: edit.description.trim(),
      ...(step ? { step } : {}),
    };
  });
  files.sort(
    (a, b) =>
      ORDER[a.risk] - ORDER[b.risk] ||
      b.added + b.removed - (a.added + a.removed) ||
      a.path.localeCompare(b.path),
  );
  const changed = new Set(files.map((f) => f.path));
  const searched = [
    ...new Set(
      input.traces
        .filter((t) => t.name === "grep" && typeof t.args.pattern === "string")
        .map((t) => String(t.args.pattern)),
    ),
  ];
  return {
    request: input.request.trim(),
    steps,
    files,
    read: [...readPaths].filter((p) => !changed.has(p)).sort(),
    searched,
    lookAt: lookAtLine(files),
  };
}

/** Where to start reading, and why. */
export function lookAtLine(files: ReceiptFile[]): string {
  const first = files[0];
  if (!first) return "Nothing changed.";
  if (first.risk === "low") {
    return files.length === 1
      ? `Nothing stands out: one small change to ${first.path}.`
      : `Nothing stands out: ${files.length} small changes.`;
  }
  const others = files.filter((f) => f.risk !== "low").length - 1;
  return `Start with ${first.path}: it ${first.reasons[0]}.${others > 0 ? ` Then ${others} more ${others === 1 ? "file" : "files"} worth a look.` : ""}`;
}

/** The run that staged these edits, gathered from the chat: its request, its plan and every tool it called. */
export function runFor(
  messages: ChatMessage[],
  edits: ProposedEdit[],
): { request: string; plan?: PlanEntry[]; traces: ToolTrace[] } | null {
  const ids = new Set(edits.map((edit) => edit.id));
  const run = groupRuns(messages).find((group) =>
    group.messages.some((m) => m.edits?.some((edit) => ids.has(edit.id))),
  );
  if (!run) return null;
  const request = run.messages.find((m) => m.role === "user" && !m.automatic)?.content ?? "";
  const plan = [...run.messages].reverse().find((m) => (m.plan?.length ?? 0) > 0)?.plan;
  const traces = run.messages.flatMap((m) => m.traces ?? []);
  return { request, ...(plan ? { plan } : {}), traces };
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

const MARK: Record<Risk, string> = { high: "🔴", look: "🟡", low: "⚪" };

/**
 * Receipts as Markdown, for a pull request's description: the request, where
 * to start, and a table of files by risk. Nothing secret is in a receipt: it
 * names files and repeats the agent's own one-line descriptions.
 */
export function receiptMarkdown(receipts: Receipt[]): string {
  const parts: string[] = ["## Review receipt", ""];
  for (const receipt of receipts) {
    if (receipt.files.length === 0) continue;
    parts.push(`**Asked:** ${cell(receipt.request).slice(0, 300) || "(no request)"}`, "");
    parts.push(`**Start here:** ${receipt.lookAt}`, "");
    parts.push("| | File | Change | Why look |", "|---|---|---|---|");
    for (const file of receipt.files) {
      const size = file.deleted ? "deleted" : `+${file.added} −${file.removed}`;
      const what = [file.step ? `Plan: ${file.step}` : "", file.change].filter(Boolean).join(" — ");
      parts.push(
        `| ${MARK[file.risk]} | \`${cell(file.path)}\` (${size}) | ${cell(what).slice(0, 200)} | ${cell(file.reasons.join("; ")) || "—"} |`,
      );
    }
    if (receipt.read.length > 0) {
      const shown = receipt.read.slice(0, 12).map((p) => `\`${cell(p)}\``);
      parts.push(
        "",
        `Read before writing, not changed: ${shown.join(", ")}${receipt.read.length > 12 ? ` and ${receipt.read.length - 12} more` : ""}.`,
      );
    }
    parts.push("");
  }
  parts.push(
    "🔴 deserves a careful look · 🟡 worth a look · ⚪ small. Made in Aperture, where every change is checked before it can be applied.",
  );
  return parts.join("\n");
}

/** A file about to be sent to GitHub: its new text, or gone. */
export type SentFile = { path: string; content: string } | { path: string; deleted: true };

/**
 * The receipts for what is about to be sent: for each run, newest first, the
 * applied edits that are still what a sent file says (a file changed again by
 * hand or a later run belongs to the later one). At most `max` runs.
 */
export function receiptsForSend(messages: ChatMessage[], sent: SentFile[], max = 3): Receipt[] {
  const sending = new Map(sent.map((file) => [file.path, file]));
  const claimed = new Set<string>();
  const out: Receipt[] = [];
  for (const run of [...groupRuns(messages)].reverse()) {
    const applied = run.messages
      .flatMap((m) => m.edits ?? [])
      .filter((edit) => edit.status === "applied" && !claimed.has(edit.path));
    const latest = new Map<string, ProposedEdit>();
    for (const edit of applied) latest.set(edit.path, edit);
    const mine = [...latest.values()].filter((edit) => {
      const file = sending.get(edit.path);
      if (!file) return false;
      return "deleted" in file
        ? edit.deleted === true
        : !edit.deleted && edit.newText === file.content;
    });
    if (mine.length === 0) continue;
    for (const edit of mine) claimed.add(edit.path);
    const request = run.messages.find((m) => m.role === "user" && !m.automatic)?.content ?? "";
    const plan = [...run.messages].reverse().find((m) => (m.plan?.length ?? 0) > 0)?.plan;
    out.push(
      receiptFor({
        request,
        ...(plan ? { plan } : {}),
        traces: run.messages.flatMap((m) => m.traces ?? []),
        edits: mine,
      }),
    );
    if (out.length >= max) break;
  }
  return out;
}
