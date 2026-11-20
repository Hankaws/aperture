import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, PanelLeft, Pencil, Pin, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BOT_NAMES } from "@/lib/bot/mascot";
import {
  chatGroups,
  cleanBotName,
  MY_BOT_NAME_MAX,
  newChatId,
  suggestedBot,
  type ChatHit,
  type ChatMeta,
  type MyBot,
} from "@/lib/bot/my-bot";
import { cn } from "@/lib/utils";
import { MascotPicker } from "./bot-profile";
import { MascotAvatar } from "./mascot";
import { PrivateChat } from "./private-chat";
import { useMyBot } from "./use-my-bot";

/**
 * The person's own bot, on a page of its own, as Grok is: their chats down
 * the side, newest first, and the one open in the middle, with a greeting
 * and the box in the middle until something is asked. The first time, they
 * name the bot and choose its face. `chat`: the open conversation; none, a
 * new one.
 */
export function ChatPage({ chat }: { chat?: string }) {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const my = useMyBot();
  const [fresh, setFresh] = useState(() => newChatId());
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(false);
  const open = chat ?? fresh;
  const firstName =
    user && !user.isDevFallback ? (user.displayName?.split(/\s+/)[0] ?? null) : null;

  // Another chat chosen: the drawer gets out of the way.
  useEffect(() => setDrawer(false), [chat]);

  const newChat = () => {
    setFresh(newChatId());
    setDrawer(false);
    void navigate({ to: "/chat", search: {} });
  };

  if (!my.loaded && !my.bot)
    return <div className="m-4 flex-1 animate-pulse rounded-2xl bg-elevated" aria-hidden />;

  if (!my.bot || editing)
    return (
      <MeetYourBot
        seed={user?.id ?? "you"}
        current={my.bot}
        onSave={async (bot) => {
          const error = await my.save(bot);
          if (!error) setEditing(false);
          return error;
        }}
        onCancel={my.bot ? () => setEditing(false) : undefined}
      />
    );

  const sidebar = (
    <Sidebar
      bot={my.bot}
      chats={my.chats}
      open={chat ?? null}
      onNew={newChat}
      onEdit={() => setEditing(true)}
      onDelete={(id) => {
        void my.removeChat(id);
        if (id === chat) newChat();
      }}
      onRename={my.renameChat}
      onPin={async (id, pinned) => {
        const error = await my.pinChat(id, pinned);
        if (error) toast.error(error);
      }}
      onSearch={my.search}
    />
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        {sidebar}
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="Your chats">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70"
            onClick={() => setDrawer(false)}
            aria-label="Close your chats"
          />
          <aside className="bubble-rise relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-border bg-surface shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <PrivateChat
          key={open}
          page
          chat={open}
          bot={my.bot}
          firstName={firstName}
          onSaved={(meta) => {
            my.noteChat(meta);
            // A new chat's first question: the address now names it, so a reload comes back to it.
            if (!chat && meta.id === fresh)
              void navigate({ to: "/chat", search: { c: fresh }, replace: true });
          }}
          lead={
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setDrawer(true)}
              aria-label="Your chats"
            >
              <PanelLeft className="size-4" />
            </Button>
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={newChat}
              aria-label="New chat"
              title="New chat"
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}

/**
 * The chats down the side: a new one, a search over them, then every one by
 * day, each to open, rename or delete, and the bot at the foot.
 */
function Sidebar({
  bot,
  chats,
  open,
  onNew,
  onEdit,
  onDelete,
  onRename,
  onPin,
  onSearch,
}: {
  bot: MyBot;
  chats: ChatMeta[];
  open: string | null;
  onNew: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => Promise<string | null>;
  onPin: (id: string, pinned: boolean) => void;
  onSearch: (text: string) => Promise<ChatHit[]>;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ChatHit[] | null>(null);
  const groups = chatGroups(chats);
  const searching = query.trim().length > 0;

  // A moment after typing stops, the search runs; the newest search's answer wins.
  useEffect(() => {
    const words = query.trim();
    if (!words) {
      setHits(null);
      return;
    }
    let cancel = false;
    const timer = window.setTimeout(() => {
      void onSearch(words).then((found) => !cancel && setHits(found));
    }, 250);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [query, onSearch]);

  const row = (c: ChatMeta, snippet?: string) => (
    <ChatRow
      key={c.id}
      chat={c}
      snippet={snippet}
      open={c.id === open}
      onDelete={() => onDelete(c.id)}
      onRename={(title) => onRename(c.id, title)}
      onPin={() => onPin(c.id, !c.pinned)}
    />
  );

  return (
    <>
      <div className="space-y-2 p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onNew}>
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setQuery("")}
            placeholder="Search chats"
            aria-label="Search your chats"
            maxLength={100}
            className="h-9 pl-8"
          />
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Your chats">
        {searching ? (
          hits === null ? (
            <p className="px-2 py-3 text-xs text-subtle" aria-live="polite">
              Searching…
            </p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-3 text-xs text-pretty text-subtle" aria-live="polite">
              No chats with &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <>
              <p
                className="px-2 pb-1 text-[11px] font-medium tracking-[0.12em] text-subtle uppercase"
                aria-live="polite"
              >
                {hits.length === 1 ? "1 chat" : `${hits.length} chats`}
              </p>
              <ul>{hits.map((h) => row(h, h.snippet))}</ul>
            </>
          )
        ) : groups.length === 0 ? (
          <p className="px-2 py-3 text-xs text-pretty text-subtle">
            Your chats with {bot.name} show here, newest first.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mt-3 first:mt-0">
              <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.12em] text-subtle uppercase">
                {group.label}
              </p>
              <ul>{group.chats.map((c) => row(c))}</ul>
            </div>
          ))
        )}
      </nav>
      <div className="flex items-center gap-2.5 border-t border-border p-3">
        <MascotAvatar mascot={bot.mascot} size={32} label="" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{bot.name}</p>
          <p className="truncate text-xs text-subtle">Your own bot</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Change ${bot.name}'s name or face`}
          title="Name and face"
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    </>
  );
}

