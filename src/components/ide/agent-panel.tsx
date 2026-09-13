import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUp, AtSign, Clock, FileDiff, FileSearch, History, ListTodo, MessageSquare, MousePointer2, Paperclip, Play, ScrollText, Search, Sparkles, Square, Trash2, Undo2, Wrench, X } from "lucide-react";
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
import { quoteRun, quoteRuns } from "@/lib/billing/cost";
import { billedWorkers } from "@/lib/agent/fanout";
import { formatDiffNotes, notesOn } from "@/lib/workspace/diff-notes";
import { useAccount } from "@/lib/billing/use-account";
import { startJob } from "@/lib/jobs/api";
import { useJobs } from "@/lib/jobs/use-jobs";
import { cn } from "@/lib/utils";
import { DEMO_WORKSPACE_NAME } from "@/lib/workspace/demo-repo";
import { downloadDiffReport, filesFromEdits } from "@/lib/workspace/diff-report";
import {
  activeMention,
  filterMentions,
  mentionItems,
  type MentionItem,
} from "@/lib/workspace/mentions";
import { filesFromDataTransfer, importLocalFiles } from "@/lib/workspace/from-local";
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
  const captures = useIdeUi((s) => s.captures);
  const removeCapture = useIdeUi((s) => s.removeCapture);
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
  const [dropOn, setDropOn] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const messageCount = useRef(0);

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

  const last = messages[messages.length - 1];
  const streamKey = `${messages.length}:${last?.id ?? ""}:${last?.content.length ?? 0}:${last?.edits?.length ?? 0}:${last?.traces?.length ?? 0}:${agentRunning ? "1" : "0"}`;

  useEffect(() => {
    const grew = messages.length > messageCount.current;
    messageCount.current = messages.length;
    if (grew) stickToBottom.current = true;
    if (!stickToBottom.current) return;
    listEndRef.current?.scrollIntoView({ behavior: grew ? "smooth" : "auto", block: "end" });
  }, [streamKey, messages.length]);

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

  function insertContextPaths(paths: string[]) {
    if (paths.length === 0) return;
    const el = composerRef.current;
    const pos = el?.selectionStart ?? draft.length;
    const token = paths.map((path) => `@${path}`).join(" ");
    const left = draft.slice(0, pos);
    const right = draft.slice(pos);
    const padL = left && !/\s$/.test(left) ? " " : "";
    const insert = `${padL}${token} `;
    const next = left + insert + right;
    const nextCaret = left.length + insert.length;
    setDraft(next);
    setCaret(nextCaret);
    requestAnimationFrame(() => {
      const box = composerRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(nextCaret, nextCaret);
    });
  }

  async function attachFiles(list: File[]) {
    if (list.length === 0) return;
    try {
      const result = await importLocalFiles(list, "attach");
      const paths = Object.keys(result.files);
      if (paths.length === 0) {
        toast.error("No text files in that drop. Images and binaries are skipped.");
        return;
      }
      for (const [path, content] of Object.entries(result.files)) {
        const current = useWorkspace.getState();
        if (current.files[path] === undefined) current.createFile(path, content);
        else if (current.files[path] !== content) current.writeFile(path, content);
      }
      insertContextPaths(paths);
      toast.success(`Attached ${paths.length === 1 ? paths[0] : `${paths.length} files`} with @`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not attach files");
    }
  }

  async function openContextPicker() {
    const el = composerRef.current;
    const pos = el?.selectionStart ?? draft.length;
    const left = draft.slice(0, pos);
    const at = left.lastIndexOf("@");
    const typing = at >= 0 && !/[\s\n]/.test(left.slice(at + 1));
    if (typing) {
      setDismissMention(false);
      setCaret(pos);
      el?.focus();
      return;
    }
    const insert = left.length === 0 || /\s$/.test(left) ? "@" : " @";
    const next = left + insert + draft.slice(pos);
    const nextCaret = left.length + insert.length;
    setDraft(next);
    setCaret(nextCaret);
    setDismissMention(false);
    requestAnimationFrame(() => {
      const box = composerRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(nextCaret, nextCaret);
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
    const captures = useIdeUi.getState().captures;
    const trimmed = text.trim() || (captures.length > 0 ? "Revise the captured element. Keep the rest of the page." : "");
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
      useIdeUi.getState().clearCaptures();
      return;
    }
    const resolvedPhase: AgentPhase | undefined =
      mode === "composer" ? (phase ?? "plan") : undefined;
    await submitAgent(trimmed, mode === "inline" ? "composer" : mode, source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: target.kind === "acp" ? target.name : "Aperture",
      phase: resolvedPhase,
    });
    useIdeUi.getState().clearCaptures();
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

  async function sendNotes(edits: ChatMessage["edits"]) {
    const body = formatDiffNotes(edits ?? []);
    if (!body || agentRunning || !user) return;
    if (blocked || acpBlocked) return;
    await submitAgent(body, "composer", source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: target.kind === "acp" ? target.name : "Aperture",
      phase: "skip",
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

  const sendBlocked = (!draft.trim() && captures.length === 0) || isPending || !user || blocked || acpBlocked;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 items-center gap-1.5 border-b border-border px-2">
        <div className="flex rounded-md border border-border p-px">
          {(
            [
              ["composer", "Composer", Sparkles],
              ["chat", "Ask", MessageSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px]",
                mode === id ? "bg-elevated text-fg" : "text-subtle hover:text-fg",
              )}
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            title={rules ? `Open ${rules.path}` : "Create project rules"}
            aria-label={rules ? `Open ${rules.path}` : "Create project rules"}
            onClick={openRules}
          >
            <ScrollText className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            title="File history"
            aria-label="File history"
            onClick={() => useIdeUi.getState().setHistoryOpen(true)}
          >
            <History className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            title="Clear chat"
            aria-label="Clear chat"
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={listRef}
        className="aperture-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
        }}
      >
        {messages.length === 0 ? (
          <p className="text-xs text-subtle">Composer plans first. You click Build it.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBlock
                key={message.id}
                message={message}
                running={agentRunning}
                quoteLabel={
                  message.awaitingBuild
                    ? quoteRuns(
                        account,
                        source,
                        billedWorkers(message.plan, Object.keys(files), (n) => !quoteRuns(account, source, n).blocked),
                      ).label
                    : quote.label
                }
                onBuild={() => void buildPlan(message)}
                onSendNotes={() => void sendNotes(message.edits)}
              />
            ))}
            <div ref={listEndRef} aria-hidden className="h-px" />
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

      <div className="border-t border-border px-2.5 py-1.5">
        {messages.length === 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {suggestions.slice(0, 3).map((s) => (
              <button
                key={s}
                type="button"
                className="assist-chip max-w-full"
                onClick={() => {
                  setDraft(s);
                  if (user && !blocked && !acpBlocked) void send(s);
                }}
              >
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        )}
        <AssistChips />
      </div>

      {account && jobsOn && (
        <JobsTray
          jobs={jobs}
          cap={Math.max(1, account.backgroundJobs)}
          liveCount={liveCount}
          acp={account.acp}
          onJobs={setJobs}
        />
      )}

      <div className="border-t border-border p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <MentionPopover items={mentionHits} active={mentionHi} onPick={insertMention} />
          {captures.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {captures.map((cap) => (
                <li key={cap.id}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-fg"
                    onClick={() => removeCapture(cap.id)}
                    title="Remove capture"
                  >
                    {cap.screenshot ? (
                      <img src={cap.screenshot} alt="" className="size-5 rounded-sm object-cover" />
                    ) : (
                      <MousePointer2 className="size-3 text-accent" />
                    )}
                    <span className="max-w-28 truncate font-mono">{cap.selector}</span>
                    <X className="size-3 text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div
            data-drop="composer"
            className={cn("composer-rim relative rounded-xl p-px", agentRunning && "is-live", dropOn && "is-live")}
            onDragEnter={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              e.stopPropagation();
              setDropOn(true);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              e.stopPropagation();
              setDropOn(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDropOn(false);
            }}
            onDrop={(e) => {
              if (!e.dataTransfer?.files.length && !e.dataTransfer?.items.length) return;
              e.preventDefault();
              e.stopPropagation();
              setDropOn(false);
              void filesFromDataTransfer(e.dataTransfer).then((list) => attachFiles(list));
            }}
          >
            {dropOn && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[11px] bg-list-drop/80">
                <p className="text-sm font-medium text-fg">Drop files for Composer</p>
              </div>
            )}
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
                  ? "Ask about the repo. Use @ for context."
                  : "Describe the change. Use @ for context — Composer plans first."
              }
              rows={2}
              className="min-h-14 w-full resize-none rounded-[11px] border-0 bg-bg px-2.5 py-2 text-sm leading-snug text-fg placeholder:text-subtle focus-visible:outline-none"
            />
          </div>
          <div className="mt-2 space-y-2">
            <CostMeter
              quote={quote}
              acpLabel={target.kind === "acp" ? target.name : null}
              acpRemote={target.kind === "acp" && target.remote}
            />
            {signedOut ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Add context"
                  title="Add context with @"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
                  onClick={openContextPicker}
                >
                  <AtSign className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Add files"
                  title="Add files to Composer"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
                  onClick={() => attachRef.current?.click()}
                >
                  <Paperclip className="size-3.5" />
                </button>
                <Link
                  to="/login"
                  search={{ next: "/app" }}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Sign in
                </Link>
                <Link
                  to="/login"
                  search={{ next: "/app" }}
                  className={cn(buttonVariants({ size: "sm" }), "ml-auto")}
                >
                  <ArrowUp className="size-3.5" />
                  Plan
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Add context"
                  title="Add context with @"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
                  onClick={openContextPicker}
                >
                  <AtSign className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Add files"
                  title="Add files to Composer"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
                  onClick={() => attachRef.current?.click()}
                >
                  <Paperclip className="size-3.5" />
                </button>
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
            )}
          </div>
        </form>
        <input
          ref={attachRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            void attachFiles(list);
          }}
        />
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
  onSendNotes,
}: {
  message: ChatMessage;
  running: boolean;
  quoteLabel: string;
  onBuild: () => void;
  onSendNotes: () => void;
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
  const noteCount = notesOn(edits);
  const empty = !message.content.trim();
  const live = running && empty && plan.length === 0;
  const waiting = Boolean(message.awaitingBuild && plan.length > 0);
  const analyzing = live && runningMode === "chat";

  return (
    <div>
      <p className="text-xs font-medium text-subtle">{message.agentLabel || "Composer"}</p>
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
          {noteCount > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
              <p className="min-w-0 text-xs text-muted">
                {noteCount} {noteCount === 1 ? "note" : "notes"} for Composer. {quoteLabel}.
              </p>
              <Button size="sm" disabled={running} onClick={onSendNotes}>
                <MessageSquare className="size-3.5" />
                Send notes
              </Button>
            </div>
          )}
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
