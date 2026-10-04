import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, Component, type ReactNode } from "react";
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
import { LayoutMenu, PanelToggles } from "./layout-controls";
import { AuthSlot } from "@/components/site/auth-slot";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAiStatus } from "@/lib/agent/api";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useAccount, modelCaption } from "@/lib/billing/use-account";
import { listPendingEdits } from "@/lib/workspace/edits";
import { pendingForRun } from "@/lib/workspace/copies";
import { jumpReview } from "@/lib/editor/review-jump";
import { useIdeUi, hydrateAppearance } from "@/lib/ui-store";
import { RESIZE_TARGET, usePanelLayout } from "@/lib/use-panel-layout";
import { cn, isModEvent, modSymbol } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset((prev) => (prev === next ? prev : next));
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

type BoundaryProps = { name: string; children: ReactNode };
type BoundaryState = { error: string | null };

/** One panel can fail without taking the files, the code, and Composer down with it. */
class PanelBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    const message = error instanceof Error && error.message ? error.message : "This panel stopped.";
    return { error: message };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-fg">{this.props.name} hit a problem</p>
        <p className="max-w-xs text-xs break-words text-muted">{this.state.error}</p>
        <button
          type="button"
          className="mt-1 rounded-md border border-border px-2.5 py-1 text-xs text-fg hover:bg-elevated"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}

function TitleBar() {
  const name = useWorkspace((s) => s.name);
  const running = useWorkspace((s) => s.agentRunning);
  const staged = useWorkspace((s) => pendingForRun(listPendingEdits(s.messages), undefined, s.activeCopyId).length);
  const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
  const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => setMod(modSymbol()), []);
  const modKey = mod === "⌘" ? "⌘" : "Ctrl+";
  const status = running ? "Composer running" : staged > 0 ? `${staged} staged` : null;

  return (
    <div className="ide-title">
      <div className="flex min-w-0 items-center gap-2">
        <Link to="/" className="grid size-6 shrink-0 place-items-center text-fg" aria-label="Aperture home">
          <ApertureMark className="size-3.5" />
        </Link>
        <span className="hidden min-w-0 truncate text-[12px] font-medium text-muted md:block">{name}</span>
        {status && (
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] md:inline-flex",
              running ? "bg-accent/10 text-accent" : "bg-ok/10 text-ok",
            )}
          >
            <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-accent" : "bg-ok")} />
            {status}
          </span>
        )}
        <div className="md:hidden">
          <PreviewToggle />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="hidden h-6 min-w-0 items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-[12px] text-subtle transition-colors hover:border-subtle/60 hover:text-muted md:flex"
        aria-label="Go to file"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Search {name}</span>
        <kbd className="shrink-0 font-mono text-[10px] text-subtle">{modKey}P</kbd>
      </button>
      <div className="flex items-center justify-end gap-1">
        <div className="hidden items-center gap-1 md:flex">
          <PanelToggles mod={modKey} />
          <LayoutMenu />
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <Link
            to="/settings"
            search={{ tab: "models" }}
            aria-label="Model settings"
            title="Settings"
            className="grid size-7 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
          >
            <Settings className="size-4" strokeWidth={1.6} />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 text-subtle"
            aria-label="How this editor works"
            title={`Shortcuts (${modKey}/)`}
            onClick={() => setHelpOpen(true)}
          >
            <Keyboard className="size-4" strokeWidth={1.6} />
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

const WORKSPACE_SIZES = { files: 18, editor: 54, agent: 28 } as const;
const WORKSPACE_ORDER = ["files", "editor", "agent"] as const;

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
  const swap = useIdeUi((s) => s.swapSides);
  const workspace = usePanelLayout("workspace", WORKSPACE_SIZES);
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
    hydrateAppearance();
    setLayoutReady(true);
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
      .then((s) => {
        setAiAvailable(s.available);
        useIdeUi.setState({ aiReplay: s.replay });
      })
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
        if (document.querySelector(".cm-panel.cm-search")) return;
        const ui = useIdeUi.getState();
        if (ui.commandOpen) {
          ui.setCommandOpen(false);
          return;
        }
        if (ui.inlineOpen) {
          ui.setInlineOpen(false);
          return;
        }
        if (ui.helpOpen) {
          ui.setHelpOpen(false);
          return;
        }
        if (ui.newFileOpen) {
          ui.setNewFileOpen(false);
          return;
        }
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
        }
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
        toast.success("Saved", { id: "workspace-saved" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setHelpOpen, setInlineOpen, toggleChat, toggleSidebar]);

  const aiReplay = useIdeUi((s) => s.aiReplay);
  const aiLabel = !user
    ? "Sign in"
    : aiReplay
      ? "Replay model"
      : account
        ? modelCaption(account)
        : aiAvailable === false
          ? "AI offline"
          : "grok-4.5";

  return (
    <div className="relative h-dvh bg-bg text-fg">
      <div className="ide-shell">
        <TitleBar />

        <div
          className="ide-workspace"
          data-pane={mobilePane}
          data-files={sidebarOpen ? "on" : "off"}
          data-agent={chatOpen ? "on" : "off"}
          style={!desktop && keyboardInset ? { paddingBottom: keyboardInset } : undefined}
        >
          {/* Mounted in the browser only, once the saved layout is known: the
              panel library can't reorder panels as they first mount, so they
              start in the saved order at the saved sizes. Nothing in them works
              before hydration anyway. Swaps from the Layout menu reorder in
              place, which keeps every panel's state (Composer's draft too). */}
          {!layoutReady ? (
            <div className="h-full min-h-0 bg-bg" />
          ) : (
          <Group
            orientation="horizontal"
            className="h-full min-h-0 min-w-0"
            groupRef={workspace.groupRef}
            defaultLayout={workspace.defaultLayout}
            onLayoutChanged={workspace.onLayoutChanged}
            resizeTargetMinimumSize={RESIZE_TARGET}
          >
            {(swap ? [...WORKSPACE_ORDER].reverse() : WORKSPACE_ORDER).flatMap((id, i, order) => {
              const panel =
                id === "files" ? (
                  <Panel key="files" id="files" defaultSize={workspace.size("files")} minSize="12%" maxSize="35%" className="min-h-0 overflow-hidden">
                    <PanelBoundary name="Files">
                      <FileTree />
                    </PanelBoundary>
                  </Panel>
                ) : id === "agent" ? (
                  <Panel key="agent" id="agent" defaultSize={workspace.size("agent")} minSize="20%" maxSize="45%" className="min-h-0 overflow-hidden">
                    <PanelBoundary name="Composer">
                      <AgentPanel composerRef={composerRef} />
                    </PanelBoundary>
                  </Panel>
                ) : (
                  <Panel key="editor" id="editor" defaultSize={workspace.size("editor")} minSize="30%" className="min-h-0 overflow-hidden">
                    <PanelBoundary name="Code">
                      <EditorColumn desktop={desktop} />
                    </PanelBoundary>
                  </Panel>
                );
              if (i === order.length - 1) return [panel];
              // Each sidebar's separator is named after it, so hiding the
              // sidebar hides its line too, whichever side it is on.
              const side = id === "editor" ? order[i + 1] : id;
              return [panel, <Separator key={`sep-${side}`} id={`sep-${side}`} className="ide-sep-x" />];
            })}
          </Group>
          )}
          <nav className="ide-dock grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
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
