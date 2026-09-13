import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Code2, FolderTree, Keyboard, Search, Settings, Sparkles } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ApertureMark } from "./logo";
import { FileTree } from "./file-tree";
import { EditorColumn } from "./editor-column";
import { StatusBar } from "./status-bar";
import { AgentPanel } from "./agent-panel";
import { CommandPalette } from "./command-palette";
import { InlineEdit } from "./inline-edit";
import { HelpDialog, NewFileDialog } from "./overlays";
import { HistoryDialog } from "./history-dialog";
import { OpenProjectHost } from "./open-project";
import { PreviewToggle } from "./tab-bar";
import { AuthSlot } from "@/components/site/auth-slot";
import { Button } from "@/components/ui/button";
import { getAiStatus } from "@/lib/agent/api";
import { useAccount, modelCaption } from "@/lib/billing/use-account";
import { listPendingEdits } from "@/lib/workspace/edits";
import { useIdeUi } from "@/lib/ui-store";
import { cn, isModEvent, modSymbol } from "@/lib/utils";
import { downloadCurrentWorkspace } from "@/lib/workspace/download";
import { useWorkspace } from "@/lib/workspace/store";

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

function TitleBar() {
  const name = useWorkspace((s) => s.name);
  const path = useWorkspace((s) => s.activePath);
  const chunks = useWorkspace((s) => s.chunks.length);
  const indexing = useWorkspace((s) => s.indexing);
  const running = useWorkspace((s) => s.agentRunning);
  const staged = useWorkspace((s) => listPendingEdits(s.messages).length);
  const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
  const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => setMod(modSymbol()), []);
  const title = path ? `${name} / ${path}` : name;
  const status = running
    ? "Composer running"
    : staged > 0
      ? `staged · ${staged} ${staged === 1 ? "file" : "files"}`
      : indexing
        ? "Indexing…"
        : `indexed · ${chunks} chunks`;

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-surface px-2.5">
      <Link to="/" className="text-fg" aria-label="Aperture home">
        <ApertureMark className="size-3.5" />
      </Link>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-subtle">{title}</span>
      <span className={cn("hidden shrink-0 font-mono text-[11px] sm:inline", staged > 0 ? "text-ok" : "text-subtle")}>
        {status}
      </span>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="hidden h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-subtle hover:bg-elevated hover:text-fg md:inline-flex"
        aria-label="Go to file"
      >
        <Search className="size-3" />
        Go to file
        <kbd className="font-mono text-[10px] text-subtle">{mod === "⌘" ? "⌘P" : "Ctrl+P"}</kbd>
      </button>
      <PreviewToggle className="md:hidden" />
      <Link
        to="/settings"
        search={{ tab: "models" }}
        aria-label="Model settings"
        className="grid size-7 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
      >
        <Settings className="size-3.5" />
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        aria-label="How this editor works"
        onClick={() => setHelpOpen(true)}
      >
        <Keyboard className="size-3.5" />
      </Button>
      <AuthSlot compact />
    </div>
  );
}

export function IdeShell() {
  const sidebarOpen = useIdeUi((s) => s.sidebarOpen);
  const chatOpen = useIdeUi((s) => s.chatOpen);
  const mobilePane = useIdeUi((s) => s.mobilePane);
  const toggleSidebar = useIdeUi((s) => s.toggleSidebar);
  const toggleChat = useIdeUi((s) => s.toggleChat);
  const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
  const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
  const setInlineOpen = useIdeUi((s) => s.setInlineOpen);
  const setMobilePane = useIdeUi((s) => s.setMobilePane);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const desktopMq = useIsDesktop();
  const { user, account } = useAccount();
  const desktop = layoutReady && desktopMq;

  useLayoutEffect(() => {
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    void getAiStatus()
      .then((s) => setAiAvailable(s.available))
      .catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("aperture-debug") === "1") {
        useIdeUi.setState({ debug: true });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const ui = useIdeUi.getState();
        if (ui.githubOpen) {
          ui.setGithubOpen(false);
          return;
        }
        if (ui.historyOpen) {
          ui.setHistoryOpen(false);
          return;
        }
        if (ui.designOpen) {
          ui.setDesignOpen(false);
          return;
        }
        ui.setCommandOpen(false);
        ui.setInlineOpen(false);
        ui.setHelpOpen(false);
        ui.setNewFileOpen(false);
        return;
      }
      if (!isModEvent(e)) return;
      const key = e.key.toLowerCase();
      if (key === "p") {
        e.preventDefault();
        setCommandOpen(true);
      } else if (key === "k") {
        e.preventDefault();
        setInlineOpen(true);
      } else if (key === "i") {
        e.preventDefault();
        useIdeUi.setState({ chatOpen: true, mobilePane: "agent" });
        requestAnimationFrame(() => composerRef.current?.focus());
      } else if (key === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (key === "l") {
        e.preventDefault();
        toggleChat();
      } else if (key === "/") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (key === "s") {
        e.preventDefault();
        void downloadCurrentWorkspace()
          .then((r) => toast.success(`Downloaded ${r.name} · ${r.count} files`))
          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not download"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setHelpOpen, setInlineOpen, toggleChat, toggleSidebar]);

  const aiLabel = !user
    ? "Sign in"
    : account
      ? modelCaption(account)
      : aiAvailable === false
        ? "AI offline"
        : "grok-4.5";

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg text-fg">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
        <TitleBar />

        {desktop ? (
          <div className="relative min-h-0 flex-1">
            <Group orientation="horizontal" className="absolute inset-0">
              {sidebarOpen && (
                <>
                  <Panel id="files" defaultSize="16%" minSize="12%" maxSize="28%" className="min-h-0 overflow-hidden">
                    <FileTree />
                  </Panel>
                  <Separator className="w-px bg-border hover:bg-accent/40" />
                </>
              )}
              <Panel id="editor" minSize="32%" className="min-h-0 overflow-hidden">
                <EditorColumn />
              </Panel>
              {chatOpen && (
                <>
                  <Separator className="w-px bg-border hover:bg-accent/40" />
                  <Panel id="agent" defaultSize="26%" minSize="22%" maxSize="40%" className="min-h-0 overflow-hidden">
                    <AgentPanel composerRef={composerRef} />
                  </Panel>
                </>
              )}
            </Group>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 overflow-hidden">
                {mobilePane === "files" && <FileTree />}
                {mobilePane === "editor" && <EditorColumn />}
                {mobilePane === "agent" && <AgentPanel composerRef={composerRef} />}
              </div>
            </div>
            <nav className="grid grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
              {(
                [
                  ["files", FolderTree, "Files"],
                  ["editor", Code2, "Code"],
                  ["agent", Sparkles, "Composer"],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMobilePane(id)}
                  className={cn(
                    "relative flex h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                    mobilePane === id ? "text-fg" : "text-subtle",
                  )}
                >
                  {mobilePane === id && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        )}

        <StatusBar aiLabel={aiLabel} />
      </div>
      <OpenProjectHost />
      <CommandPalette />
      <InlineEdit />
      <NewFileDialog />
      <HelpDialog />
      <HistoryDialog />
    </div>
  );
}
