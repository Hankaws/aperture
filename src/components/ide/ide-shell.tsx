import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Code2, FolderTree, Keyboard, PanelLeft, Settings, Sparkles } from "lucide-react";
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
import { AuthSlot } from "@/components/site/auth-slot";
import { Button } from "@/components/ui/button";
import { getAiStatus } from "@/lib/agent/api";
import { useAccount, modelCaption } from "@/lib/billing/use-account";
import { useIdeUi } from "@/lib/ui-store";
import { cn, isModEvent } from "@/lib/utils";
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
  const desktop = useIsDesktop();
  const { user, account } = useAccount();
  const projectName = useWorkspace((s) => s.name);

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
      <header className="flex h-11 items-center gap-2 border-b border-border px-2 sm:px-3">
        <Link to="/" className="flex items-center gap-2 text-fg">
          <ApertureMark className="size-5" />
          <span className="text-sm font-medium tracking-tight">Aperture</span>
        </Link>
        <span className="hidden max-w-40 truncate text-xs text-subtle sm:inline">{projectName}</span>
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <Button
            variant={sidebarOpen ? "subtle" : "ghost"}
            size="sm"
            className="hidden md:inline-flex"
            aria-label="Toggle file tree"
            onClick={toggleSidebar}
          >
            <PanelLeft className="size-3.5" />
            Files
          </Button>
          <Button
            variant={chatOpen ? "subtle" : "ghost"}
            size="sm"
            className="hidden md:inline-flex"
            aria-label="Toggle agent"
            onClick={() => {
              toggleChat();
              requestAnimationFrame(() => composerRef.current?.focus());
            }}
          >
            <Sparkles className="size-3.5" />
            Agent
          </Button>
          <Link
            to="/settings"
            search={{ tab: "models" }}
            aria-label="Model settings"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          >
            <Settings className="size-4" />
          </Link>
          <Button variant="ghost" size="sm" aria-label="How this editor works" onClick={() => setHelpOpen(true)}>
            <Keyboard className="size-3.5" />
            <span className="hidden sm:inline">Help</span>
          </Button>
          <AuthSlot compact />
        </div>
      </header>

      {desktop ? (
        <div className="flex min-h-0 flex-1">
          <Group orientation="horizontal" className="h-full w-full">
            {sidebarOpen && (
              <>
                <Panel id="files" defaultSize="18%" minSize="14%" maxSize="30%" className="min-h-0">
                  <FileTree />
                </Panel>
                <Separator className="w-px bg-border hover:bg-accent/40" />
              </>
            )}
            <Panel id="editor" minSize="32%" className="min-h-0">
              <EditorColumn />
            </Panel>
            {chatOpen && (
              <>
                <Separator className="w-px bg-border hover:bg-accent/40" />
                <Panel id="agent" defaultSize="30%" minSize="24%" maxSize="46%" className="min-h-0">
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
                ["agent", Sparkles, "Agent"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobilePane(id)}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                  mobilePane === id ? "text-fg" : "text-subtle",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <StatusBar aiLabel={aiLabel} />
      <OpenProjectHost />
      <CommandPalette />
      <InlineEdit />
      <NewFileDialog />
      <HelpDialog />
      <HistoryDialog />
    </div>
  );
}
