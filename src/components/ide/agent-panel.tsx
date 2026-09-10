import { useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUp, Clock, FolderOpen, ScrollText, Square, Trash2, Undo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DiffCard } from "./diff-card";
import { PlanCard } from "./plan-card";
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
import { pickFolder } from "@/lib/workspace/import-bridge";
import {
  activeMention,
  filterMentions,
  mentionItems,
  type MentionItem,
} from "@/lib/workspace/mentions";
import { DEFAULT_RULES, findRules } from "@/lib/workspace/rules";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";
import type { AgentMode, ChatMessage, ToolTrace } from "@/lib/workspace/types";

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
  const { user, isPending } = useCurrentUserState();
  const { account, setAccount, refresh } = useAccount();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<AgentMode>("composer");
  const [caret, setCaret] = useState(0);
  const [mentionHi, setMentionHi] = useState(0);
  const [dismissMention, setDismissMention] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  async function send(text: string, background = false) {
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
    await submitAgent(trimmed, mode === "inline" ? "composer" : mode, source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: target.kind === "acp" ? target.name : "Aperture",
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
      <div className="flex h-10 items-center gap-1 border-b border-border px-2">
        <p className="px-1 text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">Composer</p>
        <div className="ml-1 flex rounded-md border border-border p-0.5">
          {(["composer", "chat"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] capitalize",
                mode === id ? "bg-elevated text-fg" : "text-subtle hover:text-fg",
              )}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={rules ? `Open ${rules.path}` : "Create project rules"}
            onClick={openRules}
          >
            <ScrollText className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Clear chat" onClick={clearChat} disabled={messages.length === 0}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="aperture-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <EmptyState
            suggestions={suggestions}
            signedOut={signedOut}
            rulesPath={rules?.path ?? null}
            onSuggest={(s) => {
              setDraft(s);
              if (user && !blocked && !acpBlocked) void send(s);
            }}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBlock key={message.id} message={message} running={agentRunning} />
            ))}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="text-[12px] text-muted">
            {pending.length} staged {pending.length === 1 ? "diff" : "diffs"}
          </p>
          <Button size="sm" onClick={() => applyAllPending()}>
            Apply all
          </Button>
        </div>
      )}
      {pending.length === 0 && checkpoints.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="min-w-0 truncate text-[12px] text-muted">Last run: {checkpoints[checkpoints.length - 1]!.label}</p>
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
        {signedOut ? (
          <div>
            <p className="text-sm text-muted">
              Sign in to run Composer. Opening a folder or zip does not need an account.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "sm" }))}>
                Sign in
              </Link>
              <Button variant="outline" size="sm" onClick={() => pickFolder()}>
                <FolderOpen className="size-3.5" />
                Open folder
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <MentionPopover items={mentionHits} active={mentionHi} onPick={insertMention} />
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
              placeholder="Ask a change. Use @ to attach files."
              rows={3}
              className="min-h-16 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
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
                    <Button type="button" size="icon-sm" aria-label="Stop" onClick={() => abortAgent()}>
                      <Square className="size-3.5 fill-current" />
                    </Button>
                  ) : (
                    <Button type="submit" size="icon-sm" disabled={sendBlocked} aria-label="Send">
                      <ArrowUp className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  suggestions,
  signedOut,
  rulesPath,
  onSuggest,
}: {
  suggestions: string[];
  signedOut: boolean;
  rulesPath: string | null;
  onSuggest: (text: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted">
        Composer posts a plan before the first diff. Claude Code, Codex, and OpenCode stream into the same cards.
      </p>
      {rulesPath ? (
        <p className="mt-1 text-[12px] text-subtle">Rules: {rulesPath}</p>
      ) : (
        <p className="mt-1 text-[12px] text-subtle">No rules file yet — create .aperture.md from the header.</p>
      )}
      <ul className="mt-4 space-y-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onSuggest(s)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-left text-[13px] text-muted hover:border-accent/40 hover:text-fg"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      {signedOut && (
        <p className="mt-4 text-[12px] text-subtle">Suggestions run after you sign in.</p>
      )}
    </div>
  );
}

function MessageBlock({ message, running }: { message: ChatMessage; running: boolean }) {
  if (message.role === "user") {
    return (
      <div>
        <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">You</p>
        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{message.content}</p>
      </div>
    );
  }

  const traces = message.traces ?? [];
  const edits = message.edits ?? [];
  const plan = message.plan ?? [];
  const empty = !message.content.trim();
  const live = running && empty && plan.length === 0;

  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
        {message.agentLabel || "Aperture"}
      </p>
      {plan.length > 0 && <PlanCard entries={plan} />}
      {traces.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-subtle">
          {traces.map((trace) => (
            <TraceLine key={trace.id} trace={trace} />
          ))}
        </ul>
      )}
      {live && (
        <p className="shimmer-text mt-2 text-[13px] text-muted">
          {message.status || traces[traces.length - 1]?.name || "Writing a plan…"}
        </p>
      )}
      {running && empty && plan.length > 0 && message.status && (
        <p className="shimmer-text mt-2 text-[13px] text-muted">{message.status}</p>
      )}
      {!empty && (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{message.content}</p>
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
    </div>
  );
}

function TraceLine({ trace }: { trace: ToolTrace }) {
  const detail =
    typeof trace.args.path === "string"
      ? trace.args.path
      : typeof trace.args.query === "string"
        ? trace.args.query
        : "";
  return (
    <li className="truncate">
      {trace.name}
      {detail ? ` · ${detail}` : ""}
      <span className="text-subtle"> · {trace.ms}ms</span>
    </li>
  );
}
