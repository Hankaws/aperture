import { useEffect, useMemo, useRef, useState, useCallback, useSyncExternalStore, memo, type KeyboardEvent, type RefObject } from "react";
import { useLatest } from "@/lib/use-keyed-async";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ImageTray, MessageImages } from "./image-tray";
import { QuestionCard } from "./question-card";
import { isSkillPath, projectSkills, skillName } from "@/lib/workspace/skills";
import { isLastReplyOfRun, repeatOf, requestOf, skillFromRun } from "@/lib/workspace/skill-draft";
import { useAttachedImages } from "./use-attached-images";
import { ArrowUp, Check, RotateCcw, FileDiff, FileSearch, FlaskConical, History, LayoutGrid, ListTodo, MessageSquare, MousePointer2, Play, ScrollText, Search, Sparkles, Square, Trash2, Undo2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { ApertureMark } from "./logo";
import { PlanCard } from "./plan-card";
import { SlashPopover } from "./slash-popover";
import { AssistChips } from "./selection-actions";
import { MentionPopover } from "./mention-popover";
import { JobsTray } from "./jobs-tray";
import { ModelPicker, type RunTarget } from "./model-picker";
import { CrewBar, WorkerConfirm } from "./crew-bar";
import { ModeMenu, PlusMenu } from "./composer-menu";
import { McpCallList } from "@/components/ide/mcp-call";
import { abortAgent, agentPayload, retrySend, submitAgent, wirePayload } from "@/lib/agent/run";
import { RESEND_FILES } from "@/lib/agent/wire";
import { sendBack } from "./send-back";
import { startBackgroundRun, startBestOf } from "@/lib/agent/background-runner";
import { BEST_OF } from "@/lib/agent/best-of";
import { BackgroundTray } from "./background-runs";
import { clearStanding, readStanding, saveStanding, subscribeStanding } from "@/lib/workspace/lessons";
import { listAgents, type AgentConnection } from "@/lib/acp/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatUsd, quoteRun, quoteRuns, replayQuote } from "@/lib/billing/cost";
import type { AccountSnapshot } from "@/lib/billing/api";
import { billedWorkers } from "@/lib/agent/fanout";
import { availableSeats, modelSeats, proposeReviewer, proposeWorkers, selectedSeats, type WorkerSpec } from "@/lib/agent/crew";
import { formatDiffNotes, notesOn, reviewInstruction } from "@/lib/workspace/diff-notes";
import { useAccount } from "@/lib/billing/use-account";
import { startJob } from "@/lib/jobs/api";
import { useJobs } from "@/lib/jobs/use-jobs";
import { basename, cn, modSymbol } from "@/lib/utils";
import { DEMO_WORKSPACE_NAME } from "@/lib/workspace/demo-repo";
import {
  activeMention,
  filterMentions,
  mentionItems,
  type MentionItem,
} from "@/lib/workspace/mentions";
import { filesFromDataTransfer, importLocalFiles } from "@/lib/workspace/from-local";
import { DEFAULT_RULES, findRules, RULE_CANDIDATES } from "@/lib/workspace/rules";
import { formatStackBody, extractStack, mergeStackSection } from "@/lib/agent/stack";
import { listPendingEdits } from "@/lib/workspace/edits";
import { openCopyIds, pendingForRun } from "@/lib/workspace/copies";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";
import { resolveAgentTask } from "@/lib/workspace/agent-task";
import { nextAction } from "@/lib/workspace/next-action";
import type { AgentMode, AgentDebug, ChatMessage, ToolTrace } from "@/lib/workspace/types";
import type { AgentPhase } from "@/lib/agent/phase";
import { nextComposerPhase, isBuildIntent } from "@/lib/agent/phase";
import { activeSlash, expandSlash, filterSlash, parseSkillSlash, parseSlash, skillInstruction } from "@/lib/agent/slash";
import { autoContextPaths } from "@/lib/agent/auto-context";
import { LearnMore } from "@/components/ui/learn-more";

/** A recorded change the checks refuse (`list-bad-return` in replay.ts): its words must match that tape. */
const HELD_DEMO = "Make listTasks return a number";

const DEMO_SUGGESTIONS = [
  "Fix the off-by-one in listTasks",
  // The demo's bad change: the checks hold it back, so the Held back / Send back path is one click.
  HELD_DEMO,
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
  const chatEmpty = useWorkspace((s) => s.messages.length === 0);
  const phaseHint = useWorkspace((s) => {
    const last = [...s.messages].reverse().find((m) => m.role === "assistant");
    if (last?.awaitingBuild && last.plan?.length) return "awaiting";
    if (last?.edits?.some((e) => e.status === "pending" || e.status === "applied")) return "edits";
    return "plan";
  });
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const fileList = useWorkspace((s) => s.fileList);
  const activePath = useWorkspace((s) => s.activePath);
  const openTabs = useWorkspace((s) => s.openTabs);
  const recentPaths = useWorkspace((s) => s.recentPaths);
  const name = useWorkspace((s) => s.name);
  const clearChat = useWorkspace((s) => s.clearChat);
  const undoLast = useWorkspace((s) => s.undoLast);
  const checkpoints = useWorkspace((s) => s.checkpoints);
  const captures = useIdeUi((s) => s.captures);
  const removeCapture = useIdeUi((s) => s.removeCapture);
  const steerQueue = useIdeUi((s) => s.steerQueue);
  const nextSteer = steerQueue[0];
  const crewIds = useIdeUi((s) => s.crewIds);
  const { user, isPending } = useCurrentUserState();
  const { account, setAccount, refresh } = useAccount();
  const [draft, setDraft] = useState("");
  const draftLoaded = useRef(false);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(DRAFT_KEY);
      if (saved) setDraft((now) => now || saved);
    } catch {
      // Storage blocked: the draft lives in this page only.
    }
    draftLoaded.current = true;
  }, []);
  useEffect(() => {
    // Not before the saved draft is read, or the empty first render would erase it.
    if (!draftLoaded.current) return;
    try {
      if (draft.trim()) window.sessionStorage.setItem(DRAFT_KEY, draft.slice(0, 20_000));
      else window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage blocked or full: nothing to keep.
    }
  }, [draft]);
  const [mode, setMode] = useState<AgentMode>("composer");
  // One choice instead of Plan / Build / Iterate: plan first (Composer follows the turn: a plan,
  // Build it, then iterating on the staged change), or edit straight away. Remembered per browser.
  const [planFirst, setPlanFirst] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PLAN_FIRST_KEY) === "0") setPlanFirst(false);
    } catch {
      // Storage blocked: plan first.
    }
  }, []);
  function togglePlanFirst() {
    const next = !planFirst;
    setPlanFirst(next);
    try {
      window.localStorage.setItem(PLAN_FIRST_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: it holds for this page.
    }
  }
  const phaseLock: AgentPhase | "auto" = planFirst ? "auto" : "skip";
  const [caret, setCaret] = useState(0);
  const [mentionHi, setMentionHi] = useState(0);
  const [dismissMention, setDismissMention] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<AgentConnection[]>([]);
  const [target, setTarget] = useState<RunTarget>({ kind: "model", source: "hosted" });
  /** A Best of 3 waiting for Start: the task, and what three runs cost. */
  const [bestOf, setBestOf] = useState<{ text: string; price: string } | null>(null);
  const [dropOn, setDropOn] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);
  /** Screenshots for the next message: pasted, dropped or picked (`use-attached-images.ts`). */
  const shots = useAttachedImages();

  const jobsOn = Boolean(account && (account.backgroundJobs > 0 || account.acp));
  const { jobs, setJobs, refresh: refreshJobs, liveCount } = useJobs(jobsOn);
  useEffect(() => useIdeUi.getState().setBoardJobs(jobs), [jobs]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modelSource = account?.modelSource;
  useEffect(() => {
    if (!modelSource) return;
    setTarget((prev) => (prev.kind === "model" && prev.source !== modelSource ? { kind: "model", source: modelSource } : prev));
  }, [modelSource]);

  useEffect(() => {
    if (!account?.acp) {
      setAgents([]);
      return;
    }
    void listAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [account?.acp]);

  const catalog = useMemo(() => mentionItems(fileList), [fileList]);
  const mention = dismissMention ? null : activeMention(draft, caret);
  const mentionHits = mention ? filterMentions(catalog, mention.query) : [];
  const slash = dismissMention ? null : activeSlash(draft, caret);
  // The project's skills, offered after the commands: `/release` uses that skill. Keyed on the skill files alone.
  const skillFiles = useWorkspace((s) =>
    Object.keys(s.files)
      .filter(isSkillPath)
      .sort()
      .map((path) => `${path}\u0000${s.files[path]}`)
      .join("\u0001"),
  );
  const skills = useMemo(
    () => projectSkills(useWorkspace.getState().files),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the skill files are the key
    [skillFiles],
  );
  const slashHits = slash ? filterSlash(slash.query, skills) : [];
  const autoPaths = autoContextPaths({
    activePath,
    openTabs,
    recentPaths,
    mentioned: [],
  });
  const rulesPath = RULE_CANDIDATES.find((path) => fileList.includes(path)) ?? null;
  const signedOut = mounted && !isPending && !user;
  const suggestions = name === DEMO_WORKSPACE_NAME ? DEMO_SUGGESTIONS : GENERIC_SUGGESTIONS;
  const source = target.kind === "model" ? target.source : account?.modelSource ?? "hosted";
  const replay = useIdeUi((s) => s.aiReplay);
  // Recorded runs cost nothing, so on a replay deployment a signed-out visitor can send too.
  const canSend = Boolean(user) || replay;
  const quote = replay ? replayQuote(quoteRun(account, source)) : quoteRun(account, source);
  const blocked = target.kind === "model" && quote.blocked;
  const acpBlocked = target.kind === "acp" && target.remote === false && quote.blocked;

  useEffect(() => {
    setMentionHi(0);
  }, [mention?.query, mention?.start, slash?.query]);

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

  async function attachFiles(all: File[]) {
    // Images go with the next message for the model to look at; text files become project files.
    const pictures = all.filter((file) => file.type.startsWith("image/"));
    if (pictures.length) void shots.add(pictures);
    const list = all.filter((file) => !file.type.startsWith("image/"));
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
    // Composer's own model runs in this tab, for every plan; an external agent runs on the server.
    if (target.kind === "model") {
      const why = startBackgroundRun(text, source);
      if (why) toast.error(why);
      else toast.success("Running in the background", { description: "It shows on the agent board (Ctrl/Cmd+Shift+B) when it is ready." });
      return;
    }
    if (account.backgroundJobs <= 0) {
      toast.error("Background jobs are not on this plan. Composer in the panel still runs.");
      return;
    }
    if (target.kind === "acp" && !account.acp) {
      toast.error("External agents are not on this plan.");
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
      const agentId = target.kind === "acp" ? target.id : null;
      // Only what changed since the saved copy, then everything if the server cannot use it.
      const job = await startJob({ data: { ...wirePayload(payload, true), agentId } }).catch((error: unknown) => {
        if (error instanceof Error && error.message === RESEND_FILES) {
          return startJob({ data: { ...wirePayload(payload, false), agentId } });
        }
        throw error;
      });
      setJobs([job, ...jobs.filter((j) => j.id !== job.id)]);
      void refreshJobs();
      toast.success("Queued in the background");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not queue");
    }
  }

  /** Best of 3 shows its price first: three runs cost three times one. */
  function askBestOf() {
    const text = draft.trim();
    if (!text) {
      toast.error("Type the task first, then pick Best of 3.");
      return;
    }
    const three = replay
      ? replayQuote(quoteRuns(account, source, BEST_OF))
      : quoteRuns(account, source, BEST_OF);
    if (three.blocked) {
      toast.error(three.blockReason ?? "Best of 3 cannot run on this model now.");
      return;
    }
    const one = replay ? replayQuote(quoteRun(account, source)) : quoteRun(account, source);
    setBestOf({
      text,
      price:
        three.cents > 0
          ? `${three.label}: ${BEST_OF} × ~${formatUsd(one.cents)}`
          : `${one.label} · ${one.sub}, ${BEST_OF} times`,
    });
  }

  function startBest() {
    if (!bestOf) return;
    const why = startBestOf(bestOf.text, source);
    setBestOf(null);
    if (why) {
      toast.error(why);
      return;
    }
    setDraft("");
    setDismissMention(false);
    toast.success("Best of 3 started", {
      description: "Three attempts in the background. The agent board (Ctrl/Cmd+Shift+B) ranks them when all are in.",
    });
  }

  async function send(text: string, background = false, phase?: AgentPhase) {
    const captures = useIdeUi.getState().captures;
    const images = shots.images;
    const trimmed =
      text.trim() ||
      (captures.length > 0 ? "Revise the captured element. Keep the rest of the page." : "") ||
      (images.length > 0 ? "Look at the attached image." : "");
    if (!trimmed || !canSend || shots.busy) return;
    if (images.length > 0 && (background || agentRunning || target.kind === "acp")) {
      toast.error(
        target.kind === "acp"
          ? "External agents do not take images here. Pick an Aperture model, or remove the images."
          : background
            ? "Images go with a normal send, not a background run."
            : "Images go with your next message, once this run finishes.",
      );
      return;
    }
    // A background run does not wait for the turn on screen: that is the point of it.
    if (background) {
      if (blocked || acpBlocked) return;
      const parsed = parseSlash(trimmed);
      const ws = useWorkspace.getState();
      const slashRun = parsed
        ? expandSlash(parsed.name, parsed.rest, {
            activePath: ws.activePath,
            selection: ws.selection,
            pending: listPendingEdits(ws.messages),
          })
        : null;
      const skillUse = parsed ? null : parseSkillSlash(trimmed, projectSkills(ws.files));
      setDraft("");
      setDismissMention(false);
      await queueBackground(
        slashRun?.instruction ?? (skillUse ? skillInstruction(skillUse.skill, skillUse.rest) : trimmed),
      );
      useIdeUi.getState().clearCaptures();
      return;
    }
    if (agentRunning) {
      useIdeUi.getState().enqueueSteer(trimmed);
      setDraft("");
      setDismissMention(false);
      return;
    }
    if (target.kind === "acp" && !account?.acp) {
      toast.error("ACP sessions are not on this plan.");
      return;
    }
    if (blocked || acpBlocked) return;
    setDraft("");
    setDismissMention(false);
    shots.clear();
    const parsed = parseSlash(trimmed);
    const ws = useWorkspace.getState();
    const slashRun = parsed
      ? expandSlash(parsed.name, parsed.rest, {
          activePath: ws.activePath,
          selection: ws.selection,
          pending: listPendingEdits(ws.messages),
        })
      : null;
    // `/release …`: the skill is loaded for this turn, and its checks hold the change.
    const skillUse = parsed ? null : parseSkillSlash(trimmed, projectSkills(ws.files));
    const resolved =
      slashRun
        ? { phase: slashRun.phase, approvedPlan: undefined }
        : mode === "composer"
          ? nextComposerPhase(
              ws.messages,
              trimmed,
              phase ?? (phaseLock === "auto" ? undefined : phaseLock),
            )
          : { phase: undefined as AgentPhase | undefined, approvedPlan: undefined };
    await submitAgent(trimmed, slashRun?.mode ?? (mode === "inline" ? "composer" : mode), source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: target.kind === "acp" ? target.name : "Aperture",
      phase: resolved.phase,
      approvedPlan: resolved.approvedPlan,
      apiInstruction:
        slashRun?.instruction ?? (skillUse ? skillInstruction(skillUse.skill, skillUse.rest) : undefined),
      ...(skillUse ? { withSkills: [skillUse.skill.path] } : {}),
      ...(images.length ? { images } : {}),
    });
    useIdeUi.getState().clearCaptures();
    void refresh();
  }

  async function buildPlan(message: ChatMessage, workers?: WorkerSpec[]) {
    if (agentRunning || !canSend || !message.plan?.length) return;
    useWorkspace.getState().patchMessage(message.id, { awaitingBuild: false });
    await submitAgent("Build it.", "composer", workers?.[0]?.source ?? source, {
      agentId: workers?.length ? null : target.kind === "acp" ? target.id : null,
      agentLabel: message.agentLabel || (target.kind === "acp" ? target.name : "Aperture"),
      phase: "build",
      approvedPlan: message.plan,
      workers,
    });
    void refresh();
  }

  async function sendNotes(edits: ChatMessage["edits"]) {
    const body = formatDiffNotes(edits ?? []);
    if (!body || agentRunning || !canSend) return;
    if (blocked || acpBlocked) return;
    await submitAgent(body, "composer", source, {
      agentId: target.kind === "acp" ? target.id : null,
      agentLabel: target.kind === "acp" ? target.name : "Aperture",
      phase: "skip",
    });
    void refresh();
  }

  function insertSlash(item: { name: string }) {
    const next = `/${item.name} `;
    setDraft(next);
    setDismissMention(false);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
      setCaret(next.length);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashHits.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHi((i) => (i + 1) % slashHits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHi((i) => (i - 1 + slashHits.length) % slashHits.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const item = slashHits[mentionHi] ?? slashHits[0];
        if (item) insertSlash(item);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissMention(true);
        return;
      }
    }
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
    if (e.key === "Enter" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!sendBlocked) void send(draft, true);
      return;
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
      ws.createFile(
        ".aperture.md",
        mergeStackSection(DEFAULT_RULES, formatStackBody(extractStack(ws.files, ws.name))),
      );
    }
    useIdeUi.getState().setMobilePane("editor");
  }

  const sendBlocked =
    (!draft.trim() && captures.length === 0 && shots.images.length === 0) || shots.busy || isPending || !canSend || blocked || acpBlocked;
  const autoPhase: AgentPhase =
    phaseHint === "awaiting" && isBuildIntent(draft) ? "build" : phaseHint === "edits" ? "skip" : "plan";
  const sendPhase: AgentPhase = mode === "composer" ? (phaseLock === "auto" ? autoPhase : phaseLock) : "plan";
  const sendLabel = mode === "chat" ? "Ask" : sendPhase === "build" ? "Build" : sendPhase === "skip" ? "Iterate" : "Plan";

  const sendRef = useLatest(send);
  useEffect(() => {
    if (agentRunning || !canSend) return;
    const next = useIdeUi.getState().steerQueue[0];
    if (!next) return;
    useIdeUi.getState().shiftSteer();
    void sendRef.current(next);
  }, [agentRunning, canSend, nextSteer, sendRef]);

  // "Have Composer do it", from the summoned bot: sent as if typed here, so Composer
  // plans or edits as it would, checks the change, and nothing lands before Apply.
  const handoff = useIdeUi((s) => s.composerHandoff);
  const draftRef = useLatest(draft);
  useEffect(() => {
    if (!handoff) return;
    if (mode !== "composer") {
      setMode("composer");
      return;
    }
    useIdeUi.getState().handToComposer(null);
    if (!canSend || blocked || acpBlocked) {
      // It cannot run yet (signed out, or the plan says no): it waits in the box, where the reason shows,
      // and the bot says why in its own panel.
      setDraft(handoff);
      useIdeUi.setState({
        handoffBlocked: !canSend
          ? "Sign in to run Composer. The change waits in its box."
          : `${quote.blockReason ?? "Composer cannot run on this plan right now."} The change waits in its box.`,
      });
      return;
    }
    // What the person had typed stays in the box. The bot already worked out what to do,
    // so Composer edits straight away instead of planning again; Apply is still the person's.
    const typed = draftRef.current;
    void sendRef.current(handoff, false, "skip").then(() => {
      if (typed.trim()) setDraft((now) => now || typed);
    });
  }, [handoff, mode, canSend, blocked, acpBlocked, quote.blockReason, sendRef, draftRef]);

  return (
    // Four rows: tabs, plan chrome, the thread (the only part that scrolls), composer.
    <div className="ide-stack bg-surface [grid-template-rows:auto_auto_minmax(0,1fr)_auto]">
      <div className="flex h-8 items-center gap-1.5 border-b border-border px-2">
        {/* Ask, Plan or Edit is chosen in the box, as Grok's (`composer-menu.tsx`). */}
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-muted">
          <Sparkles className="size-3" aria-hidden />
          Composer
        </p>
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            title={rulesPath ? `Open ${rulesPath}` : "Create project rules"}
            aria-label={rulesPath ? `Open ${rulesPath}` : "Create project rules"}
            onClick={openRules}
          >
            <ScrollText className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            title="Agent board"
            aria-label="Agent board"
            onClick={() => useIdeUi.getState().setBoardOpen(true)}
          >
            <LayoutGrid className="size-3.5" />
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
            disabled={chatEmpty}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <PlanChrome
        actDisabled={agentRunning || !canSend}
        account={account}
        source={source}
        crewIds={crewIds}
        fileList={fileList}
        canRun={canSend && !agentRunning}
        onBuild={buildPlan}
        onSendNotes={sendNotes}
        onFocus={() => composerRef.current?.focus()}
      />
      <MessageList
        planFirst={planFirst}
        running={agentRunning}
        quoteLabel={quote.label}
        account={account}
        source={source}
        fileList={fileList}
        suggestions={suggestions}
        onPick={(text) => {
          setDraft(text);
          if (canSend && !blocked && !acpBlocked) void send(text);
        }}
        onBuild={buildPlan}
        onSendNotes={sendNotes}
        onAnswer={(text) => {
          if (canSend && !blocked && !acpBlocked) void send(text);
        }}
      />

      <div>
      {replay && name === DEMO_WORKSPACE_NAME && checkpoints.length > 0 && <DemoNext />}
      {checkpoints.length > 0 && (
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

      <BackgroundTray />

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
          <SlashPopover items={slashHits} active={mentionHi} onPick={insertSlash} />
          <MentionPopover items={mentionHits} active={mentionHi} onPick={insertMention} />
          {steerQueue.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {steerQueue.map((item, i) => (
                <li key={`${i}-${item.slice(0, 24)}`}>
                  <button
                    type="button"
                    className="flex max-w-full items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-fg"
                    onClick={() => useIdeUi.getState().dropSteer(i)}
                    title="Remove queued steer"
                  >
                    <span className="max-w-48 truncate">{item}</span>
                    <X className="size-3 text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                    <span className="max-w-28 truncate font-mono">{cap.note || cap.selector}</span>
                    <X className="size-3 text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {bestOf && (
            <div
              role="group"
              aria-label="Start Best of 3"
              className="mb-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-xs"
              data-best-of-confirm
            >
              <p className="text-fg">
                Best of {BEST_OF}: {BEST_OF} attempts at this in the background, each checked. The board ranks
                them by what the checks found.
              </p>
              <p className="mt-0.5 text-muted">{bestOf.price}</p>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" className="h-7 px-2.5 text-xs" onClick={startBest}>
                  Start
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setBestOf(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div
            data-drop="composer"
            className={cn("composer-rim relative rounded-2xl p-px", agentRunning && "is-live", dropOn && "is-live")}
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
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[15px] bg-list-drop/80">
                <p className="text-sm font-medium text-fg">Drop files or screenshots for Composer</p>
              </div>
            )}
            <div className="rounded-[15px] bg-bg">
            <ImageTray images={shots.images} busy={shots.busy} onRemove={shots.remove} />
            <textarea
              ref={composerRef}
              value={draft}
              suppressHydrationWarning
              onPaste={(e) => {
                // A pasted screenshot goes with the message; pasted text is left to the box.
                const pictures = Array.from(e.clipboardData.files).filter((file) => file.type.startsWith("image/"));
                if (pictures.length === 0) return;
                e.preventDefault();
                void shots.add(pictures);
              }}
              onChange={(e) => {
                setDraft(e.target.value);
                setDismissMention(false);
                syncCaret(e.target);
              }}
              onKeyUp={(e) => syncCaret(e.currentTarget)}
              onClick={(e) => syncCaret(e.currentTarget)}
              onKeyDown={onKeyDown}
              placeholder={
                agentRunning
                  ? "Steer this run — Enter queues, sends when it finishes"
                  : mode === "chat"
                    ? "Ask about the repo. Use @ for context."
                    : sendPhase === "skip"
                      ? "Describe the change. Use @ for context — Composer edits straight away."
                      : sendPhase === "build"
                        ? "Describe the change. Use @ for context — Build edits straight away."
                        : "Describe the change. Use @ for context — Composer plans first."
              }
              rows={2}
              className="min-h-12 w-full resize-none rounded-[15px] border-0 bg-bg px-3 pt-2.5 pb-1 text-sm leading-snug text-fg placeholder:text-subtle focus-visible:outline-none"
            />
            <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
              <PlusMenu
                onContext={openContextPicker}
                onAttach={() => attachRef.current?.click()}
                onBackground={
                  !signedOut && account && (target.kind === "model" || account.backgroundJobs > 0) && !sendBlocked
                    ? () => void send(draft, true)
                    : undefined
                }
                backgroundTitle={`${modSymbol()}+Shift+Enter: it works on its own copy while you keep going`}
                onBestOf={
                  !signedOut && account && target.kind === "model" && !sendBlocked ? askBestOf : undefined
                }
              >
                <CrewBar account={account} />
                <AssistChips />
              </PlusMenu>
              <ModeMenu
                mode={mode === "chat" ? "ask" : planFirst ? "plan" : "edit"}
                disabled={agentRunning}
                onPick={(next) => {
                  setMode(next === "ask" ? "chat" : "composer");
                  if (next !== "ask" && planFirst !== (next === "plan")) togglePlanFirst();
                }}
              />
              {!signedOut && account && (
                <ModelPicker
                  account={account}
                  target={target}
                  onTarget={setTarget}
                  onAccount={setAccount}
                  agents={agents}
                />
              )}
              <div className="ml-auto flex items-center gap-1">
                {signedOut && !replay ? (
                  <Link
                    to="/login"
                    search={{ next: "/app" }}
                    className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-full")}
                  >
                    Sign in to send
                  </Link>
                ) : agentRunning ? (
                  <Button type="button" size="sm" className="h-8 rounded-full" aria-label="Stop" onClick={() => abortAgent()}>
                    <Square className="size-3.5 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button type="submit" size="sm" className="h-8 rounded-full" disabled={sendBlocked} aria-label={sendLabel}>
                    {sendPhase === "build" ? <Play className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                    {sendLabel}
                  </Button>
                )}
              </div>
            </div>
            </div>
          </div>
          {/* One quiet line under the box: what goes along, and what a send costs; why it cannot, only when it cannot. */}
          <div className="mt-1.5 flex min-w-0 items-center gap-3 px-1 text-[11px] text-subtle">
            {autoPaths.length > 0 && (
              <p className="max-w-[45%] min-w-0 shrink-0 truncate" title={autoPaths.join(" · ")}>
                With {autoPaths.map((p) => basename(p)).join(" · ")}
              </p>
            )}
            {/* What it costs, and how: "Replay model · recorded runs · no API call · no cost". */}
            <p className="ml-auto min-w-0 truncate text-right" title={`${quote.label} · ${quote.sub}`}>
              {target.kind === "acp" && target.remote
                ? `ACP session on ${target.name}`
                : `${quote.label}${target.kind === "acp" ? ` · ACP ${target.name}` : ""} · ${quote.sub}`}
            </p>
          </div>
          {quote.blocked && quote.blockReason && !(target.kind === "acp" && target.remote) && (
            <p className="mt-1 px-1 text-[11px] leading-snug text-warn">
              {quote.blockReason}{" "}
              {/* A cap is raised in Limits; a missing key or endpoint is added in Models. */}
              <Link to="/settings" search={{ tab: quote.capped ? "limits" : "models" }} className="text-accent hover:underline">
                {quote.capped ? "Limits" : "Models"}
              </Link>
            </p>
          )}
        </form>
        <input
          ref={attachRef}
          type="file"
          aria-label="Files or screenshots to attach"
          multiple
          className="hidden"
          suppressHydrationWarning
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            void attachFiles(list);
          }}
        />
      </div>
      </div>
    </div>
  );
}

function EmptyComposer({
  suggestions,
  onPick,
  planFirst,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
  planFirst: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-end gap-3 py-2">
      <div>
        {/* The promise first: what Aperture does with an agent's change. How Composer works comes second. */}
        <p className="text-sm font-medium text-fg">Every change the agent makes is checked before it touches your files.</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {planFirst ? "Composer plans first and waits for Build it." : "Composer edits straight away; you Apply."} Type @
          to add a file, or click part of the Preview.
        </p>
      </div>
      <ul className="space-y-1">
        {suggestions.slice(0, 3).map((s) => (
          <li key={s}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-left text-[13px] text-fg hover:bg-elevated"
              onClick={() => onPick(s)}
            >
              <span className="min-w-0 flex-1">{s}</span>
              {s === HELD_DEMO && (
                <span className="shrink-0 rounded-full border border-danger/40 px-1.5 py-px text-[11px] text-danger">
                  a check holds this
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PLAN_FIRST_KEY = "aperture-plan-first";
// The request being typed, for this tab only: it survives a reload and the trip to sign in and back.
const DRAFT_KEY = "aperture-composer-draft";
const DEMO_NEXT_KEY = "aperture-demo-next-dismissed";

/**
 * After a change is applied on the replay demo: what ran here was recorded,
 * on a sample project, and Composer on this host replays for everyone, signed
 * in or not. What runs on the visitor's own code is the GitHub side, in their
 * own Actions (Aperture Bot on their own key, Agent Check on none), so that is
 * where this points. Dismissed once, it stays dismissed in this browser.
 */
function DemoNext() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DEMO_NEXT_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed) return null;
  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DEMO_NEXT_KEY, "1");
    } catch {
      // Storage blocked: it stays closed for this page.
    }
  }
  return (
    <div className="relative border-t border-border bg-accent/5 px-3 py-2.5" role="note" aria-label="Try it on your own code">
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={dismiss}
        className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded text-subtle hover:bg-elevated hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
      <p className="pr-6 text-xs font-medium text-fg">That ran on harbor-api, a sample project, with recorded answers.</p>
      <p className="mt-0.5 text-xs text-muted">On your own repo, Aperture Bot turns an issue into a pull request.</p>
      <LearnMore>
        <p>
          It runs in your repo&apos;s GitHub Actions, on your own model key. Agent Check runs these same checks on every pull
          request, with no key at all.
        </p>
      </LearnMore>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Link to="/bot" hash="by-hand" className={cn(buttonVariants({ size: "sm" }))}>
          Set up Aperture Bot
        </Link>
        <Link to="/bot" search={{ tab: "check" }} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
          Agent Check
        </Link>
      </div>
    </div>
  );
}

function PlanChrome({
  actDisabled,
  account,
  source,
  crewIds,
  fileList,
  canRun,
  onBuild,
  onSendNotes,
  onFocus,
}: {
  actDisabled?: boolean;
  account: AccountSnapshot | null | undefined;
  source: Parameters<typeof quoteRuns>[1];
  crewIds: string[];
  fileList: string[];
  canRun: boolean;
  onBuild: (message: ChatMessage, workers?: WorkerSpec[]) => void;
  onSendNotes: (edits: ChatMessage["edits"]) => void;
  onFocus: () => void;
}) {
  const messages = useWorkspace((s) => s.messages);
  const activeCopyId = useWorkspace((s) => s.activeCopyId);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const awaitingMsg = [...messages].reverse().find((m) => m.awaitingBuild && (m.plan?.length ?? 0) > 0);
  const pendingEdits = pendingForRun(
    messages.flatMap((m) => m.edits ?? []),
    undefined,
    activeCopyId,
  );
  const pendingCount = pendingEdits.length;
  const copyCount = openCopyIds(messages.flatMap((m) => m.edits ?? [])).length;
  const seats = availableSeats(account);
  const crew = selectedSeats(seats, crewIds);
  const proposed = awaitingMsg?.plan ? proposeWorkers(awaitingMsg.plan, fileList, crew) : [];
  const checkHint = useIdeUi((s) => s.checkHint);
  const hint = nextAction({
    running: agentRunning,
    awaiting: Boolean(awaitingMsg),
    pending: pendingCount,
    workerCount: proposed.length,
    crewModels: modelSeats(crew).length,
    keyReady: seats.filter((s) => s.kind === "model" && s.ready).length,
    messages: messages.length,
    noteCount: notesOn(pendingEdits),
    reviewerLabel: modelSeats(crew).find((s) => s.source && s.source !== source)?.label,
    checks: pendingCount > 0 ? (checkHint?.state ?? "running") : undefined,
    copies: copyCount,
    reviewed: pendingCount > 0 && pendingEdits.every((edit) => edit.reviewed),
    // The strip's own sentence, once every check is in.
    verdict: pendingCount > 0 && checkHint && checkHint.state !== "running" ? checkHint.headline : undefined,
  });

  function actOnHint() {
    if (hint.kind === "workers" && awaitingMsg) {
      void onBuild(awaitingMsg, proposed);
      return;
    }
    if (hint.kind === "build" && awaitingMsg) {
      void onBuild(awaitingMsg);
      return;
    }
    if (hint.kind === "notes") {
      void onSendNotes(pendingEdits);
      return;
    }
    if (hint.kind === "reviewer") {
      const pending = pendingEdits;
      const workers = proposeReviewer(
        pending.map((e) => e.path),
        crew,
        source,
      );
      if (!workers.length || !canRun) return;
      void submitAgent("Review the staged diffs.", "composer", workers[0]?.source ?? source, {
        agentId: null,
        agentLabel: "Review",
        phase: "skip",
        workers,
        role: "review",
        apiInstruction: reviewInstruction(pending.map((edit) => edit.path)),
        pendingEdits: pending,
        copyId: useWorkspace.getState().activeCopyId ?? undefined,
      });
      return;
    }
    if (hint.kind === "apply") {
      useWorkspace.getState().applyAllPending();
      return;
    }
    if (hint.kind === "fix") {
      sendBack(source, pendingEdits);
      return;
    }
    if (hint.kind === "review") {
      const first = pendingEdits[0];
      if (first) useWorkspace.getState().openFile(first.path);
      useIdeUi.getState().setMobilePane("editor");
      if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
      return;
    }
    if (hint.kind === "crew") {
      useIdeUi.getState().setChatOpen(true);
      return;
    }
    onFocus();
  }

  // One grid row for the strip and the worker card, however many of them show.
  return (
    <div className="min-w-0">
      <TaskStrip
        hint={hint}
        onAct={actOnHint}
        onAlt={() => useWorkspace.getState().applyAllPending({ anyway: hint.kind === "fix" })}
        actDisabled={actDisabled}
      />
      {awaitingMsg && !agentRunning && proposed.length > 0 && (
        <WorkerConfirm
          plan={awaitingMsg.plan ?? []}
          account={account}
          quoteSource={source}
          disabled={!canRun}
          onConfirm={(workers) => void onBuild(awaitingMsg, workers)}
          onSingle={() => void onBuild(awaitingMsg)}
        />
      )}
    </div>
  );
}

function MessageList({
  running,
  quoteLabel,
  account,
  source,
  fileList,
  suggestions,
  onPick,
  planFirst,
  onBuild,
  onSendNotes,
  onAnswer,
}: {
  running: boolean;
  quoteLabel: string;
  account: AccountSnapshot | null | undefined;
  source: Parameters<typeof quoteRuns>[1];
  fileList: string[];
  suggestions: string[];
  onPick: (text: string) => void;
  planFirst: boolean;
  onBuild: (message: ChatMessage) => void;
  onSendNotes: (edits: ChatMessage["edits"]) => void;
  /** Sends an answer to the agent's question as the next message. */
  onAnswer: (text: string) => void;
}) {
  const messages = useWorkspace((s) => s.messages);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const messageCount = useRef(0);
  const buildRef = useRef(onBuild);
  const notesRef = useRef(onSendNotes);
  const answerRef = useRef(onAnswer);
  buildRef.current = onBuild;
  notesRef.current = onSendNotes;
  answerRef.current = onAnswer;
  const answer = useCallback((text: string) => answerRef.current(text), []);
  const last = messages[messages.length - 1];
  const streamKey = `${messages.length}:${last?.id ?? ""}:${last?.content.length ?? 0}:${last?.edits?.length ?? 0}:${last?.traces?.length ?? 0}:${running ? "1" : "0"}`;

  useEffect(() => {
    const grew = messages.length > messageCount.current;
    messageCount.current = messages.length;
    if (grew) stickToBottom.current = true;
    if (!stickToBottom.current) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [streamKey, messages.length]);

  const buildById = useCallback((id: string) => {
    const msg = useWorkspace.getState().messages.find((m) => m.id === id);
    if (msg) buildRef.current(msg);
  }, []);
  const notesById = useCallback((id: string) => {
    const msg = useWorkspace.getState().messages.find((m) => m.id === id);
    if (msg) notesRef.current(msg.edits);
  }, []);

  const replay = useIdeUi((s) => s.aiReplay);
  return (
    <div
      ref={listRef}
      className="aperture-scroll min-h-0 overflow-y-auto px-2.5 py-2"
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
      }}
    >
      {messages.length === 0 ? (
        <EmptyComposer suggestions={suggestions} onPick={onPick} planFirst={planFirst} />
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} data-message-id={message.id}>
              <MessageBlock
                message={message}
                running={running}
                quoteLabel={
                  message.awaitingBuild && !replay
                    ? quoteRuns(
                        account ?? null,
                        source,
                        billedWorkers(message.plan, fileList, (n) => !quoteRuns(account ?? null, source, n).blocked),
                      ).label
                    : quoteLabel
                }
                onBuild={buildById}
                onSendNotes={notesById}
                answerable={!running && message.id === last?.id}
                onAnswer={answer}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Save as skill": the run this reply ends, as a draft in .aperture/skills/ (`skill-draft.ts`). Once per run. */
function SaveSkillButton({ messageId }: { messageId: string }) {
  const last = useWorkspace((s) => isLastReplyOfRun(s.messages, messageId));
  const [saved, setSaved] = useState<{ path: string; name: string } | null>(null);
  const exists = useWorkspace((s) => (saved ? s.files[saved.path] !== undefined : false));
  // The same kind of task asked for before in this thread: offered as a skill, made from both runs.
  const repeat = useWorkspace((s) => (last ? repeatOf(s.messages, messageId, s.files) : null));
  const earlier = useWorkspace((s) => (repeat ? requestOf(s.messages, repeat) : null));
  const dismissed = useWorkspace(
    (s) => s.messages.find((m) => m.id === messageId)?.skillHint === "dismissed",
  );
  const save = (alsoFrom?: string) => {
    const ws = useWorkspace.getState();
    const draft = skillFromRun(ws.messages, messageId, ws.files, new Date(), alsoFrom);
    if (!draft) {
      toast.error("This run has no plan or change to make a skill from.");
      return;
    }
    ws.createFile(draft.path, draft.text);
    useIdeUi.getState().setMobilePane("editor");
    setSaved({ path: draft.path, name: draft.name });
    toast.success(`Saved as skill ${draft.name}. Edit its steps, and the agent loads it for tasks like this.`);
  };
  if (!last) return null;
  if (saved && exists) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-subtle">
        <span>Saved as skill</span>
        <button
          type="button"
          title={`Open ${saved.path}`}
          className="rounded border border-border px-1.5 py-px font-mono text-[11px] text-muted hover:text-fg"
          onClick={() => {
            useWorkspace.getState().openFile(saved.path);
            useIdeUi.getState().setMobilePane("editor");
          }}
        >
          {saved.name}
        </button>
      </p>
    );
  }
  if (repeat && earlier && !dismissed) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-bg px-3 py-2" role="note" aria-label="Save this as a skill">
        <p className="text-xs text-pretty text-muted">
          You asked for this before: “{earlier.split("\n")[0]!.slice(0, 80)}”. Save it as a skill, and the agent does it
          the same way every time.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={() => save(repeat)}>
            Save as skill
          </Button>
          <button
            type="button"
            className="min-h-6 px-1 text-[11px] text-subtle hover:text-fg"
            onClick={() => useWorkspace.getState().patchMessage(messageId, { skillHint: "dismissed" })}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        title="Turn this run into a skill in .aperture/skills/: the agent, and Aperture Bot, load it for tasks like this one"
        className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:text-fg"
        onClick={() => save(repeat ?? undefined)}
      >
        Save as skill
      </button>
    </div>
  );
}

function LessonBar({
  messageId,
  saved,
  disabled,
}: {
  messageId: string;
  saved?: "up" | "down";
  disabled: boolean;
}) {
  const [missed, setMissed] = useState(false);
  const [note, setNote] = useState("");
  const standing = useSyncExternalStore(
    subscribeStanding,
    () => readStanding().find((rule) => rule.id === messageId)?.line ?? null,
    () => null,
  );
  if (standing && !missed) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-subtle">
        <span>Saved for every project</span>
        <button type="button" className="underline disabled:opacity-40" disabled={disabled} onClick={() => clearStanding(messageId)}>
          Undo
        </button>
      </div>
    );
  }
  if (saved && !missed) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-subtle">
        <span>{saved === "up" ? "Saved as a lesson" : "Saved what it missed"}</span>
        <button
          type="button"
          className="underline disabled:opacity-40"
          disabled={disabled}
          onClick={() => useWorkspace.getState().clearLesson(messageId)}
        >
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:text-fg disabled:opacity-40"
          onClick={() => useWorkspace.getState().recordLesson(messageId, "up", "")}
        >
          Worked
        </button>
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:text-fg disabled:opacity-40"
          onClick={() => setMissed(true)}
        >
          Missed
        </button>
      </div>
      {missed && (
        <form
          className="mt-1.5 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) return;
            useWorkspace.getState().recordLesson(messageId, "down", note);
            setNote("");
            setMissed(false);
          }}
        >
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should it do next time?"
            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg outline-none"
          />
          <button type="submit" disabled={disabled || !note.trim()} className="rounded-md border border-border px-2 text-[11px] text-fg disabled:opacity-40">
            This project
          </button>
          <button
            type="button"
            disabled={disabled || !note.trim()}
            className="rounded-md border border-border px-2 text-[11px] text-fg disabled:opacity-40"
            onClick={() => {
              saveStanding(messageId, note);
              setNote("");
              setMissed(false);
            }}
          >
            Every project
          </button>
        </form>
      )}
    </div>
  );
}

