import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  KeyRound,
  ListTodo,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { listGithubRepos, type GithubRepoSummary } from "@/lib/github/api";
import { chatKey, clearSavedChat, loadChat, type Entry } from "@/lib/bot/chat-saved";
import { mascotFor, suggestName, type Mascot, type MascotMood } from "@/lib/bot/mascot";
import { listBots } from "@/lib/bot/team.api";
import type { BotProfile } from "@/lib/bot/team";
import { cn } from "@/lib/utils";
import { BotActivity } from "./activity-feed";
import { AskCard, SetupCard, TaskList } from "./bot-console";
import { BotChat } from "./bot-chat";
import { FocusCard, NewBot, ProfilePanel } from "./bot-profile";
import { IdentityCard } from "./identity-card";
import { JobsCard } from "./jobs-card";
import { MascotAvatar } from "./mascot";
import { useRepoBot } from "./use-repo-bot";

const SELECTED_KEY = "aperture-bot-selected";

function readSelected(): string {
  try {
    return window.localStorage.getItem(SELECTED_KEY) ?? "";
  } catch {
    return "";
  }
}

function keepSelected(id: string) {
  try {
    window.localStorage.setItem(SELECTED_KEY, id);
  } catch {
    // Private windows: the choice is just not kept.
  }
}

type View = { kind: "bot"; id: string } | { kind: "activity" } | { kind: "new" };
type Panel = "profile" | "tasks" | "setup";

/** The last thing said in a bot's conversation, for the roster. */
function lastLine(entries: Entry[]): string {
  const last = entries.at(-1);
  if (!last) return "";
  const text = last.text
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return last.role === "user" ? `You: ${text}` : text;
}

const PANEL_CARD = "rounded-2xl border border-border bg-surface";

/**
 * The person's team of bots, as a messaging app: the roster on the left, the
 * chosen bot's conversation in the middle, its profile, tasks and setup in a
 * panel. On a phone the roster and a conversation take turns.
 */
