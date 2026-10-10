/**
 * GitHub's answers as the short text Aperture Bot's chat reads: open issues,
 * one thread, CI, and its own tasks. Pure, so each shape is tested on plain
 * data; the server only fetches.
 */
import type { CiCheck } from "../github/ci.ts";
import type { BotTask } from "./tasks.ts";

type Raw = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value : "");
const oneLine = (text: string, max = 200) => text.replace(/\s+/g, " ").trim().slice(0, max);
const login = (user: unknown) => str((user as Raw | null)?.login) || "someone";

export function openText(items: unknown[]): string {
  const rows = items.flatMap((row) => {
    const r = row as Raw;
    if (typeof r.number !== "number") return [];
    const labels = Array.isArray(r.labels)
      ? r.labels.map((l) => str((l as Raw).name)).filter(Boolean)
      : [];
    const kind = r.pull_request ? "pull request" : "issue";
    return [
      `#${r.number} (${kind}) ${oneLine(str(r.title))}${labels.length ? ` [${labels.join(", ")}]` : ""} by @${login(r.user)}`,
    ];
  });
  return rows.length ? rows.join("\n") : "No open issues or pull requests.";
}

const BODY_CHARS = 3_000;
const COMMENT_CHARS = 1_000;
const COMMENTS = 8;

export function threadText(issue: unknown, comments: unknown[]): string {
  const i = issue as Raw;
  const kind = i.pull_request ? "Pull request" : "Issue";
  const state = str(i.state) || "open";
  const head = `${kind} #${String(i.number)} (${state}) by @${login(i.user)}: ${oneLine(str(i.title))}`;
  const body = str(i.body).trim().slice(0, BODY_CHARS) || "(no description)";
  const shown = comments.slice(-COMMENTS).map((c) => {
    const r = c as Raw;
    return `@${login(r.user)}: ${str(r.body).trim().slice(0, COMMENT_CHARS)}`;
  });
  // The thread may have more comments than were fetched: GitHub's count says how many.
  const total = Math.max(comments.length, typeof i.comments === "number" ? i.comments : 0);
  const more = total > shown.length ? [`(${total - shown.length} earlier comments not shown)`] : [];
  return [head, body, ...(shown.length ? ["Comments, oldest first:", ...more, ...shown] : [])].join(
    "\n\n",
  );
}

export function ciText(branch: string, sha: string, checks: CiCheck[]): string {
  if (checks.length === 0) return `No checks reported on ${branch} (${sha.slice(0, 7)}).`;
  const rows = checks.map(
    (c) =>
      `${c.state === "success" ? "✓" : c.state === "failure" ? "✗" : "·"} ${c.name}: ${c.state}`,
  );
  return [`CI on ${branch} (${sha.slice(0, 7)}):`, ...rows].join("\n");
}

const TASK_STATE: Record<string, string> = {
  waiting: "queued",
  working: "working",
  clear: "done, pull request or commit pushed",
  red: "stopped: Agent Check still red, nothing pushed",
  stopped: "stopped before finishing",
  "no-change": "changed nothing",
  declined: "declined (fork)",
  error: "error",
  ended: "run ended without a reply",
  silent: "never answered",
  replied: "answered",
};

export function tasksText(tasks: BotTask[]): string {
  if (tasks.length === 0) return "Aperture Bot has no tasks on this repository yet.";
  return tasks
    .slice(0, 15)
    .map((t) => {
      const link = t.summary?.link ? ` → ${t.summary.link.url}` : "";
      const who =
        t.via === "schedule"
          ? "a standing job"
          : t.via === "label"
            ? `the label, added by @${t.author}`
            : `@${t.author}`;
      return `#${t.number} "${oneLine(t.task || "do what the thread asks", 120)}" by ${who}: ${TASK_STATE[t.state] ?? t.state}${link}`;
    })
    .join("\n");
}
