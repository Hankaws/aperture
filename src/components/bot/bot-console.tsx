import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  GitPullRequest,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listGithubRepos, type GithubRepoSummary } from "@/lib/github/api";
import { askBot, botSetup, botTasks, setUpBot, type BotSetup } from "@/lib/github/bot";
import { phaseLine, type BotPhase } from "@/lib/bot/summary";
import {
  isSettled,
  PROVIDER_SECRET,
  type BotTask,
  type Provider,
  type TaskState,
} from "@/lib/bot/tasks";
import { cn } from "@/lib/utils";

const REPO_KEY = "aperture-bot-repo";

function remembered(): string {
  try {
    return window.localStorage.getItem(REPO_KEY) ?? "";
  } catch {
    return "";
  }
}

function remember(fullName: string) {
  try {
    window.localStorage.setItem(REPO_KEY, fullName);
  } catch {
    // Private windows: the choice is just not kept.
  }
}

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The repo picker, then Set up, Ask and the tasks for the chosen repo. */
export function BotConsole() {
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repo, setRepo] = useState("");

  useEffect(() => {
    let cancel = false;
    void listGithubRepos({ data: {} })
      .then((out) => {
        if (cancel) return;
        if (!out.ok) {
          setRepoError(out.error);
          return;
        }
        setRepos(out.repos);
        const kept = remembered();
        setRepo(out.repos.some((r) => r.fullName === kept) ? kept : (out.repos[0]?.fullName ?? ""));
      })
      .catch(
        (err) =>
          !cancel && setRepoError(err instanceof Error ? err.message : "Could not list repos."),
      );
    return () => {
      cancel = true;
    };
  }, []);

  if (repoError)
    return (
      <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {repoError}
      </p>
    );
  if (!repos)
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-elevated" aria-label="Loading your repos" />
    );
  if (repos.length === 0)
    return (
      <p className="text-sm text-muted">
        The token on your account cannot see any repo. Give it repo access in Settings.
      </p>
    );

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="text-xs font-medium text-muted">Repository</span>
        <span className="relative mt-1 block">
          <select
            value={repo}
            onChange={(event) => {
              setRepo(event.target.value);
              remember(event.target.value);
            }}
            className="h-11 w-full appearance-none rounded-lg border border-border bg-elevated pr-10 pl-3 font-mono text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
          >
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
                {r.private ? " (private)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" />
        </span>
      </label>
      {repo && <RepoBot key={repo} fullName={repo} />}
    </div>
  );
}

type Setup = { ok: true } & BotSetup;

function RepoBot({ fullName }: { fullName: string }) {
  const [owner, name] = fullName.split("/") as [string, string];
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BotTask[] | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Until this time, poll fast: a task was just asked and has no answer yet. */
  const eager = useRef(0);

  const loadSetup = useCallback(async () => {
    setSetupError(null);
    try {
      const out = await botSetup({ data: { owner, repo: name } });
      if (out.ok) setSetup(out);
      else setSetupError(out.error);
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Could not read the repo.");
    }
  }, [owner, name]);

  const loadTasks = useCallback(async () => {
    setRefreshing(true);
    try {
      const out = await botTasks({ data: { owner, repo: name } });
      if (out.ok) {
        setTasks(out.tasks);
        setTasksError(null);
      } else setTasksError(out.error);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Could not read the tasks.");
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  }, [owner, name]);

  useEffect(() => {
    void loadSetup();
    void loadTasks();
  }, [loadSetup, loadTasks]);

  const active = (tasks ?? []).some((t) => !isSettled(t.state));
  useEffect(() => {
    // Every 10 seconds while something is moving, every minute otherwise; never in a hidden tab.
    const every = active || Date.now() < eager.current ? 10_000 : 60_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadTasks();
    }, every);
    return () => window.clearInterval(timer);
  }, [active, loadTasks, tasks]);

  return (
    <div className="space-y-6">
      {setupError ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {setupError}
        </p>
      ) : setup ? (
        <SetupCard setup={setup} owner={owner} name={name} onRecheck={loadSetup} />
      ) : (
        <div className="h-24 animate-pulse rounded-2xl bg-elevated" />
      )}
      {setup && (
        <AskCard
          setup={setup}
          owner={owner}
          name={name}
          onAsked={() => {
            eager.current = Date.now() + 5 * 60_000;
            void loadTasks();
          }}
        />
      )}
      <section aria-labelledby="bot-tasks">
        <div className="flex items-center justify-between gap-3">
          <h2 id="bot-tasks" className="text-lg font-medium">
            Tasks
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadTasks()}
            disabled={refreshing}
            aria-label="Refresh tasks"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
        {tasksError && <p className="mt-3 text-sm text-danger">{tasksError}</p>}
        {tasks === null ? (
          <div className="mt-3 h-32 animate-pulse rounded-2xl bg-elevated" />
        ) : (
          <TaskList tasks={tasks} now={now} />
        )}
      </section>
    </div>
  );
}

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

function SetupCard({
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

function AskCard({
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
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="bot-ask">
      <h2 id="bot-ask" className="text-lg font-medium">
        Ask
      </h2>
      <p className="mt-1 text-sm text-pretty text-muted">
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

function TaskList({ tasks, now }: { tasks: BotTask[]; now: number }) {
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

function TaskCard({ task, now }: { task: BotTask; now: number }) {
  const s = task.summary;
  const state = STATE[task.state];
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
          @{task.author} · {ago(task.askedAt, now)}
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
          <Steps phase={s.phase ?? "starting"} />
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
