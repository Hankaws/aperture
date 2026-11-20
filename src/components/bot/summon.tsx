import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { History, Maximize2, Minimize2, Pin, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEFAULT_BOT_NAME, type ChatMeta } from "@/lib/bot/my-bot";
import { useSummon } from "@/lib/bot/summon-store";
import { cn, isModEvent, modSymbol } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { MascotAvatar } from "./mascot";
import { PrivateChat } from "./private-chat";
import { noteLocalChat, useLocalBot, useMyBot } from "./use-my-bot";

/** Pages it does not open over: the chat page is the bot already, and signing in comes first. */
const NOT_HERE = new Set(["/chat", "/login"]);

/** Where signing in comes back to: this page, where it can, else the chat page. */
function backTo(path: string): "/app" | "/bot" | "/pricing" | "/settings" | "/chat" {
  for (const page of ["/app", "/bot", "/pricing", "/settings"] as const)
    if (path === page || path.startsWith(`${page}/`)) return page;
  return "/chat";
}

/** Ctrl/⌘+J: the shortcut, as this computer writes it. */
function useSummonKey(): string {
  const [mod, setMod] = useState("Ctrl+");
  useEffect(() => setMod(modSymbol() === "⌘" ? "⌘" : "Ctrl+"), []);
  return `${mod}J`;
}

/**
 * The person's own bot, over any page: Ctrl/⌘+J opens it and closes it.
 * Like JARVIS, it is there whatever they are doing. In the editor it sees
 * what is open (`editor-context.ts`) and hands changes to Composer. The
 * conversation carries on from page to page, and is kept with their chats.
 */
export function SummonBot() {
  const { user } = useCurrentUserState();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const open = useSummon((s) => s.open);
  const chat = useSummon((s) => s.chat);
  const editor = useSummon((s) => s.editor);
  const peek = useSummon((s) => s.peek);
  const composer = useSummon((s) => s.composer);
  const expanded = useSummon((s) => s.expanded);
  const bot = useLocalBot();
  const panel = useRef<HTMLDivElement>(null);
  const here = !NOT_HERE.has(path);
  const name = bot?.name ?? DEFAULT_BOT_NAME;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isModEvent(event) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "j") return;
      if (NOT_HERE.has(window.location.pathname)) return;
      event.preventDefault();
      useSummon.getState().toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Opened: the box takes the typing. Closed: back to the page.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, chat]);

  // Off to a page it does not open over: it closes, and stays closed there.
  useEffect(() => {
    if (!here && open) useSummon.getState().setOpen(false);
  }, [here, open]);

  if (!chat) return null;
  const close = () => useSummon.getState().setOpen(false);

  return (
    <>
      {/* Bigger, it sits over the page like a window: a click beside it makes it small again. */}
      {expanded && open && here && (
        <button
          type="button"
          aria-label="Make the panel smaller"
          onClick={() => useSummon.getState().toggleExpanded()}
          className="fixed inset-0 z-[59] hidden cursor-default bg-bg/60 backdrop-blur-[2px] sm:block"
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal="false"
        aria-label={`${name}, over this page`}
        hidden={!open || !here}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.stopPropagation();
            close();
          }
        }}
        className={cn(
          "summon-in fixed z-[60] flex flex-col bg-surface shadow-2xl transition-[inset,width,border-radius] duration-200",
          expanded
            ? "inset-0 sm:inset-x-[max(1.5rem,calc(50%-36rem))] sm:inset-y-6 sm:rounded-3xl sm:border sm:border-border"
            : "inset-y-0 right-0 w-full border-l border-border sm:w-[440px]",
        )}
      >
        {user ? (
          <PrivateChat
            key={chat}
            chat={chat}
            shown={open}
            editor={editor}
            peek={peek}
            composer={composer}
            onNavigate={close}
            onSaved={noteLocalChat}
            summoned
            actions={
              <>
                <ChatSwitcher current={chat} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => useSummon.getState().newChat()}
                  aria-label="New chat"
                  title="New chat"
                >
                  <SquarePen className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => useSummon.getState().toggleExpanded()}
                  aria-pressed={expanded}
                  aria-label={expanded ? "Make the panel smaller" : "Make the panel bigger"}
                  title={expanded ? "Smaller" : "Bigger, over this page"}
                  className="hidden sm:inline-flex"
                >
                  {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={close}
                  aria-label="Close"
                  title="Close (Esc)"
                >
                  <X className="size-4" />
                </Button>
              </>
            }
            className="min-h-0 flex-1"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <BotAvatar size="lg" />
            <p className="text-sm text-muted">Sign in to talk to your bot from any page.</p>
            <Link
              to="/login"
              search={{ next: backTo(path) }}
              onClick={close}
              className={buttonVariants({ size: "sm" })}
            >
              Sign in
            </Link>
            <Button variant="ghost" size="sm" onClick={close}>
              Not now
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/** Recent chats the switcher lists, after the pinned ones. */
const RECENT = 6;

/**
 * Your other chats, from the panel: the pinned ones first, then the newest,
 * to carry one on without leaving the page. Loaded when opened.
 */
function ChatSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Your chats"
        title="Your chats"
      >
        <History className="size-4" />
      </Button>
      {open && <ChatMenu current={current} onPick={() => setOpen(false)} />}
    </div>
  );
}

