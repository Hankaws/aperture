import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addBubble,
  BUBBLE_EVENT,
  BUBBLES_KEY,
  greetingFor,
  keepKnown,
  NO_BUBBLES,
  peekLine,
  PRIVATE_BUBBLE,
  readBubbles,
  removeBubble,
  type Bubbles,
} from "@/lib/bot/bubbles";
import { listBots } from "@/lib/bot/team.api";
import type { BotProfile } from "@/lib/bot/team";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { BotChat } from "./bot-chat";
import { MascotAvatar } from "./mascot";
import { useLocalBot } from "./use-my-bot";
import { useRepoBot } from "./use-repo-bot";
import { useTour } from "./use-tour";

/** Pages with a chat of their own: the editor has its agent, sign-in has nothing to chat about yet. */
const HIDDEN = new Set(["/app", "/login"]);

function stored(): Bubbles {
  try {
    return readBubbles(JSON.parse(window.localStorage.getItem(BUBBLES_KEY) ?? "null"));
  } catch {
    return NO_BUBBLES;
  }
}

/**
 * Chat bubbles in the corner of every page, like a messenger's chat heads.
 * Aperture Bot's own is always there: the private chat, and a guide for
 * someone new. A bot gets one when it is made, popping up with a hello, so
 * it can be talked to from any page. A bubble opens a chat window beside the
 * stack; on a phone, the whole screen. Minimized, a chat carries on: an
 * answer that comes meanwhile peeks out beside its bubble, which counts
 * what is unread until it is opened.
 */
