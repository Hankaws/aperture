import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  CircleDot,
  Clock,
  GitPullRequest,
  Loader2,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Inline } from "@/components/ide/md-preview";
import { askBot, botChat, type BotSetup } from "@/lib/github/bot";
import { CHAT_LIMITS, type ChatTurn } from "@/lib/bot/chat";
import { cardAsk, expired, isCheckCard, sendsItself, withRefs, type Thread } from "@/lib/bot/cards";
import {
  KEEP,
  chatKey,
  clearSavedChat,
  loadChat,
  mergeChats,
  saveChat,
  type Card,
  type Entry,
  type Sent,
} from "@/lib/bot/chat-saved";
import type { MascotMood } from "@/lib/bot/mascot";
import type { BotProfile } from "@/lib/bot/team";
import { loadBotChat, saveBotChat } from "@/lib/bot/team.api";
import type { BotTask } from "@/lib/bot/tasks";
import { parseMarkdown } from "@/lib/workspace/md-preview";
import { cn } from "@/lib/utils";
import { TaskCard } from "./bot-console";
import { MascotAvatar } from "./mascot";

const SUGGESTIONS = [
  "What's broken right now?",
  "Summarise the open issues",
  "How did your recent tasks go?",
  "Fix the newest bug report",
];

/** The person's last message before entry `at`: what a suggestion answers. */
function askedBefore(entries: Entry[], at: number): string | null {
  for (let i = at - 1; i >= 0; i--) if (entries[i]!.role === "user") return entries[i]!.text;
  return null;
}

/** What the model reads back of an answer: its text, and what became of each task it proposed. */
function turnText(entry: Entry): string {
  if (entry.role === "user" || !entry.cards?.length) return entry.text;
  const cards = entry.cards.map((c) => {
    const where = c.number ? `#${c.number}` : `a new issue "${c.title ?? c.task.split("\n")[0]}"`;
    const fate = c.sent ? `sent as #${c.sent.number}` : c.dismissed ? "dismissed" : "not sent yet";
    return `- Proposed on ${where}: ${c.task} (${fate})`;
  });
  return `${entry.text}\n\n${cards.join("\n")}`;
}

const id = () => Math.random().toString(36).slice(2, 10);

/**
 * The task a sent card started: on its thread, asked since it was sent, with
 * the same words when there are some (tasks come newest first).
 */
function taskFor(card: Card, tasks: BotTask[]): BotTask | null {
  const sent = card.sent;
  if (!sent) return null;
  const since = tasks.filter((t) => t.number === sent.number && t.askedAt >= sent.at.slice(0, 19));
  return since.find((t) => t.task === card.task) ?? since.at(-1) ?? null;
}

/**
 * The conversation with one bot of the team about its repository: the room's
 * header (`lead` on the left, `actions` on the right), the thread, and the
 * composer. `intro` sits under the greeting until the conversation starts.
 */