/** One chat in the list: its title (and, found by a search, where), to open, pin, rename or delete. */
function ChatRow({
  chat,
  snippet,
  open,
  onDelete,
  onRename,
  onPin,
}: {
  chat: ChatMeta;
  snippet?: string;
  open: boolean;
  onDelete: () => void;
  onRename: (title: string) => Promise<string | null>;
  onPin: () => void;
}) {
  const [mode, setMode] = useState<"show" | "rename" | "delete">("show");
  const [title, setTitle] = useState(chat.title);
  const [error, setError] = useState<string | null>(null);

  if (mode === "delete")
    return (
      <li className="flex items-center gap-1 rounded-lg bg-elevated px-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate">Delete this chat?</span>
        <button
          type="button"
          className="rounded px-1.5 text-danger hover:bg-danger/10"
          onClick={() => {
            setMode("show");
            onDelete();
          }}
        >
          Delete
        </button>
        <button
          type="button"
          className="grid size-6 place-items-center rounded text-subtle hover:text-fg"
          onClick={() => setMode("show")}
          aria-label="Keep it"
        >
          <X className="size-3.5" />
        </button>
      </li>
    );

  if (mode === "rename")
    return (
      <li className="px-1 py-1">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onRename(title).then((e) => {
              setError(e);
              if (!e) setMode("show");
            });
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setTitle(chat.title);
                setError(null);
                setMode("show");
              }
            }}
            onBlur={(event) => event.currentTarget.form?.requestSubmit()}
            maxLength={80}
            aria-label="The chat's title"
            className="h-8 text-sm"
            autoFocus
          />
          {error && <p className="mt-1 px-1 text-xs text-danger">{error}</p>}
        </form>
      </li>
    );

  const tool =
    "grid size-6 place-items-center rounded text-subtle opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100";
  return (
    <li className="group relative">
      <Link
        to="/chat"
        search={{ c: chat.id }}
        className={cn(
          "block rounded-lg py-1.5 pr-20 pl-2 text-sm",
          open ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
        )}
        aria-current={open ? "page" : undefined}
        title={chat.title}
      >
        <span className="block truncate">{chat.title}</span>
        {snippet && (
          <span className="mt-0.5 line-clamp-2 text-xs text-subtle [overflow-wrap:anywhere]">
            {snippet}
          </span>
        )}
      </Link>
      <span className="absolute top-1.5 right-1 flex gap-0.5">
        <button
          type="button"
          onClick={onPin}
          aria-pressed={Boolean(chat.pinned)}
          className={cn(tool, "hover:text-fg", chat.pinned && "text-accent md:opacity-100")}
          aria-label={
            chat.pinned ? `Unpin the chat "${chat.title}"` : `Pin the chat "${chat.title}"`
          }
          title={chat.pinned ? "Unpin" : "Pin to the top"}
        >
          {/* Pinned: the pin shows, filled, whether or not the row is hovered. */}
          <Pin className={cn("size-3.5", chat.pinned && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle(chat.title);
            setMode("rename");
          }}
          className={cn(tool, "hover:text-fg")}
          aria-label={`Rename the chat "${chat.title}"`}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setMode("delete")}
          className={cn(tool, "hover:text-danger")}
          aria-label={`Delete the chat "${chat.title}"`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

/**
 * Meeting the bot: its name and its face, chosen by its person. Offered a
 * name and a face that follow from them, so one tap will do.
 */
function MeetYourBot({
  seed,
  current,
  onSave,
  onCancel,
}: {
  seed: string;
  current: MyBot | null;
  onSave: (bot: MyBot) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<MyBot>(() => current ?? suggestedBot(seed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faces, setFaces] = useState(Boolean(current));
  const name = cleanBotName(draft.name);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <form
        className="mx-auto flex max-w-lg flex-col items-center px-4 py-10 text-center sm:py-14"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name) return;
          setBusy(true);
          setError(null);
          void onSave({ name, mascot: draft.mascot }).then((e) => {
            setBusy(false);
            setError(e);
          });
        }}
      >
        <MascotAvatar mascot={draft.mascot} size={96} label="" className="bubble-pop" />
        <h1 className="mt-5 text-2xl font-medium tracking-tight text-balance sm:text-3xl">
          {current ? `${current.name}'s name and face` : "Meet your own bot"}
        </h1>
        {!current && (
          <p className="mt-2 text-pretty text-muted">
            Give it a name and a face. Only you talk to it: it answers to that name, remembers only
            what you let it, and nothing you say is posted anywhere.
          </p>
        )}
        <label className="mt-7 w-full text-left text-sm font-medium" htmlFor="my-bot-name">
          Its name
        </label>
        <Input
          id="my-bot-name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          maxLength={MY_BOT_NAME_MAX}
          className="mt-1.5 h-11 text-base"
          autoFocus
        />
        <div className="mt-2.5 flex w-full flex-wrap gap-1.5">
          {BOT_NAMES.slice(0, 8).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDraft({ ...draft, name: n })}
              className={cn(
                "min-h-8 rounded-full border px-3 text-sm transition-colors",
                draft.name === n
                  ? "border-accent/60 bg-accent/10 text-fg"
                  : "border-border text-muted hover:border-fg/30 hover:text-fg",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {faces ? (
          <div className="mt-6 w-full text-left">
            <MascotPicker
              value={draft.mascot}
              onChange={(mascot) => setDraft({ ...draft, mascot })}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFaces(true)}
            className="mt-5 text-sm text-accent hover:underline"
          >
            Choose its face
          </button>
        )}
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="submit" size="lg" disabled={busy || !name}>
            {current ? "Save" : `Start chatting with ${name ?? "it"}`}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
