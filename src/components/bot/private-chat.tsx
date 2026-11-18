import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Inline } from "@/components/ide/md-preview";
import { CHAT_LIMITS, type ChatTurn } from "@/lib/bot/chat";
import { KEEP, loadChat, mergeChats, saveChat, type Entry } from "@/lib/bot/chat-saved";
import { loadPrivateChat, privateChat, savePrivateChat } from "@/lib/bot/private-chat.api";
import { PRIVATE_SUGGESTIONS, replyBlocks } from "@/lib/bot/private-chat";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";

/** This browser's copy, beside the account's: what shows at once, and all a visitor has. */
const LOCAL_KEY = "private";

const THINKING = ["Thinking it through", "Working it out", "Putting it into words"];

const id = () => Math.random().toString(36).slice(2, 10);

/** The person's last message before entry `at`: what "Try again" sends. */
function askedBefore(entries: Entry[], at: number): string | null {
  for (let i = at - 1; i >= 0; i--) if (entries[i]!.role === "user") return entries[i]!.text;
  return null;
}

/**
 * A private chat with Aperture Bot, like Grok: anything, with no repository
 * and no GitHub. Answers come from the person's model; nothing is posted
 * anywhere. Kept on the account, so every device shows the same, and in this
 * browser too, so it shows before the account answers.
 */
export function PrivateChat({
  className,
  lead,
}: {
  className?: string;
  /** Before the header's name: the team view's back button, on a phone. */
  lead?: ReactNode;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  /** The conversation as it is now, for code that runs after an await. */
  const latest = useRef<Entry[]>([]);

  const show = (next: Entry[]) => {
    latest.current = next;
    setEntries(next);
  };

  useEffect(() => {
    let cancel = false;
    const local = loadChat(LOCAL_KEY);
    const opened = new Set(local.map((e) => e.id));
    show(local);
    void loadPrivateChat()
      .then((kept) => {
        if (cancel || !kept.ok) return;
        if (kept.updatedAt === null) {
          // Never kept on the account: this browser's copy goes up.
          if (latest.current.length > 0)
            void savePrivateChat({ data: { entries: latest.current.slice(-KEEP) } }).catch(
              () => {},
            );
          return;
        }
        // The account's copy wins (even an empty, cleared one); what was just said is kept.
        const merged = mergeChats(kept.entries, latest.current, opened);
        show(merged);
        saveChat(LOCAL_KEY, merged);
        if (merged.length > kept.entries.length)
          void savePrivateChat({ data: { entries: merged } }).catch(() => {});
      })
      .catch(() => {
        // Offline: this browser's copy stands.
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length, busy]);

  const update = (next: Entry[]) => {
    show(next);
    saveChat(LOCAL_KEY, next);
    void savePrivateChat({ data: { entries: next.slice(-KEEP) } }).catch(() => {});
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
      .map((e) => ({ role: e.role, text: e.text.slice(0, CHAT_LIMITS.turnChars) }));
    let reply: Entry;
    try {
      const out = await privateChat({ data: { turns } });
      reply = out.ok
        ? { id: id(), role: "assistant", text: out.reply }
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
    update([...latest.current, reply]);
    requestAnimationFrame(() => box.current?.focus());
  }

  return (
    <section
      className={cn("flex h-full min-h-0 flex-col", className)}
      aria-label="Private chat with Aperture Bot"
    >
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {lead}
          <BotAvatar size="sm" working={busy} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Private chat</p>
            <p className="flex items-center gap-1 truncate text-xs text-subtle">
              <Lock className="size-3 shrink-0" aria-hidden />
              Just you and the bot. Nothing is posted anywhere.
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update([])}
            disabled={busy}
            aria-label="Clear the chat"
            title="Clear the chat"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5">
          {entries.length === 0 && !busy && (
            <div className="flex flex-col items-center px-2 py-6 text-center">
              <BotAvatar size="lg" />
              <p className="mt-4 text-lg font-medium text-balance">Ask me anything.</p>
              <p className="mt-1 max-w-md text-sm text-pretty text-muted">
                Questions, writing, planning, code. This chat is yours alone: it belongs to no
                repository, and nothing here reaches GitHub.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {PRIVATE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setDraft(`${s}: `);
                      requestAnimationFrame(() => box.current?.focus());
                    }}
                    className="min-h-9 rounded-full border border-border px-3.5 text-sm text-muted transition-colors hover:border-fg/30 hover:text-fg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map((entry, at) =>
            entry.role === "user" ? (
              <div key={entry.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {entry.text}
                </p>
              </div>
            ) : (
              <div key={entry.id} className="flex gap-3">
                <BotAvatar size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  {entry.error ? (
                    <div className="space-y-2">
                      <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                        {entry.text}{" "}
                        {/key|endpoint|Settings/i.test(entry.text) && (
                          <Link to="/settings" search={{ tab: "models" }} className="underline">
                            Open Settings
                          </Link>
                        )}
                      </p>
                      {askedBefore(entries, at) && (
                        <button
                          type="button"
                          onClick={() => {
                            const again = askedBefore(entries, at);
                            if (again) void send(again);
                          }}
                          className="min-h-6 text-xs font-medium text-accent hover:underline"
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  ) : (
                    <Reply text={entry.text} />
                  )}
                </div>
              </div>
            ),
          )}

          {busy && <Thinking />}
          <div ref={end} />
        </div>
      </div>

      <form
        className="border-t border-border px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-elevated p-1.5 focus-within:ring-2 focus-within:ring-accent/40">
            <Textarea
              ref={box}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              maxLength={CHAT_LIMITS.turnChars}
              placeholder="Message Aperture Bot"
              aria-label="Message to Aperture Bot"
              className="max-h-40 min-h-10 border-0 bg-transparent focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="shrink-0 rounded-full"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <p className="mt-2 px-1 text-xs text-subtle">
            Uses your model key from Settings. Enter sends, Shift+Enter adds a line.
          </p>
        </div>
      </form>
    </section>
  );
}

function Reply({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {replyBlocks(text).map((block, i) =>
        block.type === "ul" || block.type === "ol" ? (
          (() => {
            const List = block.type === "ol" ? "ol" : "ul";
            return (
              <List
                key={i}
                start={block.type === "ol" ? block.start : undefined}
                className={cn("space-y-1 pl-5", block.type === "ol" ? "list-decimal" : "list-disc")}
              >
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          })()
        ) : block.type === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg border border-border bg-elevated p-3 font-mono text-xs"
          >
            {block.text}
          </pre>
        ) : block.type === "quote" ? (
          <blockquote key={i} className="border-l-2 border-border pl-3 text-muted">
            <Inline text={block.text} />
          </blockquote>
        ) : (
          <p key={i} className={block.type === "h" ? "font-medium" : undefined}>
            <Inline text={block.text} />
          </p>
        ),
      )}
    </div>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setI((n) => (n + 1) % THINKING.length), 2800);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <BotAvatar size="sm" working />
      <span key={i} className="thinking-phrase">
        {THINKING[i]}
      </span>
    </div>
  );
}
