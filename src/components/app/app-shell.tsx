import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Code2,
  Info,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Settings,
  SquarePen,
  type LucideIcon,
} from "lucide-react";
import { ApertureMark } from "@/components/ide/logo";
import { MascotAvatar } from "@/components/bot/mascot";
import { useMyBot } from "@/components/bot/use-my-bot";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav, ThemeToggle } from "@/components/site/site-nav";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { ChatMeta } from "@/lib/bot/my-bot";
import { cn } from "@/lib/utils";
import { pulseLine } from "@/lib/bot/board";
import { usePulse } from "@/lib/bot/pulse-store";
import { useBotsPulse } from "@/components/bot/use-bots-pulse";
import { DrawerContext } from "./sidebar-context";

/** Whether the sidebar is folded to its icons, remembered in this browser. */
const FOLD_KEY = "aperture-sidebar-folded";
/** Chats the sidebar lists outside the chat page, after the pinned ones. */
const RECENT = 12;

type NavItem = { to: "/chat" | "/bot" | "/app"; label: string; icon: LucideIcon };
const NAV: NavItem[] = [
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/bot", label: "Bots", icon: Bot },
  { to: "/app", label: "Editor", icon: Code2 },
];

/**
 * The app's frame when signed in, as Grok's: a sidebar down the left with a
 * new chat, the places to go, your chats, and your account at the foot, and
 * the page beside it. On a phone the sidebar slides in from the left. On a
 * computer it folds to a rail of icons.
 *
 * `section`: what the sidebar lists in the middle; your chats when left out.
 * `onNewChat`: what New chat does; going to a new chat when left out.
 * `bar`: the phone's top bar with the menu button; a page with its own header
 * opens the sidebar itself (`useOpenSidebar`).
 * `scroll`: the page scrolls in the frame; off for a page that scrolls its own parts.
 */
export function AppShell({
  children,
  section,
  onNewChat,
  bar = true,
  scroll = true,
  landmark = true,
}: {
  children: ReactNode;
  section?: ReactNode;
  onNewChat?: () => void;
  bar?: boolean;
  scroll?: boolean;
  /** The page's own `<main>` is inside: the frame's part is a plain box, so there is one. */
  landmark?: boolean;
}) {
  const [folded, setFolded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  // The dot on Bots: what the team is up to, read every few minutes from any page.
  useBotsPulse(true);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => {
    try {
      setFolded(window.localStorage.getItem(FOLD_KEY) === "1");
    } catch {
      // Storage blocked: open.
    }
  }, []);
  // Somewhere else: the phone's sidebar gets out of the way.
  useEffect(() => setDrawer(false), [path, search]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const fold = (next: boolean) => {
    setFolded(next);
    try {
      window.localStorage.setItem(FOLD_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: for this page.
    }
  };

  return (
    <DrawerContext.Provider value={() => setDrawer(true)}>
      <div className="flex h-dvh bg-bg text-fg">
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
            folded ? "w-14" : "w-64",
          )}
          aria-label="Aperture"
        >
          <Sidebar
            path={path}
            folded={folded}
            onFold={() => fold(!folded)}
            section={section}
            onNewChat={onNewChat}
          />
        </aside>
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Menu">
            <button
              type="button"
              className="absolute inset-0 bg-bg/70"
              onClick={() => setDrawer(false)}
              aria-label="Close the menu"
            />
            <aside className="bubble-rise relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-border bg-surface shadow-2xl">
              <Sidebar
                path={path}
                folded={false}
                section={section}
                onNewChat={
                  onNewChat
                    ? () => {
                        setDrawer(false);
                        onNewChat();
                      }
                    : undefined
                }
              />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {bar && (
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 md:hidden">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                aria-label="Open the menu"
              >
                <Menu className="size-5" />
              </button>
              <Link to="/chat" className="flex items-center gap-2 text-sm font-medium">
                <ApertureMark className="size-4" />
                Aperture
              </Link>
              <NewChat onNewChat={onNewChat} className="ml-auto size-10" icon />
            </div>
          )}
          {landmark ? (
            <main
              id="main"
              className={cn("min-h-0 flex-1", scroll ? "overflow-y-auto" : "flex flex-col")}
            >
              {children}
            </main>
          ) : (
            <div className={cn("min-h-0 flex-1", scroll ? "overflow-y-auto" : "flex flex-col")}>
              {children}
            </div>
          )}
        </div>
      </div>
    </DrawerContext.Provider>
  );
}

/** New chat: the page's own, or a fresh one on the chat page. */
function NewChat({
  onNewChat,
  className,
  icon = false,
  folded = false,
}: {
  onNewChat?: () => void;
  className?: string;
  icon?: boolean;
  folded?: boolean;
}) {
  const look = icon
    ? "grid place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
    : cn(
        "flex h-10 items-center gap-2.5 rounded-xl border border-border bg-bg px-3 text-sm font-medium hover:bg-elevated",
        folded && "justify-center px-0",
      );
  const inner = (
    <>
      <SquarePen className="size-4 shrink-0" aria-hidden />
      {!icon && !folded && <span>New chat</span>}
    </>
  );
  return onNewChat ? (
    <button
      type="button"
      onClick={onNewChat}
      className={cn(look, className)}
      aria-label="New chat"
      title="New chat"
    >
      {inner}
    </button>
  ) : (
    <Link
      to="/chat"
      search={{}}
      className={cn(look, className)}
      aria-label="New chat"
      title="New chat"
    >
      {inner}
    </Link>
  );
}

