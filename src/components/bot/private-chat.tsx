import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUp, Check, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Textarea } from "@/components/ui/textarea";
import { Inline } from "@/components/ide/md-preview";
import { CHAT_LIMITS, type ChatTurn } from "@/lib/bot/chat";
import { KEEP, loadChat, mergeChats, saveChat, type Entry } from "@/lib/bot/chat-saved";
import { loadPrivateChat, privateChat, savePrivateChat } from "@/lib/bot/private-chat.api";
import {
  ACTIONS,
  PRIVATE_SUGGESTIONS,
  replyActions,
  replyBlocks,
  type ReplyAction,
} from "@/lib/bot/private-chat";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { useTour } from "./use-tour";

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
  actions,
  onNavigate,
}: {
  className?: string;
  /** Before the header's name: the team view's back button, on a phone. */
  lead?: ReactNode;
  /** At the header's end: a bubble's minimize button. */
  actions?: ReactNode;
  /** A reply's button was followed: a bubble puts its window away, to show the page. */
  onNavigate?: () => void;
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
        <div className="flex shrink-0 items-center gap-1">
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
          {actions}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5">
          <WelcomeTour onNavigate={onNavigate} />
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
                      // A whole question is asked as it is; the rest are a start to finish.
                      if (s.endsWith("?")) {
                        void send(s);
                        return;
                      }
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
                    <Reply text={entry.text} onNavigate={onNavigate} />
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

/**
 * Getting someone new set up (`tour.ts`): three steps, each with its button,
 * ticking themselves off from the account. It goes when all are done, or when
 * the person hides it.
 */
function WelcomeTour({ onNavigate }: { onNavigate?: () => void }) {
  const tour = useTour();
  if (!tour.show || !tour.progress) return null;
  const { done, total, next } = tour.progress;
  return (
    <section
      aria-label="Get set up"
      className="rounded-2xl border border-border bg-elevated/40 p-3.5 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Get set up{" "}
          <span className="font-normal text-subtle">
            · {done} of {total} done
          </span>
        </p>
        <button
          type="button"
          onClick={tour.hide}
          className="min-h-6 px-1 text-xs text-subtle hover:text-fg"
        >
          Hide
        </button>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Steps done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <ol className="mt-3 space-y-3">
        {tour.steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium",
                step.done ? "bg-ok/15 text-ok" : "bg-elevated text-muted ring-1 ring-border",
              )}
              aria-hidden
            >
              {step.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", step.done && "text-subtle line-through")}>
                {step.title}
                {step.done && <span className="sr-only"> (done)</span>}
              </p>
              {!step.done && <p className="text-xs text-pretty text-muted">{step.why}</p>}
              {!step.done && (
                <div className="mt-2">
                  <ActionLink
                    action={{ id: step.id, label: ACTIONS[step.id] }}
                    onNavigate={onNavigate}
                    primary={step.id === next?.id}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Reply({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const { text: shown, actions } = replyActions(text);
  return (
    <div className="space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {replyBlocks(shown).map((block, i) =>
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
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.map((action) => (
            <ActionLink key={action.id} action={action} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A place on the site a reply points to, as a button that goes there. */
function ActionLink({
  action,
  onNavigate,
  primary = false,
}: {
  action: ReplyAction;
  onNavigate?: () => void;
  /** The one to press next: a solid button. */
  primary?: boolean;
}) {
  const className = cn(
    buttonVariants({ variant: primary ? "default" : "outline", size: "sm" }),
    "gap-1.5",
  );
  const label = (
    <>
      {action.label}
      <ArrowRight className="size-3.5" aria-hidden />
    </>
  );
  const props = { className, onClick: onNavigate };
  switch (action.id) {
    case "model-key":
      return (
        <Link to="/settings" search={{ tab: "models" }} {...props}>
          {label}
        </Link>
      );
    case "github":
      return (
        <Link to="/settings" search={{ tab: "plan" }} {...props}>
          {label}
        </Link>
      );
    case "new-bot":
      return (
        <Link to="/bot" {...props}>
          {label}
        </Link>
      );
    case "editor":
      return (
        <Link to="/app" {...props}>
          {label}
        </Link>
      );
    case "check":
      return (
        <Link to="/bot" search={{ tab: "check" }} {...props}>
          {label}
        </Link>
      );
    case "pricing":
      return (
        <Link to="/pricing" {...props}>
          {label}
        </Link>
      );
  }
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
