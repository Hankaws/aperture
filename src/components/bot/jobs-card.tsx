import { useState } from "react";
import { CalendarClock, GitPullRequest, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setBotJobs, type BotSetup } from "@/lib/github/bot";
import { WEEKLY, WORKFLOW_PATH } from "@/lib/bot/tasks";
import { cn } from "@/lib/utils";

type Mode = "off" | "fix-ci" | "task";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "off", label: "Off" },
  { id: "fix-ci", label: "Fix what's red" },
  { id: "task", label: "A task" },
];

/**
 * The bot's standing jobs on this repo: its label, and what it does on its
 * schedule. Changing them opens a pull request on the workflow; nothing
 * changes until someone merges it.
 */
export function JobsCard({ setup, owner, name }: { setup: BotSetup; owner: string; name: string }) {
  const workflow = setup.workflow!;
  const now = workflow.jobs;
  const startMode: Mode = !now.scheduled ? "off" : now.scheduled === "fix-ci" ? "fix-ci" : "task";
  const [label, setLabel] = useState(now.label);
  const [mode, setMode] = useState<Mode>(startMode);
  const [task, setTask] = useState(startMode === "task" ? now.scheduled! : "");
  const [weekly, setWeekly] = useState(now.cron === WEEKLY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const editable = workflow.path === WORKFLOW_PATH;
  const scheduled = mode === "off" ? "" : mode === "fix-ci" ? "fix-ci" : task.trim();
  const changed =
    label !== now.label ||
    scheduled !== (now.scheduled ?? "") ||
    (mode === "task" && weekly !== (now.cron === WEEKLY));
  const ready = changed && !(mode === "task" && !task.trim());

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const out = await setBotJobs({
        data: { owner, repo: name, label, scheduled, weekly: mode === "task" && weekly },
      });
      if (out.ok) setOpened(out.url);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the pull request.");
    } finally {
      setBusy(false);
    }
  }

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
              onClick={() => setMode(m.id)}
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
            <label className="flex items-center gap-2 text-sm text-muted">
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
