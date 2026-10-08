import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, GitPullRequest, Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Inline } from "@/components/ide/md-preview";
import { askBot, botChat, type BotSetup } from "@/lib/github/bot";
import type { ChatTurn, Proposal } from "@/lib/bot/chat";
import type { BotTask } from "@/lib/bot/tasks";
import { parseMarkdown } from "@/lib/workspace/md-preview";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { TaskCard } from "./bot-console";

type Sent = { number: number; url: string; at: string };
type Card = Proposal & { sent?: Sent; dismissed?: boolean };
type Entry =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      looked?: string[];
      cards?: Card[];
      error?: boolean;
    };

const KEEP = 40;
const SUGGESTIONS = [
  "What's broken right now?",
  "Summarise the open issues",
  "How did your recent tasks go?",
  "Fix the newest bug report",
];

const key = (repo: string) => `aperture-bot-chat:${repo}`;

/** The conversation, per repository and per browser: a convenience, so a failed read is an empty chat. */
function loadChat(repo: string): Entry[] {
  try {
    const raw = window.localStorage.getItem(key(repo));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Entry[]).slice(-KEEP) : [];
  } catch {
    return [];
  }
}

function saveChat(repo: string, entries: Entry[]) {
  try {
    window.localStorage.setItem(key(repo), JSON.stringify(entries.slice(-KEEP)));
  } catch {
    // Full or blocked storage: the chat just is not kept.
  }
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

export function BotChat({
  owner,
  name,
  setup,
  tasks,
  now,
  onSent,
}: {
  owner: string;
  name: string;
  setup: BotSetup;
  tasks: BotTask[];
  now: number;
  onSent: () => void;
}) {
  const repo = `${owner}/${name}`;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => setEntries(loadChat(repo)), [repo]);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [entries.length, busy]);

  const update = (next: Entry[]) => {
    setEntries(next);
    saveChat(repo, next);
  };

  async function send(text: string) {
    const said = text.trim();
    if (!said || busy) return;
    const asked: Entry[] = [...entries, { id: id(), role: "user", text: said }];
    update(asked);
    setDraft("");
    setBusy(true);
    try {
      const turns: ChatTurn[] = asked
        .filter((e) => !(e.role === "assistant" && e.error))
        .map((e) => ({ role: e.role, text: turnText(e) }));
      const out = await botChat({ data: { owner, repo: name, turns } });
      update([
        ...asked,
        out.ok
          ? {
              id: id(),
              role: "assistant",
              text: out.reply,
              looked: out.looked,
              cards: out.proposals,
            }
          : { id: id(), role: "assistant", text: out.error, error: true },
      ]);
    } catch (err) {
      update([
        ...asked,
        {
          id: id(),
          role: "assistant",
          text: err instanceof Error ? err.message : "The bot could not answer.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const setCard = (entryId: string, index: number, patch: Partial<Card>) =>
    update(
      entries.map((e) =>
        e.id === entryId && e.role === "assistant"
          ? { ...e, cards: e.cards?.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
          : e,
      ),
    );

  return (
    <section
      className="flex min-h-[32rem] flex-col rounded-2xl border border-border bg-surface lg:h-[calc(100dvh-11rem)]"
      aria-label={`Chat with Aperture Bot about ${repo}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <BotAvatar size="sm" working={busy} />
          <span className="truncate">Aperture Bot · {repo}</span>
        </p>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => update([])} aria-label="Clear the chat">
            <Trash2 className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
        {entries.length === 0 && !busy && (
          <div className="flex flex-col items-center px-2 py-8 text-center">
            <BotAvatar size="lg" />
            <p className="mt-4 text-lg font-medium text-balance">
              What should we work on in {name}?
            </p>
            <p className="mt-1 max-w-md text-sm text-pretty text-muted">
              I read the issues, pull requests and CI, and suggest tasks. Nothing reaches GitHub
              until you send it.
            </p>
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
          </div>
        )}

        {entries.map((entry) =>
          entry.role === "user" ? (
            <div key={entry.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-elevated px-4 py-2.5 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {entry.text}
              </p>
            </div>
          ) : (
            <div key={entry.id} className="flex gap-3">
              <BotAvatar size="sm" className="mt-0.5" />
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
                  <Reply text={entry.text} />
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
            <BotAvatar size="sm" working />
            Looking at GitHub…
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
        <div className="flex items-end gap-2 rounded-xl border border-border bg-elevated p-1.5 focus-within:ring-2 focus-within:ring-accent/40">
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
            placeholder={`Ask about ${name}, or say what to change…`}
            aria-label="Message to Aperture Bot"
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

function Reply({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {parseMarkdown(text).map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
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
            <Inline text={block.text} />
          </p>
        ),
      )}
    </div>
  );
}

function ProposalCard({
  card,
  owner,
  name,
  setup,
  task,
  now,
  onSent,
  onDismiss,
}: {
  card: Card;
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
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-accent">
        <GitPullRequest className="size-3.5" />
        {card.number
          ? `Task on #${card.number}${thread ? ` ${thread.title}` : ""}`
          : `New issue${card.title ? `: ${card.title}` : ""}`}
      </p>
      <p className="mt-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{card.task}</p>
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
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void send()} disabled={busy || !setup.workflow}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send to Aperture Bot
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
