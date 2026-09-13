import { useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUp, Circle, Clock, Ellipsis, FileDiff, FileSearch, History, ListTodo, Play, ScrollText, Search, Square, Trash2, Undo2, Wrench } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApertureMark } from "./logo";
import { DiffCard } from "./diff-card";
import { PlanCard } from "./plan-card";
import { AssistChips } from "./selection-actions";
import { MentionPopover } from "./mention-popover";
import { CostMeter } from "./cost-meter";
import { JobsTray } from "./jobs-tray";
import { ModelPicker, type RunTarget } from "./model-picker";
import { abortAgent, agentPayload, submitAgent } from "@/lib/agent/run";
import { listAgents, type AgentConnection } from "@/lib/acp/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { quoteRun } from "@/lib/billing/cost";
import { useAccount } from "@/lib/billing/use-account";
import { startJob } from "@/lib/jobs/api";
import { useJobs } from "@/lib/jobs/use-jobs";
import { cn } from "@/lib/utils";
import { DEMO_WORKSPACE_NAME } from "@/lib/workspace/demo-repo";
import { downloadDiffReport, filesFromEdits } from "@/lib/workspace/diff-report";
import { hasCodeRange } from "@/lib/workspace/edits";
import {
  activeMention,
  filterMentions,
  mentionItems,
  type MentionItem,
} from "@/lib/workspace/mentions";
import { DEFAULT_RULES, findRules } from "@/lib/workspace/rules";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";
import type { AgentMode, AgentDebug, ChatMessage, ToolTrace } from "@/lib/workspace/types";
import type { AgentPhase } from "@/lib/agent/phase";

const DEMO_SUGGESTIONS = [
  "Fix the off-by-one in listTasks",
  "Return 404 from getTask when the id is missing",
  "Reject titles longer than 80 characters",
  "Explain @src/store.ts",
];

const GENERIC_SUGGESTIONS = [
  "Summarize this repo",
  "Find bugs in the indexed files",
  "What does the active file do?",
  "Add a short README if one is missing",
];

