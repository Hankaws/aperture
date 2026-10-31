import { useState, type ReactNode } from "react";
import {
  CalendarClock,
  CircleAlert,
  GitPullRequest,
  Loader2,
  MessageSquareCode,
  MessageSquareText,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setBotJobs, type BotSetup } from "@/lib/github/bot";
import { WEEKLY, WORKFLOW_PATH } from "@/lib/bot/tasks";
import { cn } from "@/lib/utils";

type Mode = "off" | "fix-ci" | "look-over" | "task";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "off", label: "Off" },
  { id: "fix-ci", label: "Fix CI" },
  { id: "look-over", label: "Daily brief" },
  { id: "task", label: "A task" },
];

/** Modes whose schedule the person picks: every night or every Monday. */
const timed = (mode: Mode) => mode === "task" || mode === "look-over";

function modeOf(scheduled: string | null): Mode {
  if (!scheduled) return "off";
  if (scheduled === "fix-ci" || scheduled === "look-over") return scheduled;
  return "task";
}

/**
 * The bot's standing jobs on this repo: its label, what it does on its
 * schedule, and Agent Check on every pull request. Changing them opens a pull request on the workflow; nothing
 * changes until someone merges it.
 */
export function JobsCard({ setup, owner, name }: { setup: BotSetup; owner: string; name: string }) {
  const workflow = setup.workflow!;
  const now = workflow.jobs;
  const startMode = modeOf(now.scheduled);
  const [label, setLabel] = useState(now.label);
  const [pulls, setPulls] = useState(now.pulls);
  const [review, setReview] = useState(now.review);
  const [issues, setIssues] = useState(now.issues);
  const [red, setRed] = useState(now.red.length > 0);
  const [autoRed, setAutoRed] = useState(now.autoRed);
  const [mode, setMode] = useState<Mode>(startMode);
  const [task, setTask] = useState(startMode === "task" ? now.scheduled! : "");
  const [weekly, setWeekly] = useState(now.cron === WEEKLY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const editable = workflow.path === WORKFLOW_PATH;
  const scheduled = mode === "off" ? "" : mode === "task" ? task.trim() : mode;
  const changed =
    label !== now.label ||
    pulls !== now.pulls ||
    review !== now.review ||
    issues !== now.issues ||
    red !== now.red.length > 0 ||
    (red && autoRed) !== now.autoRed ||
    scheduled !== (now.scheduled ?? "") ||
    (timed(mode) && weekly !== (now.cron === WEEKLY));
  const ready = changed && !(mode === "task" && !task.trim());

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const out = await setBotJobs({
        data: {
          owner,
          repo: name,
          label,
          scheduled,
          weekly: timed(mode) && weekly,
          pulls,
          review,
          issues,
          red,
          autoRed: red && autoRed,
        },
      });
      if (out.ok) setOpened(out.url);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the pull request.");
    } finally {
      setBusy(false);
    }
  }

  const often: ReactNode = (
    <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <select
        value={weekly ? "weekly" : "nightly"}
        onChange={(event) => setWeekly(event.target.value === "weekly")}
        disabled={!editable}
        aria-label="How often"
        className="h-8 rounded-md border border-border bg-elevated px-2 text-sm text-fg"
      >
        <option value="nightly">Every night</option>
        <option value="weekly">Every Monday</option>
      </select>
      at 03:17 UTC, on its own issue.
    </label>
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="bot-jobs">
      <h2 id="bot-jobs" className="text-sm font-medium">
        Standing jobs
      </h2>
      <p className="mt-1 text-sm text-pretty text-muted">
        Work the bot takes on without being asked each time, on your runner and your key.
      </p>

      <label className="mt-4 flex cursor-pointer gap-3 text-sm">
        <input
          type="checkbox"
          checked={label}
          onChange={(event) => setLabel(event.target.checked)}
          disabled={!editable}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            <Tag className="size-3.5 text-subtle" />
            Take issues labelled <code className="font-mono text-xs">aperture</code>
          </span>
          <span className="mt-0.5 block text-muted">
            Add the label to an issue and the bot does what it says.
          </span>
        </span>
      </label>

      <label className="mt-4 flex cursor-pointer gap-3 text-sm">
        <input
          type="checkbox"
          checked={pulls}
          onChange={(event) => setPulls(event.target.checked)}
          disabled={!editable}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-3.5 text-subtle" />
            Check every pull request
          </span>
          <span className="mt-0.5 block text-muted">
            Aperture Agent Check on each push: one report on the pull request, kept up to date. It
            changes nothing and uses no model key.
          </span>
        </span>
      </label>

      <label className="mt-4 flex cursor-pointer gap-3 text-sm">
        <input
          type="checkbox"
          checked={review}
          onChange={(event) => setReview(event.target.checked)}
          disabled={!editable}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            <MessageSquareCode className="size-3.5 text-subtle" />
            Review every pull request
          </span>
          <span className="mt-0.5 block text-muted">
            On each push, the bot comments on the lines of likely bugs, only what it is at least 80%
            sure of, and replies with their fixes to tick. It changes nothing; it uses your key.
          </span>
        </span>
      </label>

      <label className="mt-4 flex cursor-pointer gap-3 text-sm">
        <input
          type="checkbox"
          checked={issues}
          onChange={(event) => setIssues(event.target.checked)}
          disabled={!editable}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            <MessageSquareText className="size-3.5 text-subtle" />
            Reply to new issues
          </span>
          <span className="mt-0.5 block text-muted">
            The bot reads each new issue and the code, and replies with what it would do, with a box
            to tick to have it done. At most 20 such replies a day, on your key.
          </span>
        </span>
      </label>

      <label className="mt-4 flex cursor-pointer gap-3 text-sm">
        <input
          type="checkbox"
          checked={red}
          onChange={(event) => setRed(event.target.checked)}
          disabled={!editable}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            <CircleAlert className="size-3.5 text-subtle" />
            Explain red CI on {setup.defaultBranch}
          </span>
          <span className="mt-0.5 block text-muted">
            When another workflow fails on {setup.defaultBranch}, the bot says why on its own issue,
            with a box to tick to have it fixed.
            {now.red.length > 0 && <> Watching {now.red.join(", ")}.</>}
          </span>
          {red && (
            <span className="mt-2 flex items-start gap-2 text-muted">
              <input
                type="checkbox"
                checked={autoRed}
                onChange={(event) => setAutoRed(event.target.checked)}
                disabled={!editable}
                aria-label="Fix red CI without asking"
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span>
                Fix it without asking: the bot opens a pull request with the fix straight away,
                still only when Aperture Agent Check is clear.
              </span>
            </span>
          )}
        </span>
      </label>

      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarClock className="size-3.5 text-subtle" />
          On a schedule
        </p>
        <div className="mt-2 flex rounded-lg border border-border p-0.5" role="radiogroup">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              disabled={!editable}
              onClick={() => {
                setMode(m.id);
                // A new brief starts daily, as its name says; Monday only is one click away.
                if (m.id === "look-over" && startMode !== "look-over") setWeekly(false);
              }}
              className={cn(
                "h-8 flex-1 rounded-md text-xs",
                mode === m.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === "fix-ci" && (
          <p className="mt-2 text-sm text-pretty text-muted">
            Every night at 03:17 UTC, fix whatever is red on {setup.defaultBranch}. Quiet when it is
            green, or while its last fix waits for review.
          </p>
        )}
        {mode === "look-over" && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-pretty text-muted">
              Each morning on its own issue: what needs you (CI on {setup.defaultBranch}, pull
              requests waiting, issues gone quiet) and up to five ideas from reading the code. It
              changes nothing: tick an idea on GitHub to have it done, or send it from this
              bot&apos;s chat.
            </p>
            {often}
          </div>
        )}
        {mode === "task" && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={task}
              onChange={(event) => setTask(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Update links in docs/ that no longer resolve"
              aria-label="Scheduled task"
              disabled={!editable}
            />
            {often}
          </div>
        )}
      </div>

      {editable ? (
        <div className="mt-4 space-y-2">
          <Button size="sm" onClick={() => void save()} disabled={busy || !ready}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitPullRequest className="size-4" />
            )}
            Open a pull request with these jobs
          </Button>
          {opened && (
            <p className="text-sm text-muted">
              <a
                href={opened}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Pull request opened
              </a>
              . The jobs start once it is merged.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-pretty text-muted">
          The bot's workflow is at{" "}
          <code className="font-mono text-xs break-all">{workflow.path}</code>, so change its jobs
          there, by hand (the bot's README shows how).
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