function ChatMenu({ current, onPick }: { current: string; onPick: () => void }) {
  const my = useMyBot();
  const pinned = my.chats.filter((c) => c.pinned);
  const recent = my.chats.filter((c) => !c.pinned).slice(0, RECENT);
  const here = my.chats.find((c) => c.id === current);
  const [error, setError] = useState<string | null>(null);
  const item = (c: ChatMeta) => (
    <li key={c.id}>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          useSummon.getState().setChat(c.id);
          onPick();
        }}
        aria-current={c.id === current ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
          c.id === current
            ? "bg-elevated text-fg"
            : "text-muted hover:bg-elevated/60 hover:text-fg",
        )}
      >
        {c.pinned && <Pin className="size-3.5 shrink-0 fill-current text-accent" aria-hidden />}
        <span className="truncate">{c.title}</span>
      </button>
    </li>
  );
  const label = "px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.12em] text-subtle uppercase";
  return (
    <div
      role="menu"
      aria-label="Your chats"
      className="absolute top-full right-0 z-10 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-1.5 shadow-xl"
    >
      {/* This chat, pinned or unpinned from here: once something was said in it, it is in the list. */}
      {here && (
        <button
          type="button"
          role="menuitem"
          onClick={() => void my.pinChat(here.id, !here.pinned).then(setError)}
          className="mb-1 flex w-full items-center gap-2 rounded-lg border-b border-border px-2.5 py-2 text-left text-sm text-fg hover:bg-elevated/60"
        >
          <Pin
            className={cn("size-3.5 shrink-0", here.pinned && "fill-current text-accent")}
            aria-hidden
          />
          {here.pinned ? "Unpin this chat" : "Pin this chat"}
        </button>
      )}
      {error && (
        <p className="px-2.5 pb-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {!my.loaded && my.chats.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-subtle">Loading your chats…</p>
      ) : my.chats.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-pretty text-subtle">
          Your chats show here once you have said something.
        </p>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <p className={label}>Pinned</p>
              <ul>{pinned.map(item)}</ul>
            </>
          )}
          {recent.length > 0 && (
            <>
              <p className={label}>Recent</p>
              <ul>{recent.map(item)}</ul>
            </>
          )}
        </>
      )}
      <p className="mt-1 border-t border-border px-2.5 pt-2 pb-1 text-xs text-subtle">
        Every chat is on the{" "}
        <Link to="/chat" onClick={onPick} className="text-accent hover:underline">
          Chat page
        </Link>
        .
      </p>
    </div>
  );
}

/** A button for it, where there is no keyboard to press: the editor's top bar. */
export function SummonButton({ className }: { className?: string }) {
  const bot = useLocalBot();
  const open = useSummon((s) => s.open);
  const key = useSummonKey();
  const name = bot?.name ?? DEFAULT_BOT_NAME;
  return (
    <button
      type="button"
      onClick={() => useSummon.getState().toggle()}
      aria-pressed={open}
      aria-label={`Ask ${name}`}
      title={`Ask ${name} about your code (${key})`}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-subtle transition-colors hover:bg-elevated hover:text-fg pointer-coarse:h-11",
        open && "bg-elevated text-fg",
        className,
      )}
    >
      {bot ? (
        <MascotAvatar mascot={bot.mascot} size={20} label="" />
      ) : (
        <BotAvatar size="sm" className="size-5" />
      )}
      <span className="hidden max-w-28 truncate lg:inline">Ask {name}</span>
      <kbd className="hidden font-mono text-[10px] text-subtle lg:inline">{key}</kbd>
    </button>
  );
}