export function BotChat({
  bot,
  setup,
  tasks,
  now,
  mood,
  lead,
  actions,
  intro,
  onSent,
  onChange,
  onEditRule,
}: {
  bot: BotProfile;
  setup: BotSetup;
  tasks: BotTask[];
  now: number;
  /** What the bot is doing on GitHub; thinking while it answers here. */
  mood: MascotMood;
  lead: ReactNode;
  actions?: ReactNode;
  intro?: ReactNode;
  onSent: () => void;
  /** The conversation changed: for the roster's last line. */
  onChange?: (entries: Entry[]) => void;
  /** Opens the bot's profile, where its rule is. */
  onEditRule?: () => void;
}) {
  const repo = bot.repo;
  const [owner = "", name = ""] = repo.split("/");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  /** The conversation as it is now, for code that runs after an await. */
  const latest = useRef<Entry[]>([]);
  const botId = bot.id;

  const show = (next: Entry[]) => {
    latest.current = next;
    setEntries(next);
  };

  useEffect(() => {
    let cancel = false;
    const key = chatKey({ id: botId });
    let local = loadChat(key);
    if (local.length === 0) {
      // A conversation kept per repository, before bots had names, carries over once, here.
      local = loadChat(repo);
      if (local.length > 0) {
        saveChat(key, local);
        clearSavedChat(repo);
      }
    }
    const opened = new Set(local.map((e) => e.id));
    show(local);
    // The account's copy is the one every device shares.
    void loadBotChat({ data: { id: botId } })
      .then((kept) => {
        if (cancel || !kept.ok) return;
        if (kept.updatedAt === null) {
          // Never kept on the account: this browser's copy goes up.
          if (latest.current.length > 0)
            void saveBotChat({ data: { id: botId, entries: latest.current.slice(-KEEP) } }).catch(
              () => {},
            );
          return;
        }
        // The account's copy wins (even an empty, cleared one); what was just said is kept.
        const merged = mergeChats(kept.entries, latest.current, opened);
        show(merged);
        saveChat(key, merged);
        if (merged.length > kept.entries.length)
          void saveBotChat({ data: { id: botId, entries: merged } }).catch(() => {});
      })
      .catch(() => {
        // Offline or signed out: this browser's copy stands, and nothing goes up.
      });
    return () => {
      cancel = true;
    };
  }, [botId, repo]);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [entries.length, busy]);

  const update = (next: Entry[]) => {
    show(next);
    saveChat(chatKey(bot), next);
    void saveBotChat({ data: { id: bot.id, entries: next.slice(-KEEP) } }).catch(() => {});
    onChange?.(next);
  };

  async function send(text: string) {
    const said = text.trim();
    if (!said || busy) return;
    const asked: Entry[] = [...latest.current, { id: id(), role: "user", text: said }];
    update(asked);
    setDraft("");
    setBusy(true);
    // The server reads the newest turns, each clipped: send no more than it takes.
    const turns: ChatTurn[] = asked
      .filter((e) => !(e.role === "assistant" && e.error))
      .slice(-CHAT_LIMITS.turns)
      .map((e) => ({ role: e.role, text: turnText(e).slice(0, CHAT_LIMITS.turnChars) }));
    let reply: Entry;
    try {
      const out = await botChat({ data: { owner, repo: name, botId: bot.id, turns } });
      const at = new Date().toISOString();
      reply = out.ok
        ? {
            id: id(),
            role: "assistant",
            text: out.reply,
            looked: out.looked,
            cards: out.proposals.map((p) => ({ ...p, at })),
          }
        : { id: id(), role: "assistant", text: out.error, error: true };
    } catch (err) {
      reply = {
        id: id(),
        role: "assistant",
        text: err instanceof Error ? err.message : "The bot could not answer.",
        error: true,
      };
    } finally {
      setBusy(false);
    }
    // After the conversation as it is now: a card sent or dismissed meanwhile stays so.
    update([...latest.current, reply]);
    if (reply.role === "assistant") await sendByRule(reply.id, reply.cards ?? []);
  }

  /** The bot's rule at work: a check on a pull request sends itself, and says so. */
  async function sendByRule(entryId: string, cards: Card[]) {
    if (!setup.workflow) return;
    let sent = false;
    for (const [i, card] of cards.entries()) {
      const thread = setup.open.find((o) => o.number === card.number);
      if (!sendsItself(card, bot.allow, Boolean(thread?.isPull))) continue;
      try {
        const out = await askBot({
          data: { owner, repo: name, number: card.number, task: card.task },
        });
        if (!out.ok) continue;
        setCard(entryId, i, {
          sent: {
            number: out.number,
            url: out.url,
            at: new Date(Date.now() - 60_000).toISOString(),
          },
          auto: true,
        });
        sent = true;
      } catch {
        // Left for a click, as without the rule.
      }
    }
    if (sent) onSent();
  }

  const setCard = (entryId: string, index: number, patch: Partial<Card>) =>
    update(
      latest.current.map((e) =>
        e.id === entryId && e.role === "assistant"
          ? { ...e, cards: e.cards?.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
          : e,
      ),
    );

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Chat with ${bot.name}`}>
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">{lead}</div>
        <div className="flex shrink-0 items-center gap-1">
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update([])}
              aria-label="Clear the chat"
              title="Clear the chat"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          {actions}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
        {entries.length === 0 && !busy && (
          <div className="flex flex-col items-center px-2 py-6 text-center">
            <MascotAvatar mascot={bot.mascot} mood={mood} size={72} />
            <p className="mt-4 text-lg font-medium text-balance">Hi, I&apos;m {bot.name}.</p>
            <p className="mt-1 max-w-md text-sm text-pretty text-muted">
              I look after <span className="font-mono text-xs">{repo}</span>: I read its issues,
              pull requests and CI, and suggest tasks. Nothing reaches GitHub until you send it.
            </p>
            {intro ?? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="h-9 rounded-full border border-border px-3.5 text-sm text-muted transition-colors hover:border-fg/30 hover:text-fg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {entries.map((entry, at) =>
          entry.role === "user" ? (
            <div key={entry.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-elevated px-4 py-2.5 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {entry.text}
              </p>
            </div>
          ) : (
            <div key={entry.id} className="flex gap-3">
              <MascotAvatar mascot={bot.mascot} size={28} className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-3">
                {entry.error ? (
                  <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {entry.text}{" "}
                    {/key|endpoint|Settings/i.test(entry.text) && (
                      <Link to="/settings" search={{ tab: "models" }} className="underline">
                        Open Settings
                      </Link>
                    )}
                  </p>
                ) : (
                  <Reply text={entry.text} open={setup.open} repo={repo} />
                )}
                {entry.looked && entry.looked.length > 0 && (
                  <p className="text-xs text-subtle">
                    Looked at {[...new Set(entry.looked)].join(" · ")}
                  </p>
                )}
                {entry.cards?.map((card, i) =>
                  card.dismissed ? null : (
                    <ProposalCard
                      key={i}
                      card={card}
                      bot={bot.name}
                      asked={askedBefore(entries, at)}
                      onEditRule={onEditRule}
                      owner={owner}
                      name={name}
                      setup={setup}
                      task={taskFor(card, tasks)}
                      now={now}
                      onSent={(sent) => {
                        setCard(entry.id, i, { sent });
                        onSent();
                      }}
                      onDismiss={() => setCard(entry.id, i, { dismissed: true })}
                    />
                  ),
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <MascotAvatar mascot={bot.mascot} mood="thinking" size={28} />
            {bot.name} is looking at GitHub…
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-elevated p-1.5 focus-within:ring-2 focus-within:ring-accent/40">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={6000}
            placeholder={`Message ${bot.name}`}
            aria-label={`Message to ${bot.name}`}
            className="max-h-40 min-h-10 border-0 bg-transparent focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="shrink-0 rounded-lg"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-2 px-1 text-xs text-subtle">
          Uses your model key from Settings. Enter sends, Shift+Enter adds a line.
        </p>
      </form>
    </section>
  );
}

/** Text, with the open issues and pull requests it names as links that preview them. */
function Linked({ text, open, repo }: { text: string; open: Thread[]; repo: string }) {
  return (
    <>
      {withRefs(text, open).map((part, i) =>
        typeof part === "string" ? (
          <Inline key={i} text={part} />
        ) : (
          <RefLink key={i} thread={part} repo={repo} />
        ),
      )}
    </>
  );
}

/** `#12`, as a link to GitHub, with a card on hover or focus: what it is, and its title. */
function RefLink({ thread, repo }: { thread: Thread; repo: string }) {
  return (
    <span className="group relative inline-block">
      <a
        href={`https://github.com/${repo}/${thread.isPull ? "pull" : "issues"}/${thread.number}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-accent hover:underline"
        aria-label={`${thread.isPull ? "Pull request" : "Issue"} #${thread.number}: ${thread.title}`}
      >
        #{thread.number}
      </a>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1.5 w-64 rounded-xl border border-border bg-surface p-3 text-left opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <span className="flex items-center gap-1.5 text-xs text-ok">
          {thread.isPull ? (
            <GitPullRequest className="size-3.5" />
          ) : (
            <CircleDot className="size-3.5" />
          )}
          Open {thread.isPull ? "pull request" : "issue"} #{thread.number}
        </span>
        <span className="mt-1 block text-sm font-medium text-fg">{thread.title}</span>
        <span className="mt-0.5 block font-mono text-[11px] text-subtle">{repo}</span>
      </span>
    </span>
  );
}

function Reply({ text, open, repo }: { text: string; open: Thread[]; repo: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {parseMarkdown(text).map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Linked text={item} open={open} repo={repo} />
              </li>
            ))}
          </ul>
        ) : block.type === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg border border-border bg-elevated p-3 font-mono text-xs"
          >
            {block.text}
          </pre>
        ) : (
          <p key={i} className={block.type === "h" ? "font-medium" : undefined}>
            <Linked text={block.text} open={open} repo={repo} />
          </p>
        ),
      )}
    </div>
  );
}