export function AgentPanel({ composerRef }: { composerRef: RefObject<HTMLTextAreaElement | null> }) {
  const messages = useWorkspace((s) => s.messages);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const files = useWorkspace((s) => s.files);
  const name = useWorkspace((s) => s.name);
  const clearChat = useWorkspace((s) => s.clearChat);
  const applyAllPending = useWorkspace((s) => s.applyAllPending);
  const undoLast = useWorkspace((s) => s.undoLast);
  const checkpoints = useWorkspace((s) => s.checkpoints);
  const activePath = useWorkspace((s) => s.activePath);
  const selection = useWorkspace((s) => s.selection);
  const { user, isPending } = useCurrentUserState();
  const { account, setAccount, refresh } = useAccount();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<AgentMode>("composer");
  const [caret, setCaret] = useState(0);
  const [mentionHi, setMentionHi] = useState(0);
  const [dismissMention, setDismissMention] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agents, setAgents] = useState<AgentConnection[]>([]);
  const [target, setTarget] = useState<RunTarget>({ kind: "model", source: "hosted" });

  const jobsOn = Boolean(account && (account.backgroundJobs > 0 || account.acp));
  const { jobs, setJobs, refresh: refreshJobs, liveCount } = useJobs(jobsOn);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!account) return;
    setTarget((prev) =>
      prev.kind === "model" && prev.source !== account.modelSource ? { kind: "model", source: account.modelSource } : prev,
    );
  }, [account?.modelSource]);

  useEffect(() => {
    if (!account?.acp) {
      setAgents([]);
      return;
    }
    void listAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [account?.acp]);

  const catalog = useMemo(() => mentionItems(files), [files]);
  const mention = dismissMention ? null : activeMention(draft, caret);
  const mentionHits = mention ? filterMentions(catalog, mention.query) : [];
  const rules = findRules(files);
  const signedOut = mounted && !isPending && !user;
  const suggestions = name === DEMO_WORKSPACE_NAME ? DEMO_SUGGESTIONS : GENERIC_SUGGESTIONS;
  const pending = messages.flatMap((m) => m.edits ?? []).filter((e) => e.status === "pending");
  const source = target.kind === "model" ? target.source : account?.modelSource ?? "hosted";
  const quote = quoteRun(account, source);
  const blocked = target.kind === "model" && quote.blocked;
  const acpBlocked = target.kind === "acp" && target.remote === false && quote.blocked;

  useEffect(() => {
    setMentionHi(0);
  }, [mention?.query, mention?.start]);

  function syncCaret(el: HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function insertMention(item: MentionItem) {
    if (!mention) return;
    const insert = `@${item.path} `;
    const next = draft.slice(0, mention.start) + insert + draft.slice(caret);
    const nextCaret = mention.start + insert.length;
    setDraft(next);
    setDismissMention(false);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  async function queueBackground(text: string) {
    if (!account) return;
    if (account.backgroundJobs <= 0) {
      toast.error("Background jobs are on Pro. Composer in the panel still runs on Hobby.");
      return;
    }
    if (target.kind === "acp" && !account.acp) {
      toast.error("External agents are on Pro.");
      return;
    }
    const payload = agentPayload(
      text,
      mode === "inline" ? "composer" : mode,
      source,
      target.kind === "acp" ? target.id : null,
      { phase: "skip" },
    );
    try {
      const job = await startJob({
        data: { ...payload, agentId: target.kind === "acp" ? target.id : null },
      });
      setJobs([job, ...jobs.filter((j) => j.id !== job.id)]);
      void refreshJobs();
      toast.success("Queued in the background");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not queue");
    }
  }

  async function send(text: string, background = false, phase?: AgentPhase) {
    const trimmed = text.trim();
    if (!trimmed || agentRunning) return;
    if (!user) return;
    if (target.kind === "acp" && !account?.acp) {
      toast.error("ACP sessions are on Pro.");
      return;
    }
    if ((blocked || acpBlocked) && !background) return;
    setDraft("");
    setDismissMention(false);
    if (background) {
      await queueBackground(trimmed);
      return;
    }
    const resolvedPhase: AgentPhase | undefined =
      mode === "composer" ? (phase ?? "plan") : undefined;
    await submitAgent(trimmed, mode === "inline" ? "composer" : mode, source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: target.kind === "acp" ? target.name : "Aperture",
      phase: resolvedPhase,
    });
    void refresh();
  }

  async function buildPlan(message: ChatMessage) {
    if (agentRunning || !user || !message.plan?.length) return;
    useWorkspace.getState().patchMessage(message.id, { awaitingBuild: false });
    await submitAgent("Build it.", "composer", source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: message.agentLabel || (target.kind === "acp" ? target.name : "Aperture"),
      phase: "build",
      approvedPlan: message.plan,
    });
    void refresh();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionHits.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHi((i) => (i + 1) % mentionHits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHi((i) => (i - 1 + mentionHits.length) % mentionHits.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const item = mentionHits[mentionHi] ?? mentionHits[0];
        if (item) insertMention(item);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissMention(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  function openRules() {
    const ws = useWorkspace.getState();
    const existing = findRules(ws.files);
    if (existing) {
      ws.openFile(existing.path);
    } else {
      ws.createFile(".aperture.md", DEFAULT_RULES);
    }
    useIdeUi.getState().setMobilePane("editor");
  }

  const sendBlocked = !draft.trim() || isPending || !user || blocked || acpBlocked;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 items-center gap-2 px-3">
        <p className="text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase">
          {mode === "composer" ? "Composer" : "Ask"}
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          <div className="mr-1 flex rounded-md p-0.5">
            {(
              [
                ["composer", "Agent"],
                ["chat", "Ask"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "h-6 rounded px-1.5 text-[11px]",
                  mode === id ? "text-fg" : "text-subtle hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label="Composer actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Ellipsis className="size-4" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]">
                <button
                  type="button"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-fg hover:bg-bg"
                  onClick={() => {
                    setMenuOpen(false);
                    openRules();
                  }}
                >
                  <ScrollText className="size-3.5 text-subtle" />
                  {rules ? "Project rules" : "Create rules"}
                </button>
                <button
                  type="button"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-fg hover:bg-bg"
                  onClick={() => {
                    setMenuOpen(false);
                    useIdeUi.getState().setHistoryOpen(true);
                  }}
                >
                  <History className="size-3.5 text-subtle" />
                  File history
                </button>
                <button
                  type="button"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-fg hover:bg-bg disabled:opacity-40"
                  disabled={messages.length === 0}
                  onClick={() => {
                    setMenuOpen(false);
                    clearChat();
                  }}
                >
                  <Trash2 className="size-3.5 text-subtle" />
                  Clear chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="aperture-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <EmptyState
            suggestions={suggestions}
            path={activePath}
            onSuggest={(s) => {
              setDraft(s);
              if (user && !blocked && !acpBlocked) void send(s);
            }}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBlock
                key={message.id}
                message={message}
                running={agentRunning}
                quoteLabel={quote.label}
                onBuild={() => void buildPlan(message)}
              />
            ))}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="text-xs text-muted">
            {pending.length} staged {pending.length === 1 ? "diff" : "diffs"}
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadDiffReport({
                  title: pending[0]?.description || "Staged diffs",
                  workspace: name,
                  files: filesFromEdits(pending),
                })
              }
            >
              <FileDiff className="size-3.5" />
              Report
            </Button>
            <Button size="sm" onClick={() => applyAllPending()}>
              Apply all
            </Button>
          </div>
        </div>
      )}
      {pending.length === 0 && checkpoints.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="min-w-0 truncate text-xs text-muted">Last run: {checkpoints[checkpoints.length - 1]!.label}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => useIdeUi.getState().setHistoryOpen(true)}>
              <History className="size-3.5" />
              History
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const ck = undoLast();
                if (ck) toast.success(`Undid “${ck.label}”`);
              }}
            >
              <Undo2 className="size-3.5" />
              Undo last
            </Button>
          </div>
        </div>
      )}

      {hasCodeRange(selection) && (
        <div className="border-t border-border px-3 pt-2 pb-1">
          <AssistChips />
        </div>
      )}

      {account && jobsOn && (
        <JobsTray
          jobs={jobs}
          cap={Math.max(1, account.backgroundJobs)}
          liveCount={liveCount}
          acp={account.acp}
          onJobs={setJobs}
        />
      )}

      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <MentionPopover items={mentionHits} active={mentionHi} onPick={insertMention} />
          <div className={cn("composer-rim rounded-xl p-px", agentRunning && "is-live")}>
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDismissMention(false);
                syncCaret(e.target);
              }}
              onKeyUp={(e) => syncCaret(e.currentTarget)}
              onClick={(e) => syncCaret(e.currentTarget)}
              onKeyDown={onKeyDown}
              placeholder={
                mode === "chat"
                  ? "Ask about the repo. Nothing is written."
                  : "Fix pagination in @src/store.ts"
              }
              rows={3}
              className="min-h-16 w-full resize-none rounded-[11px] border-0 bg-bg px-3 py-2.5 text-sm leading-relaxed text-fg placeholder:text-subtle focus-visible:outline-none"
            />
          </div>
          {signedOut ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs text-subtle">Sign in to run this plan</p>
              <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "sm" }))}>
                Sign in
              </Link>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <CostMeter
                quote={quote}
                acpLabel={target.kind === "acp" ? target.name : null}
                acpRemote={target.kind === "acp" && target.remote}
              />
              <div className="flex items-center gap-2">
                {account && (
                  <ModelPicker
                    account={account}
                    target={target}
                    onTarget={setTarget}
                    onAccount={setAccount}
                    agents={agents}
                  />
                )}
                <div className="ml-auto flex items-center gap-1">
                  {mode === "composer" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={sendBlocked}
                      onClick={() => void send(draft, false, "skip")}
                    >
                      Build now
                    </Button>
                  )}
                  {account && account.backgroundJobs > 0 && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Send in background"
                      disabled={sendBlocked}
                      onClick={() => void send(draft, true)}
                    >
                      <Clock className="size-3.5" />
                    </Button>
                  )}
                  {agentRunning ? (
                    <Button type="button" size="sm" aria-label="Stop" onClick={() => abortAgent()}>
                      <Square className="size-3.5 fill-current" />
                      Stop
                    </Button>
                  ) : (
                    <Button type="submit" size="sm" disabled={sendBlocked} aria-label={mode === "chat" ? "Ask" : "Plan"}>
                      <ArrowUp className="size-3.5" />
                      {mode === "chat" ? "Ask" : "Plan"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function EmptyState({
  suggestions,
  path,
  onSuggest,
}: {
  suggestions: string[];
  path: string | null;
  onSuggest: (text: string) => void;
}) {
  return (
    <div>
      <div className="rounded-lg border border-border bg-bg px-2.5 py-2">
        <p className="text-[0.65rem] tracking-[0.14em] text-subtle uppercase">Plan</p>
        <div className="mt-1.5 space-y-0.5">
          {suggestions.slice(0, 3).map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => onSuggest(label)}
              className="flex w-full items-center gap-2 rounded-md px-0.5 py-1 text-left hover:bg-elevated"
            >
              <Circle className="size-3 shrink-0 text-subtle" strokeWidth={1.6} />
              <span className="min-w-0 truncate text-xs text-fg">
                <span className="mr-1.5 font-mono text-[0.7rem] text-subtle">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-xs text-subtle">Edit · {path ?? "no file"}</p>
        <span className="rounded-md bg-elevated px-2 py-0.5 text-xs text-subtle">Review</span>
      </div>
    </div>
  );
}

function AnalyzingCard({ status }: { status?: string }) {
  return (
    <div className="analyze-card mt-3 rounded-xl border border-border px-4 py-7 text-center">
      <ApertureMark className="generate-spin mx-auto size-8 text-accent" />
      <p className="mt-3 text-sm font-medium text-fg">{status || "Analyzing your code…"}</p>
      <p className="mt-1 text-xs text-subtle">Scanning the selection.</p>
    </div>
  );
}

function MessageBlock({
  message,
  running,
  quoteLabel,
  onBuild,
}: {
  message: ChatMessage;
  running: boolean;
  quoteLabel: string;
  onBuild: () => void;
}) {
  const runningMode = useWorkspace((s) => s.runningMode);
  if (message.role === "user") {
    return (
      <div className="rounded-xl border border-border bg-bg px-3 py-2">
        <p className="text-xs font-medium text-subtle">You</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">{message.content}</p>
      </div>
    );
  }

  const traces = message.traces ?? [];
  const edits = message.edits ?? [];
  const plan = message.plan ?? [];
  const empty = !message.content.trim();
  const live = running && empty && plan.length === 0;
  const waiting = Boolean(message.awaitingBuild && plan.length > 0);
  const analyzing = live && runningMode === "chat";

  return (
    <div>
      <p className="text-xs font-medium text-subtle">{message.agentLabel || "Agent"}</p>
      {plan.length > 0 && <PlanCard entries={plan} awaitingBuild={waiting} />}
      {traces.length > 0 && (
        <ul className="mt-2 space-y-1">
          {traces.map((trace) => (
            <TraceLine key={trace.id} trace={trace} />
          ))}
        </ul>
      )}
      {analyzing && <AnalyzingCard status={message.status} />}
      {live && !analyzing && (
        <p className="shimmer-text mt-2 text-sm text-muted">
          {message.status || traces[traces.length - 1]?.name || "Planning…"}
        </p>
      )}
      {running && empty && plan.length > 0 && message.status && (
        <p className="shimmer-text mt-2 text-sm text-muted">{message.status}</p>
      )}
      {!empty && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{message.content}</p>
      )}
      {waiting && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
          <p className="min-w-0 text-xs text-muted">Nothing is written until you build. {quoteLabel}.</p>
          <Button size="sm" disabled={running} onClick={onBuild}>
            <Play className="size-3.5" />
            Build it
          </Button>
        </div>
      )}
      {edits.length > 0 && (
        <div className="mt-3 space-y-2">
          {edits.map((edit) => (
            <DiffCard key={edit.id} edit={edit} />
          ))}
          {edits.some((e) => e.status === "applied") && message.checkpointId && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                const ck = useWorkspace.getState().undoCheckpoint(message.checkpointId!);
                if (ck) toast.success(`Undid “${ck.label}”`);
              }}
            >
              <Undo2 className="size-3.5" />
              Undo this run
            </Button>
          )}
        </div>
      )}
      {message.debug && <DebugBlock debug={message.debug} />}
    </div>
  );
}

