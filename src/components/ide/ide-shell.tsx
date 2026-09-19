import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Code2, FolderTree, Keyboard, LogOut, Search, Settings, Sparkles } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { getAiStatus } from "@/lib/agent/api";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAccount, modelCaption } from "@/lib/billing/use-account";
import { listPendingEdits } from "@/lib/workspace/edits";
import { jumpReview } from "@/lib/editor/review-jump";
import { useIdeUi, hydrateAppearance } from "@/lib/ui-store";
import { cn, isModEvent, modSymbol } from "@/lib/utils";
import { downloadCurrentWorkspace } from "@/lib/workspace/download";
import { useWorkspace } from "@/lib/workspace/store";

function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(next);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return inset;
}

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

function MobileAccount() {
  const user = useCurrentUser();
  const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/login"
        search={{ next: "/app" }}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-xs")}
      >
        Sign in
      </Link>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";

  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-label="Account" aria-expanded={open} className="rounded-full" onClick={() => setOpen((v) => !v)}>
        {user.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-elevated text-xs font-medium">{label.charAt(0)}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]">
          <p className="truncate px-3 py-2 text-sm font-medium text-fg">{label}</p>
          <Link
            to="/settings"
            search={{ tab: "models" }}
            className="flex h-11 items-center gap-2 px-3 text-sm text-fg hover:bg-bg"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4 text-subtle" />
            Settings
          </Link>
          <button
            type="button"
            className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm text-fg hover:bg-bg"
            onClick={() => {
              setOpen(false);
              setHelpOpen(true);
            }}
          >
            <Keyboard className="size-4 text-subtle" />
            How this works
          </button>
          {authEnabled && (
            <button
              type="button"
              disabled={signingOut}
              className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm text-fg hover:bg-bg disabled:opacity-50"
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
            >
              <LogOut className="size-4 text-subtle" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>
      )}
    </div>
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
    <div className="ide-title">
      <Link to="/" className="text-fg" aria-label="Aperture home">
        <ApertureMark className="size-3.5" />
      </Link>
      <div className="min-w-0">
        <span className="hidden min-w-0 truncate font-mono text-[11px] text-subtle md:block">{title}</span>
        <PreviewToggle className="md:hidden" />
      </div>
      <div className="flex items-center justify-end">
        <div className="hidden items-center gap-2 md:flex">
          <span className={cn("hidden shrink-0 font-mono text-[11px] sm:inline", staged > 0 ? "text-ok" : "text-subtle")}>
            {status}
          </span>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-subtle hover:bg-elevated hover:text-fg"
            aria-label="Go to file"
          >
            <Search className="size-3" />
            Go to file
            <kbd className="font-mono text-[10px] text-subtle">{mod === "⌘" ? "⌘P" : "Ctrl+P"}</kbd>
          </button>
          <Link
            to="/settings"
            search={{ tab: "models" }}
            aria-label="Model settings"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          >
            <Settings className="size-3.5" />
          </Link>
          <Button variant="ghost" size="icon-sm" className="size-7" aria-label="How this editor works" onClick={() => setHelpOpen(true)}>
            <Keyboard className="size-3.5" />
          </Button>
          <AuthSlot compact />
        </div>
        <div className="md:hidden">
          <MobileAccount />
        </div>
      </div>
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
  const keyboardInset = useKeyboardInset();
  const { user, account } = useAccount();
  const desktop = layoutReady && desktopMq;
  const captureCount = useIdeUi((s) => s.captures.length);
  const composerUnread = useIdeUi((s) => s.composerUnread);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const composerAlert =
    useWorkspace((s) => s.messages.some((m) => m.awaitingBuild)) || captureCount > 0 || agentRunning || composerUnread;
  const runningRef = useRef(false);

  useLayoutEffect(() => {
    setLayoutReady(true);
    hydrateAppearance();
  }, []);

  useEffect(() => {
    const was = runningRef.current;
    runningRef.current = agentRunning;
    if (was && !agentRunning) {
      const ui = useIdeUi.getState();
      if (ui.mobilePane !== "agent" || !ui.chatOpen) ui.setComposerUnread(true);
    }
  }, [agentRunning]);

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
      if (e.key === "F8") {
        const open = useIdeUi.getState();
        if (open.commandOpen || open.helpOpen || open.githubOpen || open.historyOpen) return;
        e.preventDefault();
        jumpReview(e.shiftKey ? -1 : 1, e.altKey);
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
    <div className="relative h-dvh bg-bg text-fg">
      <div className="ide-shell">
        <TitleBar />

        {desktop ? (
          <div className="ide-workspace">
            <Group orientation="horizontal" className="h-full min-h-0 min-w-0">
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
          <div className="ide-mobile" style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}>
            <div className="relative min-h-0 min-w-0 overflow-hidden">
              {mobilePane === "files" && <FileTree />}
              {mobilePane === "editor" && <EditorColumn />}
              {mobilePane === "agent" && <AgentPanel composerRef={composerRef} />}
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
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[12px]",
                    mobilePane === id ? "text-fg" : "text-subtle",
                  )}
                >
                  {mobilePane === id && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-accent" />}
                  <span className="relative">
                    <Icon className="size-5" />
                    {id === "agent" && composerAlert && mobilePane !== "agent" && (
                      <span className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-accent" />
                    )}
                  </span>
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