function ProposalCard({
  card,
  bot,
  asked,
  onEditRule,
  owner,
  name,
  setup,
  task,
  now,
  onSent,
  onDismiss,
}: {
  card: Card;
  /** The bot's name, so the card says who wants to act. */
  bot: string;
  /** What the person said that led to this suggestion, quoted on the card. */
  asked: string | null;
  onEditRule?: () => void;
  owner: string;
  name: string;
  setup: BotSetup;
  task: BotTask | null;
  now: number;
  onSent: (sent: Sent) => void;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thread = card.number ? setup.open.find((o) => o.number === card.number) : null;

  if (card.sent && task) return <TaskCard task={task} now={now} />;
  const stale = expired(card, now);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const out = await askBot({
        data: { owner, repo: name, number: card.number, title: card.title, task: card.task },
      });
      if (out.ok)
        onSent({
          number: out.number,
          url: out.url,
          at: new Date(Date.now() - 60_000).toISOString(),
        });
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        stale ? "border-border bg-elevated/40" : "border-accent/30 bg-accent/5",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-xs font-medium",
          stale ? "text-muted" : "text-accent",
        )}
      >
        {isCheckCard(card) ? (
          <ShieldCheck className="size-3.5 shrink-0" />
        ) : (
          <GitPullRequest className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 truncate">{cardAsk(card, bot, thread ?? null)}</span>
      </p>
      {asked && (
        <p className="mt-2 line-clamp-2 border-l-2 border-border pl-2.5 text-xs text-muted">
          You asked: {asked}
        </p>
      )}
      <p className="mt-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
        {isCheckCard(card)
          ? "Run Aperture Agent Check on it and report. Nothing is changed."
          : card.task}
      </p>
      {card.sent && card.auto && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <ShieldCheck className="size-3.5 text-ok" />
          Sent by {bot}&apos;s rule: always allow checks.
          {onEditRule && (
            <button type="button" onClick={onEditRule} className="text-accent hover:underline">
              Edit rule
            </button>
          )}
        </p>
      )}
      {card.sent ? (
        <p className="mt-3 text-sm text-muted">
          Sent.{" "}
          <a
            href={card.sent.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            See it on GitHub
          </a>
          . Waiting for the workflow to pick it up…
        </p>
      ) : stale ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-3.5" />
            Expired unsent after a day: the repository may have moved on. Ask {bot} again.
          </p>
          <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss this task">
            <X className="size-4" />
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void send()} disabled={busy || !setup.workflow}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send the task
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss this task">
            <X className="size-4" />
            Dismiss
          </Button>
          {!setup.workflow && (
            <span className="text-xs text-warn">Set up the workflow on this repo first.</span>
          )}
        </div>
      )}
      {error && <p className={cn("mt-2 text-sm text-danger")}>{error}</p>}
    </div>
  );
}
