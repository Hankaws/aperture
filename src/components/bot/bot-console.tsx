import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  GitPullRequest,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askBot, setUpBot } from "@/lib/github/bot";
import { ago } from "@/lib/bot/activity";
import { phaseLine, type BotPhase } from "@/lib/bot/summary";
import {
  isCheck,
  isSettled,
  PROVIDER_SECRET,
  type BotTask,
  type Provider,
  type TaskState,
} from "@/lib/bot/tasks";
import { cn } from "@/lib/utils";
import type { Setup } from "./use-repo-bot";

function Mark({ value }: { value: boolean | null }) {
  if (value === true) return <Check className="size-4 shrink-0 text-ok" aria-label="Done" />;
  if (value === false) return <X className="size-4 shrink-0 text-danger" aria-label="Not done" />;
  return <CircleDashed className="size-4 shrink-0 text-subtle" aria-label="Cannot tell" />;
}

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: "grok", label: "xAI Grok" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Google Gemini" },
  { id: "deepseek", label: "DeepSeek" },
];

export function SetupCard({
  setup,
  owner,
  name,
  onRecheck,
}: {
  setup: Setup;
  owner: string;
  name: string;
  onRecheck: () => Promise<void>;
}) {
  const ready = Boolean(setup.workflow) && setup.secret !== false && setup.pullsAllowed !== false;
  const [open, setOpen] = useState(!ready);
  const [provider, setProvider] = useState<Provider>("grok");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const settings = `https://github.com/${setup.fullName}/settings`;
  const secret = setup.workflow?.secret ?? PROVIDER_SECRET[provider];

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const out = await setUpBot({ data: { owner, repo: name, provider } });
      if (out.ok) setOpened(out.url);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the workflow.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface" aria-label="Set up">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {ready ? (
            <Check className="size-4 text-ok" />
          ) : (
            <CircleAlert className="size-4 text-warn" />
          )}
          {ready ? "Set up on this repo" : "Set up needed"}
        </span>
        <ChevronDown
          className={cn("size-4 text-subtle transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <Mark value={Boolean(setup.workflow)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">The workflow</p>
                {setup.workflow ? (
                  <p className="mt-0.5 font-mono text-xs break-all text-muted">
                    {setup.workflow.path}
                  </p>
                ) : opened ? (
                  <p className="mt-0.5 text-muted">
                    Opened{" "}
                    <a
                      href={opened}
                      className="text-accent hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      a pull request that adds it
                    </a>
                    . Merge it, then check again.
                  </p>
                ) : setup.canWrite ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={provider}
                      onChange={(event) => setProvider(event.target.value as Provider)}
                      aria-label="Model provider"
                      className="h-10 rounded-lg border border-border bg-elevated px-3 text-sm text-fg"
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <Button size="md" onClick={() => void add()} disabled={busy}>
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <GitPullRequest className="size-4" />
                      )}
                      Open a pull request that adds it
                    </Button>
                  </div>
                ) : (
                  <p className="mt-0.5 text-muted">
                    Someone who can write to this repo has to add it.
                  </p>
                )}
                {error && <p className="mt-2 text-danger">{error}</p>}
              </div>
            </li>
            <li className="flex gap-3">
              <Mark value={setup.secret} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  The model key, as the secret <code className="font-mono text-xs">{secret}</code>
                </p>
                <p className="mt-0.5 text-muted">
                  {setup.secret === null && !setup.isAdmin
                    ? "Only an admin of this repo can see its secrets. "
                    : ""}
                  Add it on GitHub; Aperture never sees it.{" "}
                  <a
                    href={`${settings}/secrets/actions`}
                    className="text-accent hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Repository secrets
                  </a>
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Mark value={setup.pullsAllowed} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Workflows may open pull requests</p>
                <p className="mt-0.5 text-muted">
                  Tick &ldquo;Allow GitHub Actions to create and approve pull requests&rdquo;.{" "}
                  <a
                    href={`${settings}/actions`}
                    className="text-accent hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Actions settings
                  </a>
                </p>
              </div>
            </li>
          </ol>
          <Button variant="outline" size="sm" onClick={() => void onRecheck()}>
            Check again
          </Button>
        </div>
      )}
    </section>
  );
}