function TaskStrip({
  hint,
  onAct,
  onAlt,
  actDisabled,
}: {
  hint: { title: string; cta: string; kind: string; altKind?: string; altCta?: string; tone?: "ok" | "danger" };
  onAct: () => void;
  onAlt?: () => void;
  actDisabled?: boolean;
}) {
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const indexing = useWorkspace((s) => s.indexing);
  const messages = useWorkspace((s) => s.messages);
  const designOpen = useIdeUi((s) => s.designOpen);
  const task = resolveAgentTask({ running: agentRunning, indexing, preview: designOpen, messages });
  const pct = task.total > 0 ? Math.round((task.done / task.total) * 100) : task.kind === "running" ? 40 : 0;
  // Nothing asked yet: the empty Composer says what to do, so a second "Describe the change" above it is noise.
  if (hint.kind === "compose" && messages.length === 0 && !agentRunning) return null;
  const VerdictIcon = hint.tone === "ok" ? Check : hint.tone === "danger" ? X : null;

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2.5">
      {/* Progress only while there is some: a finished plan's full bar would just squeeze the title. */}
      {task.total > 0 && task.done < task.total && (
        <span className="relative h-1 w-12 shrink-0 overflow-hidden rounded-full bg-elevated">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
      )}
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1",
          hint.tone ? "text-[12px] font-medium" : "text-[11px] text-muted",
          hint.tone === "ok" && "text-ok",
          hint.tone === "danger" && "text-danger",
        )}
        title={hint.title}
        data-verdict={hint.tone}
      >
        {VerdictIcon && <VerdictIcon className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{hint.title}</span>
      </span>
      {hint.kind !== "wait" && hint.altCta && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          // Beside the editor, the one Apply, and on a red check Send back and Apply anyway, are in the verdict
          // above the diff. This copy stays for the phone, where Composer is its own screen.
          className={cn("h-6 shrink-0 px-2", hint.altKind === "apply" && "md:hidden")}
          disabled={actDisabled && hint.kind !== "fix"}
          onClick={onAlt}
        >
          {hint.altCta}
        </Button>
      )}
      {hint.kind !== "wait" && hint.kind !== "compose" && (
        <Button
          type="button"
          size="sm"
          className={cn("h-6 shrink-0 px-2", (hint.kind === "apply" || hint.kind === "fix") && "md:hidden")}
          disabled={actDisabled && hint.kind !== "apply" && hint.kind !== "fix" && hint.kind !== "review"}
          onClick={onAct}
        >
          {hint.cta}
        </Button>
      )}
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

