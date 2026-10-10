/**
 * GitHub's answers as the short text Aperture Bot's chat reads: open issues,
 * one thread, a pull request's files, CI, releases, and its own tasks. Pure, so each shape is tested on plain
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

const FILES = 60;

/** A pull request's changed files: status and lines, the biggest first after GitHub's order. */
export function filesText(number: number, files: unknown[]): string {
  if (files.length === 0)
    return `Pull request #${number} changes no files, or is not a pull request.`;
  let added = 0;
  let removed = 0;
  const rows = files.flatMap((f) => {
    const r = f as Raw;
    const name = str(r.filename);
    if (!name) return [];
    const plus = typeof r.additions === "number" ? r.additions : 0;
    const minus = typeof r.deletions === "number" ? r.deletions : 0;
    added += plus;
    removed += minus;
    const from = str(r.previous_filename);
    return [
      `${str(r.status) || "modified"} ${from ? `${from} → ` : ""}${name} (+${plus} −${minus})`,
    ];
  });
  const more = rows.length > FILES ? [`… and ${rows.length - FILES} more files`] : [];
  return [
    `Pull request #${number}: ${rows.length} file${rows.length === 1 ? "" : "s"}, +${added} −${removed}`,
    ...rows.slice(0, FILES),
    ...more,
  ].join("\n");
}

/** The latest releases, then tags no release names: what shipped, and when. */
export function releasesText(releases: unknown[], tags: unknown[]): string {
  const named = new Set<string>();
  const rows = releases.slice(0, 10).flatMap((rel) => {
    const r = rel as Raw;
    const tag = str(r.tag_name);
    if (!tag) return [];
    named.add(tag);
    const when = str(r.published_at).slice(0, 10) || "unpublished";
    const kind = r.draft ? " (draft)" : r.prerelease ? " (pre-release)" : "";
    const notes = oneLine(str(r.body), 160);
    return [`${tag}${kind}, ${when}: ${oneLine(str(r.name)) || tag}${notes ? ` · ${notes}` : ""}`];
  });
  const loose = tags
    .map((t) => str((t as Raw).name))
    .filter((name) => name && !named.has(name))
    .slice(0, 10);
  const out = [
    ...(rows.length ? ["Releases, newest first:", ...rows] : ["No releases."]),
    ...(loose.length ? [`Other tags: ${loose.join(", ")}`] : []),
  ];
  return out.join("\n");
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
            : t.via === "pull"
              ? `a push by @${t.author}`
              : `@${t.author}`;
      const state =
        t.summary?.kind === "check" && (t.state === "clear" || t.state === "red")
          ? `Agent Check ${t.state === "red" ? "red: not ready to merge" : "clear"}`
          : (TASK_STATE[t.state] ?? t.state);
      return `#${t.number} "${oneLine(t.task || "do what the thread asks", 120)}" by ${who}: ${state}${link}`;
    })
    .join("\n");
}