const NEW = "new";

export function AskCard({
  setup,
  owner,
  name,
  onAsked,
}: {
  setup: Setup;
  owner: string;
  name: string;
  onAsked: () => void;
}) {
  const [target, setTarget] = useState<string>(NEW);
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const isNew = target === NEW;
  const trigger = setup.workflow?.trigger ?? "/aperture";

  async function send() {
    setBusy(true);
    setError(null);
    setAsked(null);
    try {
      const out = await askBot({
        data: {
          owner,
          repo: name,
          number: isNew ? undefined : Number(target),
          title: isNew ? title.trim() || undefined : undefined,
          task,
        },
      });
      if (!out.ok) {
        setError(out.error);
        return;
      }
      setTask("");
      setTitle("");
      setAsked(out.url);
      onAsked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ask.");
    } finally {
      setBusy(false);
    }
  }

  const canSend = !busy && (isNew ? task.trim().length > 0 : true);

  return (
    <section className="p-5" aria-label="Write the task yourself">
      <p className="text-sm text-pretty text-muted">
        Posts <code className="font-mono text-xs">{trigger}</code> and your task as a comment, from
        your GitHub account, the same as typing it there.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) void send();
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-muted">On</span>
          <span className="relative mt-1 block">
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-border bg-elevated pr-10 pl-3 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
            >
              <option value={NEW}>A new issue</option>
              {setup.open.map((item) => (
                <option key={item.number} value={String(item.number)}>
                  #{item.number} {item.isPull ? "(pull request) " : ""}
                  {item.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" />
          </span>
        </label>
        {isNew && (
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Issue title (optional: the task's first line)"
            maxLength={200}
            aria-label="Issue title"
          />
        )}
        <Textarea
          value={task}
          onChange={(event) => setTask(event.target.value)}
          placeholder={
            isNew
              ? "What should change? e.g. Show prices in dollars, with two decimals"
              : "What should change? Empty: what the thread asks."
          }
          rows={4}
          maxLength={4000}
          aria-label="Task"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSend) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSend}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Ask Aperture Bot
          </Button>
          {!setup.workflow && (
            <p className="text-sm text-warn">
              Nothing will answer until the workflow is on this repo.
            </p>
          )}
          {asked && (
            <a
              href={asked}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent hover:underline"
            >
              Asked on GitHub
            </a>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </section>
  );
}

type Filter = "all" | "moving" | "clear" | "blocked";

const FILTERS: Array<{ id: Filter; label: string; match: (s: TaskState) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "moving", label: "Working", match: (s) => !isSettled(s) },
  { id: "clear", label: "Clear", match: (s) => s === "clear" },
  {
    id: "blocked",
    label: "Not pushed",
    match: (s) =>
      s === "red" || s === "stopped" || s === "error" || s === "ended" || s === "silent",
  },
];

export function TaskList({ tasks, now }: { tasks: BotTask[]; now: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(
    () => tasks.filter((t) => FILTERS.find((f) => f.id === filter)!.match(t.state)),
    [tasks, filter],
  );
  if (tasks.length === 0)
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
        No tasks on this repo yet. Ask above, or comment{" "}
        <code className="font-mono text-xs">/aperture</code> on an issue.
      </p>
    );
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs",
              filter === f.id
                ? "border-fg/30 bg-elevated text-fg"
                : "border-border text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-3">
        {shown.map((t) => (
          <li key={t.id}>
            <TaskCard task={t} now={now} />
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-muted">None here.</li>}
      </ul>
    </>
  );
}

const STATE: Record<TaskState, { label: string; tone: string }> = {
  waiting: { label: "Queued", tone: "border-border text-muted" },
  working: { label: "Working", tone: "border-accent/30 bg-accent/10 text-accent" },
  clear: { label: "Clear", tone: "border-ok/30 bg-ok/10 text-ok" },
  red: { label: "Red, not pushed", tone: "border-danger/30 bg-danger/10 text-danger" },
  stopped: { label: "Stopped", tone: "border-warn/30 bg-warn/10 text-warn" },
  "no-change": { label: "No change", tone: "border-border text-muted" },
  declined: { label: "Declined", tone: "border-border text-muted" },
  error: { label: "Error", tone: "border-danger/30 bg-danger/10 text-danger" },
  ended: { label: "Run ended", tone: "border-warn/30 bg-warn/10 text-warn" },
  silent: { label: "No answer", tone: "border-warn/30 bg-warn/10 text-warn" },
  replied: { label: "Answered", tone: "border-border text-muted" },
};

const STEPS: Array<{ label: string; phases: BotPhase[] }> = [
  { label: "Plan", phases: ["starting", "planning"] },
  { label: "Change", phases: ["building", "fixing"] },
  { label: "Check", phases: ["checking"] },
  { label: "Publish", phases: ["publishing"] },
];

function Steps({ phase }: { phase: BotPhase }) {
  const at = STEPS.findIndex((s) => s.phases.includes(phase));
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progress">
      {STEPS.map((step, i) => (
        <li key={step.label} className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              "h-1 rounded-full",
              i < at ? "bg-accent" : i === at ? "animate-pulse bg-accent/70" : "bg-border",
            )}
          />
          <span className={cn("text-[11px]", i <= at ? "text-fg" : "text-subtle")}>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };
const MARK_TONE: Record<string, string> = {
  pass: "text-ok",
  fail: "text-danger",
  warn: "text-warn",
  skip: "text-subtle",
};

function whoAsked(task: BotTask): string {
  if (task.via === "schedule") return "Standing job";
  if (task.via === "label") return `Labelled by @${task.author}`;
  if (task.via === "pull") return `Pushed by @${task.author}`;
  return `@${task.author}`;
}

/** A check's result reads as a review, not as a change that was or was not pushed. */
const CHECKED: Partial<Record<TaskState, { label: string; tone: string }>> = {
  clear: { label: "Checked: clear", tone: "border-ok/30 bg-ok/10 text-ok" },
  red: { label: "Checked: red", tone: "border-danger/30 bg-danger/10 text-danger" },
};

/** `next` false leaves out the suggestions, for the chat, where they come as cards. */
export function TaskCard({
  task,
  now,
  next = true,
}: {
  task: BotTask;
  now: number;
  next?: boolean;
}) {
  const s = task.summary;
  const checking = isCheck(task);
  const state = (checking && CHECKED[task.state]) || STATE[task.state];
  const [showDiff, setShowDiff] = useState(false);
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
            state.tone,
          )}
        >
          {task.state === "working" && <Loader2 className="size-3 animate-spin" />}
          {state.label}
        </span>
        <a
          href={task.askedUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate text-sm text-muted hover:text-fg"
          title={task.thread?.title}
        >
          #{task.number} {task.thread?.title ?? ""}
        </a>
        <span className="ml-auto shrink-0 text-xs text-subtle">
          {whoAsked(task)} · {ago(task.askedAt, now)}
        </span>
      </div>
      <p className="mt-2 text-sm text-pretty [overflow-wrap:anywhere] whitespace-pre-line">
        {task.task || (
          <span className="text-muted">
            Do what the {task.thread?.isPull ? "pull request" : "issue"} asks.
          </span>
        )}
      </p>

      {task.state === "working" && s && (
        <div className="mt-4 space-y-2">
          {!checking && <Steps phase={s.phase ?? "starting"} />}
          <p className="text-sm text-muted">{phaseLine(s)}</p>
        </div>
      )}
      {task.state === "waiting" && (
        <p className="mt-3 text-sm text-muted">Waiting for the workflow to pick it up.</p>
      )}
      {task.state === "silent" && (
        <p className="mt-3 text-sm text-pretty text-muted">
          Nothing answered. The workflow has to be on the default branch, and @{task.author} needs
          write access.
        </p>
      )}
      {task.state === "ended" && (
        <p className="mt-3 text-sm text-muted">
          The run finished without a reply: cancelled, or out of time.
        </p>
      )}
      {task.state === "replied" && <p className="mt-3 text-sm text-muted">Answered on GitHub.</p>}
      {task.state === "declined" && (
        <p className="mt-3 text-sm text-muted">
          This pull request is from a fork; the bot does not run a fork&apos;s code.
        </p>
      )}
      {s?.error && task.state !== "working" && (
        <p className="mt-3 rounded-lg border border-border bg-elevated px-3 py-2 text-sm [overflow-wrap:anywhere]">
          {s.error}
        </p>
      )}

      {s?.link && (
        <a
          href={s.link.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok hover:bg-ok/15"
        >
          <GitPullRequest className="size-4" />
          {s.link.what === "pull"
            ? `Pull request #${s.link.url.split("/").at(-1)}`
            : "Commit on the pull request"}
          <ArrowUpRight className="size-3.5" />
        </a>
      )}

      {s?.plan && s.plan.length > 0 && task.state !== "working" && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted hover:text-fg">
            Plan, {s.plan.length} steps
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            {s.plan.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
      )}
      {s?.plan && s.plan.length > 0 && task.state === "working" && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          {s.plan.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}

      {s?.checks && s.checks.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {s.checks.map((row, i) => (
            <li key={i} className="flex gap-3 px-3 py-2 text-sm">
              <span
                className={cn("w-3 shrink-0 font-mono", MARK_TONE[row.status] ?? "text-subtle")}
              >
                {MARK[row.status] ?? "?"}
              </span>
              <span className="w-28 shrink-0 font-medium">{row.label}</span>
              <span className="min-w-0 text-muted [overflow-wrap:anywhere]">{row.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {next && s?.next && s.next.length > 0 && (
        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
          <p className="text-xs font-medium text-accent">Suggested next</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-pretty text-muted">
            {s.next.map((next, i) => (
              <li key={i}>{next}</li>
            ))}
          </ul>
        </div>
      )}

      {task.diff && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDiff((v) => !v)}
            aria-expanded={showDiff}
            className="text-sm text-muted hover:text-fg"
          >
            {showDiff ? "Hide" : "Show"} the change it did not push
          </button>
          {showDiff && <Diff text={task.diff} />}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
        {s?.files && s.files.length > 0 && (
          <span className="font-mono [overflow-wrap:anywhere]">{s.files.join(", ")}</span>
        )}
        {s?.usage && <span>{s.usage}</span>}
        {s?.run && (
          <a href={s.run} target="_blank" rel="noreferrer" className="hover:text-fg">
            The run
          </a>
        )}
        {task.replyUrl && (
          <a href={task.replyUrl} target="_blank" rel="noreferrer" className="hover:text-fg">
            On GitHub
          </a>
        )}
      </div>
    </article>
  );
}

function Diff({ text }: { text: string }) {
  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-editor p-3 font-mono text-xs leading-relaxed">
      {text.split("\n").map((line, i) => (
        <span
          key={i}
          className={cn(
            "block",
            line.startsWith("+") && !line.startsWith("+++") && "bg-diff-add text-ok",
            line.startsWith("-") && !line.startsWith("---") && "bg-diff-del text-danger",
            line.startsWith("@@") && "text-accent",
          )}
        >
          {line || " "}
        </span>
      ))}
    </pre>
  );
}