function CommitLine({ messageId }: { messageId: string }) {
  const commit = useWorkspace((s) => [...s.commits].reverse().find((row) => row.messageId === messageId) ?? null);
  const latest = useWorkspace((s) => s.commits.at(-1)?.id ?? null);
  if (!commit) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
      <p className="min-w-0 truncate font-mono text-[11px] text-muted" title={commit.message}>
        {commit.message}
      </p>
      {commit.id === latest && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const reverted = useWorkspace.getState().revertCommit(commit.id);
            if (reverted.ok) toast.success(`Reverted “${reverted.commit.message}”`);
            else toast.error(reverted.error);
          }}
        >
          <Undo2 className="size-3.5" />
          Revert
        </Button>
      )}
    </div>
  );
}

/** The check strip's verdict, echoed on the Composer message that staged the change. */
function StagedVerdict({ hint }: { hint: { state: "clear" | "failed"; headline: string } }) {
  const held = hint.state === "failed";
  const Icon = held ? X : Check;
  return (
    <p
      data-staged-verdict={held ? "held" : "safe"}
      className={cn(
        "flex items-start gap-1.5 rounded-xl border px-3 py-2 text-[13px] leading-snug font-medium",
        held ? "border-danger/40 text-danger" : "border-ok/40 text-ok",
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{hint.headline}</span>
    </p>
  );
}

const MessageBlock = memo(function MessageBlock({
  message,
  running,
  quoteLabel,
  onBuild,
  onSendNotes,
  answerable = false,
  onAnswer,
}: {
  message: ChatMessage;
  running: boolean;
  quoteLabel: string;
  onBuild: (id: string) => void;
  onSendNotes: (id: string) => void;
  /** The latest reply, and nothing running: its question's answers can be clicked. */
  answerable?: boolean;
  onAnswer?: (text: string) => void;
}) {
  const runningMode = useWorkspace((s) => s.runningMode);
  // The staged change's verdict, said here too, so the answer is where you are reading.
  const verdictState = useIdeUi((s) => s.checkHint?.state);
  const verdictHeadline = useIdeUi((s) => s.checkHint?.headline);
  const content = typeof message.content === "string" ? message.content : "";
  if (message.role === "user") {
    if (message.automatic) {
      return (
        <div
          className="rounded-xl border border-dashed border-border px-3 py-2"
          title="Sent by the editor after running the tests, not typed by you"
        >
          <p className="flex items-center gap-1 text-xs font-medium text-subtle">
            <FlaskConical className="size-3" aria-hidden />
            Automatic
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{content}</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-border bg-bg px-3 py-2">
        <p className="text-xs font-medium text-subtle">You</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">{content}</p>
        <MessageImages images={message.images} />
      </div>
    );
  }

  const traces = Array.isArray(message.traces) ? message.traces : [];
  const edits = Array.isArray(message.edits) ? message.edits : [];
  const plan = Array.isArray(message.plan) ? message.plan : [];
  const noteCount = notesOn(edits);
  const stagedVerdict =
    edits.some((e) => e.status === "pending") && verdictHeadline && verdictState && verdictState !== "running"
      ? { state: verdictState, headline: verdictHeadline }
      : null;
  const empty = !content.trim();
  const live = running && empty && plan.length === 0;
  const waiting = Boolean(message.awaitingBuild && plan.length > 0);
  const analyzing = live && runningMode === "chat";

  return (
    <div>
      <p className="text-xs font-medium text-subtle">{message.agentLabel || "Composer"}</p>
      {plan.length > 0 && (
        <PlanCard
          entries={plan}
          awaitingBuild={waiting}
          onChange={running ? undefined : (next) => useWorkspace.getState().patchMessage(message.id, { plan: next })}
        />
      )}
      {traces.length > 0 && (
        <ul className="mt-2 space-y-1">
          {traces.map((trace) => (
            <TraceLine key={trace.id} trace={trace} />
          ))}
        </ul>
      )}
      {Array.isArray(message.mcpCalls) && message.mcpCalls.length > 0 && (
        <McpCallList messageId={message.id} calls={message.mcpCalls} />
      )}
      {Array.isArray(message.skills) && message.skills.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-subtle">
          <span>Used {message.skills.length === 1 ? "skill" : "skills"}</span>
          {message.skills.map((path) => (
            <button
              key={path}
              type="button"
              title={`Open ${path}`}
              className="rounded border border-border px-1.5 py-px font-mono text-[11px] text-muted hover:text-fg"
              onClick={() => useWorkspace.getState().openFile(path)}
            >
              {skillName(path.replace(/\/SKILL\.md$/i, "").split("/").pop() ?? path)}
            </button>
          ))}
        </p>
      )}
      {Array.isArray(message.rules) && message.rules.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-subtle">
          <span>Followed {message.rules.length === 1 ? "rule" : "rules"}</span>
          {message.rules.map((path) => (
            <button
              key={path}
              type="button"
              title={`Open ${path}`}
              className="rounded border border-border px-1.5 py-px font-mono text-[11px] text-muted hover:text-fg"
              onClick={() => useWorkspace.getState().openFile(path)}
            >
              {path.split("/").pop()}
            </button>
          ))}
        </p>
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
      {!empty && !(message.question && content.trim() === message.question.text) && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{content}</p>
      )}
      {message.question && onAnswer && (
        <QuestionCard question={message.question} answerable={answerable} onAnswer={onAnswer} />
      )}
      {content.trim() && !message.automatic && !live && !message.failed && (
        <LessonBar messageId={message.id} saved={message.lesson} disabled={running} />
      )}
      {!running && !live && !waiting && !message.failed && (plan.length > 0 || edits.length > 0) && (
        <SaveSkillButton messageId={message.id} />
      )}
      {message.failed && message.retry && !live && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={running}
          onClick={() => void retrySend(message.id)}
        >
          <RotateCcw className="size-3.5" />
          Retry
        </Button>
      )}
      {waiting && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
          <p className="min-w-0 text-xs text-muted">Nothing is written until you build. {quoteLabel}.</p>
          <Button size="sm" disabled={running} onClick={() => onBuild(message.id)}>
            <Play className="size-3.5" />
            Build it
          </Button>
        </div>
      )}
      {edits.length > 0 && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left"
            onClick={() => {
              const first = edits.find((e) => e.status === "pending") ?? edits[0];
              if (first) useWorkspace.getState().openFile(first.path);
              useIdeUi.getState().setMobilePane("editor");
              if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
            }}
          >
            <span className="min-w-0 truncate text-xs text-muted">
              {edits.filter((e) => e.status === "pending").length > 0
                ? `Staged ${edits.filter((e) => e.status === "pending").length} ${
                    edits.filter((e) => e.status === "pending").length === 1 ? "file" : "files"
                  } · review in the editor`
                : `${edits.filter((e) => e.status === "applied").length} applied`}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-subtle">
              {edits.map((e) => e.path.split("/").pop()).slice(0, 3).join(" · ")}
            </span>
          </button>
          {stagedVerdict && <StagedVerdict hint={stagedVerdict} />}
          {noteCount > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
              <p className="min-w-0 text-xs text-muted">
                {noteCount} {noteCount === 1 ? "note" : "notes"} for Composer. {quoteLabel}.
              </p>
              <Button size="sm" disabled={running} onClick={() => onSendNotes(message.id)}>
                <MessageSquare className="size-3.5" />
                Send notes
              </Button>
            </div>
          )}
          {edits.some((e) => e.status === "applied") && <CommitLine messageId={message.id} />}
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
});

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