function Sidebar({
  path,
  folded,
  onFold,
  section,
  onNewChat,
}: {
  path: string;
  folded: boolean;
  onFold?: () => void;
  section?: ReactNode;
  onNewChat?: () => void;
}) {
  const item =
    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-elevated hover:text-fg";
  const pulse = usePulse((s) => s.pulse);
  const pulseText = pulse ? pulseLine(pulse) : null;
  return (
    <>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 px-3",
          folded && "justify-center px-0",
        )}
      >
        {!folded && (
          <Link
            to="/chat"
            className="flex min-w-0 items-center gap-2 text-sm font-medium tracking-tight"
          >
            <ApertureMark className="size-4 shrink-0" />
            Aperture
          </Link>
        )}
        {onFold && (
          <button
            type="button"
            onClick={onFold}
            className={cn(
              "grid size-8 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-fg",
              !folded && "ml-auto",
            )}
            aria-label={folded ? "Open the sidebar" : "Fold the sidebar"}
            title={folded ? "Open the sidebar" : "Fold the sidebar"}
          >
            {folded ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>
      <div className={cn("shrink-0 space-y-1 px-2", folded && "px-1.5")}>
        <NewChat onNewChat={onNewChat} folded={folded} className="mb-2 w-full" />
        <nav aria-label="Places" className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const on = path === to || path.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  item,
                  folded && "justify-center px-0",
                  on ? "bg-elevated font-medium text-fg" : "text-muted",
                )}
                aria-current={on ? "page" : undefined}
                aria-label={
                  to === "/bot" && pulseText ? `${label}: ${pulseText}` : folded ? label : undefined
                }
                title={
                  to === "/bot" && pulseText ? `${label}: ${pulseText}` : folded ? label : undefined
                }
              >
                <span className="relative">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {/* Bots: amber when something needs you, a pulsing blue while one works. */}
                  {to === "/bot" && pulse && (pulse.needs > 0 || pulse.working > 0) && (
                    <span
                      className={cn(
                        "absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-surface",
                        pulse.needs > 0 ? "bg-warn" : "animate-pulse bg-accent",
                      )}
                      aria-hidden
                    />
                  )}
                </span>
                {!folded && label}
                {!folded && to === "/bot" && pulse && pulse.needs > 0 && (
                  <span className="ml-auto rounded-full bg-warn/15 px-1.5 text-[11px] font-medium text-warn tabular-nums">
                    {pulse.needs}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-border">
        {!folded && (section ?? <RecentChats />)}
      </div>
      <div className={cn("shrink-0 space-y-0.5 border-t border-border p-2", folded && "px-1.5")}>
        <Link
          to="/settings"
          search={{ tab: "plan" }}
          className={cn(
            item,
            folded && "justify-center px-0",
            path === "/settings" ? "bg-elevated font-medium text-fg" : "text-muted",
          )}
          aria-current={path === "/settings" ? "page" : undefined}
          aria-label={folded ? "Settings" : undefined}
          title={folded ? "Settings" : undefined}
        >
          <Settings className="size-4 shrink-0" aria-hidden />
          {!folded && "Settings"}
        </Link>
        {!folded && (
          <Link to="/" search={{ about: true }} className={cn(item, "text-muted")}>
            <Info className="size-4 shrink-0" aria-hidden />
            About Aperture
          </Link>
        )}
        <div className={cn("flex items-center gap-2 px-1.5 pt-1.5", folded && "flex-col px-0")}>
          <UserButton compact />
          {!folded && (
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Your chats, outside the chat page: the pinned ones, then the newest, to open. */
function RecentChats() {
  const my = useMyBot();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pinned = my.chats.filter((c) => c.pinned);
  const recent = my.chats.filter((c) => !c.pinned).slice(0, RECENT);
  const row = (c: ChatMeta) => (
    <li key={c.id}>
      <Link
        to="/chat"
        search={{ c: c.id }}
        className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm text-muted hover:bg-elevated hover:text-fg"
        title={c.title}
      >
        {c.pinned && <Pin className="size-3 shrink-0 fill-current text-accent" aria-hidden />}
        <span className="truncate">{c.title}</span>
      </Link>
    </li>
  );
  const label = "px-2.5 pt-3 pb-1 text-[11px] font-medium tracking-[0.12em] text-subtle uppercase";
  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Your chats">
      {my.bot && path !== "/chat" && (
        <Link
          to="/chat"
          className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-elevated"
        >
          <MascotAvatar mascot={my.bot.mascot} size={24} label="" />
          <span className="truncate text-sm font-medium">{my.bot.name}</span>
        </Link>
      )}
      {pinned.length > 0 && (
        <>
          <p className={label}>Pinned</p>
          <ul>{pinned.map(row)}</ul>
        </>
      )}
      {recent.length > 0 && (
        <>
          <p className={label}>Recent</p>
          <ul>{recent.map(row)}</ul>
        </>
      )}
      {my.loaded && my.chats.length === 0 && (
        <p className="px-2.5 py-3 text-xs text-pretty text-subtle">
          Your chats show here once you have asked something.
        </p>
      )}
    </nav>
  );
}

/**
 * A page of the app, which has its own `<main>`: in the sidebar frame once
 * signed in, and on the site, with its bar and footer, before. While sign-in
 * settles, the page alone.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (user) return <AppShell landmark={false}>{children}</AppShell>;
  if (isPending) return <div className="min-h-dvh bg-bg text-fg">{children}</div>;
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}