function DebugBlock({ debug }: { debug: AgentDebug }) {
  return (
    <details className="mt-3 rounded-xl border border-border bg-bg px-3 py-2">
      <summary className="cursor-pointer text-xs text-subtle">
        Debug · {debug.model} · {debug.steps} {debug.steps === 1 ? "step" : "steps"}
      </summary>
      <pre className="aperture-scroll mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
        {`# system\n${debug.system}\n\n# user\n${debug.user}\n\n# response\n${debug.response}`}
      </pre>
    </details>
  );
}

function TraceLine({ trace }: { trace: ToolTrace }) {
  const detail =
    typeof trace.args.path === "string"
      ? trace.args.path
      : typeof trace.args.query === "string"
        ? trace.args.query
        : "";
  const name = trace.name;
  const Icon =
    name.includes("plan") ? ListTodo
    : name.includes("edit") || name.includes("write") || name.includes("patch") ? FileDiff
    : name.includes("grep") || name.includes("search") ? Search
    : name.includes("read") || name.includes("file") ? FileSearch
    : Wrench;
  const label = name.replace(/_/g, " ");

  return (
    <li className="flex items-center gap-2 rounded-md border border-border/80 bg-bg px-2 py-1 text-xs text-muted">
      <Icon className="size-3.5 shrink-0 text-subtle" strokeWidth={1.7} />
      <span className="truncate">
        <span className="text-fg">{label}</span>
        {detail ? <span className="text-subtle"> · {detail}</span> : null}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-subtle">{trace.ms}ms</span>
    </li>
  );
}
