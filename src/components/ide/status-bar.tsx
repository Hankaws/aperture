import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useWorkspace } from "@/lib/workspace/store";
import { listPendingEdits } from "@/lib/workspace/edits";
import { languageLabel } from "@/lib/parser/language";
import { useIdeUi } from "@/lib/ui-store";
import { resolveAgentTask } from "@/lib/workspace/agent-task";
import { cn } from "@/lib/utils";

export function StatusBar({ aiLabel }: { aiLabel: string }) {
  const activePath = useWorkspace((s) => s.activePath);
  const indexing = useWorkspace((s) => s.indexing);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const files = useWorkspace((s) => s.fileList);
  const selection = useWorkspace((s) => s.selection);
  const messages = useWorkspace((s) => s.messages);
  const staged = useWorkspace((s) => listPendingEdits(s.messages).length);
  const snapshots = useWorkspace((s) => s.checkpoints.length);
  const dirty = useWorkspace((s) => s.dirtyPaths.length);
  const debug = useIdeUi((s) => s.debug);
  const designOpen = useIdeUi((s) => s.designOpen);
  const captures = useIdeUi((s) => s.captures.length);
  const setHistoryOpen = useIdeUi((s) => s.setHistoryOpen);
  const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
  const lang = activePath ? languageLabel(activePath) : "";
  const line = selection && selection.path === activePath ? selection.fromLine : null;
  const fileCount = files.length;
  const task = resolveAgentTask({
    running: agentRunning,
    indexing,
    preview: designOpen,
    messages,
  });

  function openComposer() {
    useIdeUi.setState({ chatOpen: true, mobilePane: "agent" });
  }

  return (
    <div className="ide-status">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={openComposer}
          className={cn(
            "inline-flex min-w-0 max-w-full items-center gap-1.5 hover:text-fg",
            task.kind === "running" && "shimmer-text",
            task.kind === "awaiting" && "text-ok",
            task.kind === "ready" && "text-fg",
          )}
          aria-label={`${task.label}${task.detail ? ` · ${task.detail}` : ""}`}
        >
          <Sparkles className="size-3 shrink-0" />
          <span className="shrink-0">{task.label}</span>
          {task.total > 0 && (
            <span className="shrink-0 tabular-nums text-subtle">
              {task.done}/{task.total}
            </span>
          )}
          {task.detail && <span className="min-w-0 truncate text-subtle">{task.detail}</span>}
        </button>
        <span className="hidden shrink-0 tabular-nums sm:inline">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
        {dirty > 0 && <span className="hidden shrink-0 text-fg sm:inline">{dirty} unsaved</span>}
        {staged > 0 && (
          <button
            type="button"
            className="shrink-0 text-ok hover:text-fg"
            onClick={() => useIdeUi.setState({ chatOpen: true, mobilePane: "editor" })}
          >
            {staged} {staged === 1 ? "diff" : "diffs"}
          </button>
        )}
        {captures > 0 && (
          <button
            type="button"
            className="hidden shrink-0 hover:text-fg sm:inline"
            onClick={() => useIdeUi.setState({ designOpen: true, mobilePane: "editor" })}
          >
            {captures} {captures === 1 ? "note" : "notes"}
          </button>
        )}
        {snapshots > 0 && (
          <button type="button" className="hidden hover:text-fg sm:inline" onClick={() => setHistoryOpen(true)}>
            History
          </button>
        )}
        {debug && <span className="text-warn">Debug</span>}
      </div>
      <div className="flex items-center gap-3">
        <SyncBadge />
        {line != null && <span className="hidden tabular-nums md:inline">Line {line}</span>}
        {lang && <span className="hidden md:inline">{lang}</span>}
        <span className="hidden shrink-0 text-subtle md:inline" title="Agents wait for Build it and Apply. Nothing runs unattended.">
          Manual
        </span>
        <Link
          to={aiLabel === "Sign in" ? "/login" : "/settings"}
          search={aiLabel === "Sign in" ? { next: "/app" } : { tab: "models" }}
          className="max-w-36 truncate hover:text-fg"
        >
          {aiLabel}
        </Link>
        <button type="button" className="hidden hover:text-fg sm:inline" onClick={() => setHelpOpen(true)}>
          How this works
        </button>
      </div>
    </div>
  );
}

/**
 * What happened to the saved copy.
 *
 * Silent syncing is how a save failure goes unnoticed until the work is gone,
 * so every state says something — including "local", which is the honest label
 * for a signed-out session rather than a reassuring tick.
 */
function SyncBadge() {
  const state = useWorkspace((s) => s.syncState);
  const [resolving, setResolving] = useState(false);

  if (state === "conflict") {
    return (
      <span className="flex items-center gap-1.5 text-warn">
        <span className="hidden sm:inline">Saved elsewhere</span>
        <button
          type="button"
          disabled={resolving}
          className="underline underline-offset-2 hover:text-fg disabled:opacity-60"
          onClick={async () => {
            setResolving(true);
            const { adoptSavedCopy } = await import("@/lib/workspace/sync-controller");
            await adoptSavedCopy();
            setResolving(false);
          }}
        >
          Take saved
        </button>
        <button
          type="button"
          disabled={resolving}
          className="underline underline-offset-2 hover:text-fg disabled:opacity-60"
          onClick={async () => {
            setResolving(true);
            const { overwriteSavedCopy } = await import("@/lib/workspace/sync-controller");
            await overwriteSavedCopy();
            setResolving(false);
          }}
        >
          Keep mine
        </button>
      </span>
    );
  }

  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Not saved"
          : state === "local"
            ? "This browser only"
            : null;
  if (!label) return null;
  return (
    <span
      className={cn("hidden md:inline", state === "error" ? "text-warn" : "text-subtle")}
      title={
        state === "local"
          ? "Sign in to keep this project on your account."
          : state === "error"
            ? "The last save did not go through. Your work is still in this browser."
            : "This project is saved to your account."
      }
    >
      {label}
    </span>
  );
}