export function BotTeam() {
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [bots, setBots] = useState<BotProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "new" });
  const [mobileMain, setMobileMain] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [query, setQuery] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancel = false;
    void Promise.all([listGithubRepos({ data: {} }), listBots()])
      .then(([listed, team]) => {
        if (cancel) return;
        if (!listed.ok) {
          setError(listed.error);
          return;
        }
        setRepos(listed.repos);
        setBots(team);
        setPreviews(Object.fromEntries(team.map((b) => [b.id, lastLine(loadChat(chatKey(b)))])));
        const kept = readSelected();
        const first = team.find((b) => b.id === kept) ?? team[0];
        setView(first ? { kind: "bot", id: first.id } : { kind: "new" });
      })
      .catch((err) => !cancel && setError(err instanceof Error ? err.message : "Could not load."));
    return () => {
      cancel = true;
    };
  }, []);

  const open = useCallback((next: View) => {
    setView(next);
    setMobileMain(true);
    if (next.kind === "bot") keepSelected(next.id);
    if (next.kind !== "bot") setPanel(null);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bots ?? []).filter(
      (b) => !q || b.name.toLowerCase().includes(q) || b.repo.toLowerCase().includes(q),
    );
  }, [bots, query]);

  const start = useMemo(() => {
    const taken = (bots ?? []).map((b) => b.name);
    const name = suggestName(taken, taken.length);
    const used = new Set((bots ?? []).map((b) => b.repo));
    const repo =
      (repos ?? []).find((r) => !used.has(r.fullName))?.fullName ?? repos?.[0]?.fullName ?? "";
    return { name, repo, mascot: mascotFor(`${name}:${repo}`) as Mascot, personality: "" };
  }, [bots, repos]);

  if (error)
    return (
      <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </p>
    );
  if (!repos || !bots)
    return (
      <div
        className="h-[36rem] animate-pulse rounded-2xl bg-elevated"
        aria-label="Loading your bots"
      />
    );
  if (repos.length === 0)
    return (
      <p className="text-sm text-muted">
        The token on your account cannot see any repo. Give it repo access in Settings.
      </p>
    );

  const current = view.kind === "bot" ? bots.find((b) => b.id === view.id) : undefined;
  const showMain = mobileMain || bots.length === 0;
  const back = (
    <button
      type="button"
      onClick={() => setMobileMain(false)}
      aria-label="Back to your bots"
      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg lg:hidden"
    >
      <ArrowLeft className="size-5" />
    </button>
  );

  const saved = (next: BotProfile[]) => setBots(next);

  return (
    <div className="relative flex h-[calc(100dvh-7.5rem)] min-h-[32rem] sm:h-[calc(100dvh-11rem)] sm:min-h-[36rem] overflow-hidden rounded-2xl border border-border bg-surface">
      <aside
        className={cn(
          "w-full flex-col border-border lg:flex lg:w-72 lg:shrink-0 lg:border-r",
          showMain ? "hidden" : "flex",
        )}
        aria-label="Your bots"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <h2 className="text-sm font-medium">Your bots</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => open({ kind: "new" })}
            aria-label="New bot"
            title="New bot"
          >
            <Plus className="size-5" />
          </Button>
        </div>
        <div className="relative px-3 pt-1">
          <Search className="pointer-events-none absolute top-1/2 left-6 mt-0.5 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search your bots"
            className="h-9 pl-9"
          />
        </div>
        <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {shown.map((bot) => {
            const selected = view.kind === "bot" && view.id === bot.id;
            return (
              <li key={bot.id}>
                <button
                  type="button"
                  onClick={() => open({ kind: "bot", id: bot.id })}
                  aria-current={selected || undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-elevated",
                    selected && "bg-elevated",
                  )}
                >
                  <MascotAvatar mascot={bot.mascot} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{bot.name}</span>
                      <span className="max-w-[45%] shrink-0 truncate font-mono text-[11px] text-subtle">
                        {bot.repo.split("/")[1]}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {previews[bot.id] || "Say hello"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {bots.length > 0 && shown.length === 0 && (
            <li className="px-3 py-4 text-sm text-muted">No bot matches.</li>
          )}
        </ul>
        <div className="space-y-0.5 border-t border-border p-2">
          <button
            type="button"
            onClick={() => open({ kind: "activity" })}
            aria-current={view.kind === "activity" || undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-elevated hover:text-fg",
              view.kind === "activity" && "bg-elevated text-fg",
            )}
          >
            <Activity className="size-4" />
            Activity
          </button>
          <Link
            to="/settings"
            search={{ tab: "models" }}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-elevated hover:text-fg"
          >
            <KeyRound className="size-4" />
            Model keys
          </Link>
        </div>
      </aside>

      <main
        className={cn("min-w-0 flex-1 flex-col", showMain ? "flex" : "hidden lg:flex")}
        aria-label={current ? current.name : view.kind === "activity" ? "Activity" : "New bot"}
      >
        {view.kind === "activity" ? (
          <>
            <div className="flex min-h-14 items-center gap-2 border-b border-border px-3 lg:hidden">
              {back}
              <span className="text-sm font-medium">Activity</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <PanelBoundary name="The activity feed" className={PANEL_CARD}>
                <BotActivity />
              </PanelBoundary>
            </div>
          </>
        ) : current ? (
          <BotRoom
            key={current.id}
            bot={current}
            repos={repos}
            back={back}
            panel={panel}
            setPanel={setPanel}
            onSaved={saved}
            onDeleted={(next) => {
              setBots(next);
              setPanel(null);
              setMobileMain(false);
              setView(next[0] ? { kind: "bot", id: next[0].id } : { kind: "new" });
            }}
            onChat={(entries) => setPreviews((p) => ({ ...p, [current.id]: lastLine(entries) }))}
          />
        ) : (
          <>
            {bots.length > 0 && (
              <div className="flex min-h-14 items-center gap-2 border-b border-border px-3 lg:hidden">
                {back}
                <span className="text-sm font-medium">New bot</span>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NewBot
                key={`${start.name}:${start.repo}`}
                repos={repos}
                first={bots.length === 0}
                start={start}
                onCreated={(bot, next) => {
                  setBots(next);
                  open({ kind: "bot", id: bot.id });
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const TABS: Array<{ id: Panel; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "tasks", label: "Tasks" },
  { id: "setup", label: "Setup" },
];

function BotRoom({
  bot,
  repos,
  back,
  panel,
  setPanel,
  onSaved,
  onDeleted,
  onChat,
}: {
  bot: BotProfile;
  repos: GithubRepoSummary[];
  back: React.ReactNode;
  panel: Panel | null;
  setPanel: (panel: Panel | null) => void;
  onSaved: (bots: BotProfile[]) => void;
  onDeleted: (bots: BotProfile[]) => void;
  onChat: (entries: Entry[]) => void;
}) {
  const r = useRepoBot(bot.repo);
  const working = (r.tasks ?? []).filter((t) => t.state === "working" || t.state === "waiting");
  const mood: MascotMood = working.length > 0 ? "working" : "idle";
  const notReady =
    r.setup !== null &&
    (!r.setup.workflow || r.setup.secret === false || r.setup.pullsAllowed === false);
  const status = r.setupError
    ? "Cannot read this repository"
    : !r.setup
      ? bot.repo
      : working.length > 0
        ? `Working on ${working.length === 1 ? "a task" : `${working.length} tasks`}`
        : notReady
          ? "Not set up on GitHub yet"
          : bot.repo;

  const lead = (
    <>
      {back}
      <button
        type="button"
        onClick={() => setPanel(panel === "profile" ? null : "profile")}
        className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 text-left hover:bg-elevated/60"
        aria-label={`${bot.name}'s profile`}
      >
        <MascotAvatar mascot={bot.mascot} mood={mood} size={34} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{bot.name}</span>
          <span
            className={cn(
              "block truncate text-xs",
              working.length > 0 ? "text-accent" : notReady ? "text-warn" : "text-subtle",
            )}
          >
            {status}
          </span>
        </span>
      </button>
    </>
  );

  const toggle = (next: Panel) => setPanel(panel === next ? null : next);
  const actions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("tasks")}
        aria-pressed={panel === "tasks"}
        title="Tasks"
      >
        <ListTodo className="size-4" />
        <span className="hidden sm:inline">Tasks</span>
        {working.length > 0 && (
          <span className="rounded-full bg-accent/15 px-1.5 text-xs text-accent">
            {working.length}
          </span>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("setup")}
        aria-pressed={panel === "setup"}
        title="Setup"
        className="relative"
      >
        <Settings2 className="size-4" />
        <span className="hidden sm:inline">Setup</span>
        {notReady && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warn" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("profile")}
        aria-pressed={panel === "profile"}
        title="Profile"
        className="hidden sm:inline-flex"
      >
        <UserRound className="size-4" />
      </Button>
    </>
  );

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {r.setupError ? (
          <>
            <div className="flex min-h-14 items-center gap-2.5 border-b border-border px-3">
              {lead}
            </div>
            <p className="m-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              {r.setupError}
            </p>
          </>
        ) : r.setup ? (
          <PanelBoundary
            name="The chat"
            className="flex-1"
            reset={{ label: "Clear the saved chat", run: () => clearSavedChat(chatKey(bot)) }}
          >
            <BotChat
              bot={bot}
              setup={r.setup}
              tasks={r.tasks ?? []}
              now={r.now}
              mood={mood}
              lead={lead}
              actions={actions}
              intro={bot.personality ? undefined : <FocusCard bot={bot} onSaved={onSaved} />}
              onSent={r.asked}
              onChange={onChat}
            />
          </PanelBoundary>
        ) : (
          <>
            <div className="flex min-h-14 items-center gap-2.5 border-b border-border px-3">
              {lead}
            </div>
            <div className="m-4 flex-1 animate-pulse rounded-2xl bg-elevated" />
          </>
        )}
      </div>

      {panel && (
        <aside
          className="absolute inset-0 z-20 flex flex-col bg-surface xl:static xl:z-auto xl:w-[25rem] xl:shrink-0 xl:border-l xl:border-border"
          aria-label={`${bot.name}: ${panel}`}
        >
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3">
            <div className="flex gap-1" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={panel === tab.id}
                  onClick={() => setPanel(tab.id)}
                  className={cn(
                    "h-8 rounded-lg px-3 text-sm",
                    panel === tab.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPanel(null)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "profile" && (
              <PanelBoundary name="The profile" className={PANEL_CARD}>
                <ProfilePanel
                  key={bot.updatedAt}
                  bot={bot}
                  repos={repos}
                  onSaved={onSaved}
                  onDeleted={onDeleted}
                />
              </PanelBoundary>
            )}
            {panel === "tasks" && (
              <PanelBoundary name="The task list" className={PANEL_CARD}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    Tasks on <span className="font-mono text-xs">{bot.repo}</span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void r.loadTasks()}
                    disabled={r.refreshing}
                    aria-label="Refresh tasks"
                  >
                    <RefreshCw className={cn("size-4", r.refreshing && "animate-spin")} />
                  </Button>
                </div>
                {r.tasksError && <p className="mt-3 text-sm text-danger">{r.tasksError}</p>}
                <div className="mt-3">
                  {r.tasks === null ? (
                    <div className="h-32 animate-pulse rounded-2xl bg-elevated" />
                  ) : (
                    <TaskList tasks={r.tasks} now={r.now} />
                  )}
                </div>
                {r.setup && (
                  <details className="mt-4 rounded-2xl border border-border bg-surface">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted hover:text-fg">
                      Write a task yourself
                    </summary>
                    <div className="border-t border-border">
                      <AskCard setup={r.setup} owner={r.owner} name={r.name} onAsked={r.asked} />
                    </div>
                  </details>
                )}
              </PanelBoundary>
            )}
            {panel === "setup" && (
              <PanelBoundary name="The bot's setup" className={PANEL_CARD}>
                {r.setup ? (
                  <div className="space-y-4">
                    <SetupCard
                      setup={r.setup}
                      owner={r.owner}
                      name={r.name}
                      onRecheck={r.loadSetup}
                    />
                    {r.setup.workflow && (
                      <JobsCard
                        key={JSON.stringify(r.setup.workflow.jobs)}
                        setup={r.setup}
                        owner={r.owner}
                        name={r.name}
                      />
                    )}
                    {r.setup.workflow && (
                      <IdentityCard
                        setup={r.setup}
                        owner={r.owner}
                        name={r.name}
                        mascot={bot.mascot}
                        botName={bot.name}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-32 animate-pulse rounded-2xl bg-elevated" />
                )}
              </PanelBoundary>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

const SAMPLE_TEAM: Array<{
  name: string;
  repo: string;
  mascot: Mascot;
  line: string;
  mood?: MascotMood;
}> = [
  {
    name: "Iris",
    repo: "acme/shop",
    mascot: { color: "teal", body: "iris", face: "wink" },
    line: "Working on #41",
    mood: "working",
  },
  {
    name: "Patch",
    repo: "acme/docs",
    mascot: { color: "amber", body: "squircle", face: "smile" },
    line: "Opened pull request #13",
  },
  {
    name: "Lumen",
    repo: "acme/api",
    mascot: { color: "violet", body: "lens", face: "happy" },
    line: "Main is green: 4 checks pass.",
  },
];

/** The team as a visitor sees it before signing in: a made-up example, marked as one. */
export function TeamPreview() {
  const iris = SAMPLE_TEAM[0]!;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-subtle">
        <span className="rounded-full border border-border px-2 py-0.5 font-medium">Example</span>
        Your team: a bot per repository, each with its own face and way of working.
      </div>
      <div className="grid sm:grid-cols-[15rem_1fr]">
        <ul className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:block sm:space-y-0.5 sm:border-r sm:border-b-0">
          {SAMPLE_TEAM.map((b, i) => (
            <li
              key={b.name}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-xl px-2.5 py-2",
                i === 0 && "bg-elevated",
              )}
            >
              <MascotAvatar mascot={b.mascot} mood={b.mood} size={40} />
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-medium">{b.name}</span>
                <span className="block truncate text-xs text-muted">{b.line}</span>
              </span>
              <span className="text-sm font-medium sm:hidden">{b.name}</span>
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
            <MascotAvatar mascot={iris.mascot} mood="working" size={32} />
            <span>
              <span className="block text-sm font-medium">{iris.name}</span>
              <span className="block text-xs text-accent">Working on a task</span>
            </span>
          </div>
          <div className="space-y-4 px-4 py-5 text-sm">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-elevated px-4 py-2.5">
              What&apos;s broken right now?
            </p>
            <div className="flex gap-3">
              <MascotAvatar mascot={iris.mascot} size={28} className="mt-0.5" />
              <div className="min-w-0 space-y-3">
                <p className="text-pretty">
                  Main is red:{" "}
                  <code className="rounded bg-elevated px-1 font-mono text-xs">test</code> fails in
                  the cart test since abc1234. The total adds cents as floats, so 0.1 + 0.2 comes
                  out a cent off. I&apos;d fix it in{" "}
                  <code className="rounded bg-elevated px-1 font-mono text-xs">src/cart.ts</code>.
                </p>
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <p className="text-xs font-medium text-accent">
                    Task on #41 Cart total is off by a cent
                  </p>
                  <p className="mt-1.5 text-pretty">
                    Add up the cart in whole cents, and make the cart test expect $0.30.
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Sent. Iris is running Aperture Agent Check (round 1 of 2).
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-auto border-t border-border p-3">
            <p className="rounded-2xl border border-border bg-elevated px-4 py-2.5 text-sm text-subtle">
              Message Iris
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