export function BotBubbles() {
  const { user } = useCurrentUserState();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<Bubbles>(NO_BUBBLES);
  const [loaded, setLoaded] = useState(false);
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  /** Chats opened on this page: kept running while minimized, so an answer is never lost. */
  const [kept, setKept] = useState<string[]>([]);
  /** Answers each minimized chat got: how many, and the newest. */
  const [unread, setUnread] = useState<Record<string, { count: number; text: string }>>({});
  /** Which chat is open, for answers that come while it is not. */
  const openNow = useRef<string | null>(null);
  const tour = useTour();
  const navigate = useNavigate();
  /** The person's own bot (`my-bot.ts`): its face on Aperture Bot's bubble, once it is named. */
  const myBot = useLocalBot();

  useEffect(() => {
    openNow.current = open;
    if (!open) return;
    setKept((ids) => (ids.includes(open) ? ids : [...ids, open]));
    setUnread(({ [open]: _read, ...rest }) => rest);
  }, [open]);

  /** A chat said something: seen if it is open, else it peeks out of its bubble. */
  const replied = useCallback((id: string, text: string) => {
    if (openNow.current === id) return;
    setUnread((now) => ({ ...now, [id]: { count: (now[id]?.count ?? 0) + 1, text } }));
    setPeek(id);
  }, []);

  /** The bubbles changed: kept in this browser, for every page. */
  const change = useCallback((next: (prev: Bubbles) => Bubbles) => {
    setState((prev) => {
      const now = next(prev);
      try {
        window.localStorage.setItem(BUBBLES_KEY, JSON.stringify(now));
      } catch {
        // Blocked storage: the bubbles last as long as the page.
      }
      return now;
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setState(stored());
    setLoaded(true);
  }, [user]);

  // The Bot page has the private chat in it: Aperture Bot's bubble steps aside there.
  const onBotPage = path === "/bot";
  // The chat page is the person's own bot, whole: its bubble steps aside there too.
  const onChatPage = path === "/chat";

  // Someone new: Aperture Bot says hello once, a moment after a page shows (not the Bot page).
  useEffect(() => {
    if (!loaded || state.greeted || onBotPage || onChatPage) return;
    const timer = window.setTimeout(() => {
      setPeek(PRIVATE_BUBBLE);
      change((s) => ({ ...s, greeted: true }));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [loaded, state.greeted, onBotPage, onChatPage, change]);

  // The bots the bubbles stand for; a bot deleted since loses its bubble.
  const ids = state.ids.join(",");
  useEffect(() => {
    if (!user || !ids) return;
    let cancel = false;
    void listBots()
      .then((list) => {
        if (cancel) return;
        setBots(list);
        change((s) =>
          keepKnown(
            s,
            list.map((b) => b.id),
          ),
        );
      })
      .catch(() => {
        // Offline: the bubbles stay as they were.
      });
    return () => {
      cancel = true;
    };
  }, [user, ids, change]);

  // A bot was made: its bubble pops up and says hello.
  useEffect(() => {
    const onMade = (event: Event) => {
      const bot = (event as CustomEvent<{ bot?: BotProfile }>).detail?.bot;
      if (!bot?.id) return;
      setBots((list) => [bot, ...list.filter((b) => b.id !== bot.id)]);
      change((s) => addBubble(s, bot.id));
      setPeek(bot.id);
    };
    window.addEventListener(BUBBLE_EVENT, onMade);
    return () => window.removeEventListener(BUBBLE_EVENT, onMade);
  }, [change]);

  // Escape puts an open chat away.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user || !loaded || HIDDEN.has(path)) return null;

  const shown = state.ids.flatMap((id) => bots.filter((b) => b.id === id));
  const openBot = shown.find((b) => b.id === open);
  if ((onBotPage || onChatPage) && shown.length === 0) return null;
  // The Bot page's chats and the chat page have their box at the bottom: the bubbles sit above it.
  const raised = onBotPage || onChatPage;

  const toggle = (id: string) => {
    setPeek(null);
    setOpen((now) => (now === id ? null : id));
  };
  const close = (id: string) => {
    if (open === id) setOpen(null);
    if (peek === id) setPeek(null);
    setKept((ids) => ids.filter((x) => x !== id));
    setUnread(({ [id]: _gone, ...rest }) => rest);
    change((s) => removeBubble(s, id));
  };
  /** What a bubble says beside it: a new answer, else its hello. */
  const peekFor = (id: string, name: string | null) =>
    peek === id ? (unread[id] ? peekLine(unread[id].text) : greetingFor(name)) : null;
  const minimize = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setOpen(null)}
      aria-label="Minimize the chat"
      title="Minimize"
    >
      <Minus className="size-4" />
    </Button>
  );

  return (
    <>
      {/* Each chat opened stays, hidden when minimized, so what it is doing carries on. */}
      {kept.map((id) => {
        const bot = shown.find((b) => b.id === id);
        if (!bot) return null;
        const visible = open === bot.id;
        return (
          <div
            key={id}
            role="dialog"
            aria-label={`Chat with ${bot.name}`}
            hidden={!visible}
            className={cn(
              "bubble-rise fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface",
              "sm:inset-auto sm:right-24 sm:h-[min(36rem,calc(100dvh-8rem))] sm:w-[24rem] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl",
              raised ? "sm:bottom-24" : "sm:bottom-4",
              !visible && "hidden",
            )}
          >
            <BubbleBot
              bot={bot}
              onReply={(text) => replied(bot.id, text)}
              shown={visible}
              actions={
                <>
                  <Link
                    to="/bot"
                    className="grid size-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
                    aria-label={`Open ${bot.name} on the Bot page`}
                    title="Open on the Bot page"
                    onClick={() => setOpen(null)}
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                  {minimize}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => close(bot.id)}
                    aria-label={`Close ${bot.name}'s bubble`}
                    title="Close the bubble"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              }
            />
          </div>
        );
      })}

      <div
        className={cn(
          "fixed right-4 z-40 flex flex-col-reverse items-end gap-3",
          raised ? "bottom-24" : "bottom-4",
          // On a phone an open chat fills the screen: the bubbles wait under it.
          openBot && "max-sm:hidden",
        )}
        role="region"
        aria-label="Chat bubbles"
      >
        {!onBotPage && !onChatPage && (
          // The person's own bot lives on the chat page: its bubble goes there.
          <Bubble
            name={myBot?.name ?? "Aperture Bot"}
            open={false}
            greeting={
              peek === PRIVATE_BUBBLE
                ? myBot
                  ? `Hi, I'm ${myBot.name}! Tap me to chat.`
                  : greetingFor(null)
                : null
            }
            onToggle={() => {
              setPeek(null);
              setOpen(null);
              void navigate({ to: "/chat" });
            }}
            onDismissGreeting={() => setPeek(null)}
            badge={
              tour.show && tour.progress ? tour.progress.total - tour.progress.done : undefined
            }
          >
            {myBot ? (
              <MascotAvatar mascot={myBot.mascot} size={52} label="" />
            ) : (
              <BotAvatar size="lg" />
            )}
          </Bubble>
        )}
        {shown.map((bot) => (
          <Bubble
            key={bot.id}
            name={bot.name}
            open={open === bot.id}
            greeting={peekFor(bot.id, bot.name)}
            onToggle={() => toggle(bot.id)}
            onDismissGreeting={() => setPeek(null)}
            onClose={() => close(bot.id)}
            unread={unread[bot.id]?.count}
          >
            <MascotAvatar mascot={bot.mascot} size={52} label="" />
          </Bubble>
        ))}
      </div>
    </>
  );
}

/** One chat head: the face, a hello beside it while it is new, and a way to close it. */
function Bubble({
  name,
  open,
  greeting,
  onToggle,
  onDismissGreeting,
  onClose,
  badge,
  unread,
  children,
}: {
  name: string;
  open: boolean;
  greeting: string | null;
  onToggle: () => void;
  onDismissGreeting: () => void;
  onClose?: () => void;
  /** Steps of the welcome tour left: a count on the bubble until they are done. */
  badge?: number;
  /** Answers that came while it was minimized: a count, before the tour's. */
  unread?: number;
  children: ReactNode;
}) {
  return (
    <div className="group relative flex items-center gap-2">
      {greeting && (
        <div
          role="status"
          className="bubble-rise relative max-w-[min(16rem,calc(100vw-7rem))] rounded-2xl rounded-br-md border border-border bg-surface py-2.5 pr-8 pl-3.5 text-sm text-pretty shadow-lg"
        >
          <button type="button" onClick={onToggle} className="text-left">
            {greeting}
          </button>
          <button
            type="button"
            onClick={onDismissGreeting}
            aria-label="Dismiss"
            className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-subtle hover:bg-elevated hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={
          (open ? `Minimize the chat with ${name}` : `Chat with ${name}`) +
          (unread ? `, ${unread} new ${unread === 1 ? "message" : "messages"}` : "") +
          (badge && !unread ? `, ${badge} setup ${badge === 1 ? "step" : "steps"} left` : "")
        }
        aria-expanded={open}
        title={name}
        className={cn(
          "bubble-pop relative grid size-14 shrink-0 place-items-center rounded-full bg-surface shadow-lg ring-1 ring-border transition-transform hover:scale-105",
          open && "ring-2 ring-accent",
        )}
      >
        {children}
        {unread ? (
          <span
            aria-hidden
            className="bubble-pop absolute -top-0.5 -left-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white ring-2 ring-bg"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : badge ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-bg ring-2 ring-bg"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${name}'s bubble`}
          className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-elevated text-subtle opacity-0 shadow ring-1 ring-border transition-opacity group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** A team bot's chat in its bubble: the same conversation as on the Bot page. */
function BubbleBot({
  bot,
  actions,
  onReply,
  shown,
}: {
  bot: BotProfile;
  actions: ReactNode;
  onReply: (text: string) => void;
  shown: boolean;
}) {
  const r = useRepoBot(bot.repo);
  const lead = (
    <>
      <MascotAvatar mascot={bot.mascot} size={30} label="" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{bot.name}</span>
        <span className="block truncate font-mono text-[11px] text-subtle">{bot.repo}</span>
      </span>
    </>
  );
  if (!r.setup)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">{lead}</div>
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </div>
        {r.setupError ? (
          <p className="m-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {r.setupError}
          </p>
        ) : (
          <div className="m-4 flex-1 animate-pulse rounded-2xl bg-elevated" />
        )}
      </div>
    );
  return (
    <BotChat
      bot={bot}
      setup={r.setup}
      tasks={r.tasks ?? []}
      now={r.now}
      mood="idle"
      lead={lead}
      actions={actions}
      onSent={r.asked}
      onReply={onReply}
      shown={shown}
    />
  );
}
