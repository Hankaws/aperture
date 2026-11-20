import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUp,
  Brain,
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Textarea } from "@/components/ui/textarea";
import { Inline, type OpenRef } from "@/components/ide/md-preview";
import { CHAT_LIMITS, type ChatTurn } from "@/lib/bot/chat";
import { KEEP, loadChat, mergeChats, saveChat, type Entry } from "@/lib/bot/chat-saved";
import { getBearerToken } from "@/lib/auth/client";
import { loadPrivateChat, savePrivateChat } from "@/lib/bot/private-chat.api";
import { replyFollowUps } from "@/lib/bot/follow-ups";
import { joinDraft } from "@/lib/bot/voice";
import type { AgentImage } from "@/lib/agent/images";
import { turnWithNote } from "@/lib/bot/attachments";
import {
  EDITOR_LIMITS,
  EDITOR_SUGGESTIONS,
  peekLine,
  replyComposer,
  replyReads,
  type EditorPeek,
} from "@/lib/bot/editor-context";
import type { EditorBridge } from "@/lib/bot/summon-store";
import { AttachButton, AttachTray, SentAttachments } from "./attach-ui";
import { attachedNames, NOTHING_ATTACHED, useAttachments, type Attached } from "./use-attachments";
import {
  DEFAULT_BOT_NAME,
  FIRST_CHAT,
  greetingFor,
  localChatKey,
  titleOf,
  type ChatMeta,
  type MyBot,
} from "@/lib/bot/my-bot";
import { liveText, streamPrivateChat } from "@/lib/bot/private-chat-stream";
import {
  ACTIONS,
  PRIVATE_SUGGESTIONS,
  replyActions,
  replyBlocks,
  type ReplyAction,
} from "@/lib/bot/private-chat";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { FollowUps } from "./follow-ups";
import { MascotAvatar } from "./mascot";
import { Typing } from "./typing";
import { useTour } from "./use-tour";
import { MemoryOffer, MemoryPanel } from "./memory-ui";
import { useMemory } from "./use-memory";
import { useLocalBot } from "./use-my-bot";
import { useVoice } from "./use-voice";
import { VoiceButton } from "./voice-button";

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
  onReply,
  shown = true,
  chat = FIRST_CHAT,
  bot: given,
  page = false,
  firstName = null,
  onSaved,
  editor = null,
  peek = null,
  summoned = false,
}: {
  className?: string;
  /** Before the header's name: the team view's back button, on a phone. */
  lead?: ReactNode;
  /** At the header's end: a bubble's minimize button. */
  actions?: ReactNode;
  /** A reply's button was followed: a bubble puts its window away, to show the page. */
  onNavigate?: () => void;
  /** An answer came: a minimized bubble shows it, as a messenger does. */
  onReply?: (text: string) => void;
  /** On screen: false while its bubble is minimized, the chat carrying on unseen. */
  shown?: boolean;
  /** Which of the person's conversations (`my-bot.ts`); the first, the private chat as it was. */
  chat?: string;
  /** The person's own bot, named and with its face; left out, as this browser knows it; null: Aperture Bot. */
  bot?: MyBot | null;
  /** The chat page, as Grok's: a greeting and the box in the middle until something is asked. */
  page?: boolean;
  /** Whom the page greets. */
  firstName?: string | null;
  /** The conversation was kept: for the list of chats. */
  onSaved?: (meta: ChatMeta) => void;
  /** Summoned in the editor: what it shows goes with each message, and Composer takes changes. */
  editor?: EditorBridge | null;
  /** Which file and lines the editor shows, for the line under the box. */
  peek?: EditorPeek | null;
  /** Over a page (Ctrl/⌘+J): named, and a new chat in place of clearing this one. */
  summoned?: boolean;
}) {
  const known = useLocalBot();
  const bot = given === undefined ? known : given;
  const LOCAL_KEY = localChatKey(chat);
  const name = bot?.name ?? DEFAULT_BOT_NAME;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /** The answer as it is being written; null when none is. */
  const [live, setLive] = useState<string | null>(null);
  /** Stops the answer being written. */
  const stopper = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  /** What was typed before the microphone was pressed: what is said goes after it. */
  const typedBefore = useRef("");
  /** Pictures and text files for the next message (`attachments.ts`). */
  const att = useAttachments();
  /** The pictures each message of this visit was sent with, to show them in it. */
  const [sentPictures, setSentPictures] = useState<Record<string, AgentImage[]>>({});
  /** What the newest message was sent with: Regenerate sends it again. */
  const lastAttached = useRef<Attached>(NOTHING_ATTACHED);
  const voice = useVoice((spoken) => setDraft(joinDraft(typedBefore.current, spoken)));
  /** The conversation as it is now, for code that runs after an await. */
  const latest = useRef<Entry[]>([]);
  const memory = useMemory();
  /** Lines each reply offered to remember, by the reply's id: this visit only. */
  const [offers, setOffers] = useState<Record<string, string[]>>({});
  const [memoryOpen, setMemoryOpen] = useState(false);
  /** In the editor: whether what it shows goes with the next message. */
  const [seeing, setSeeing] = useState(true);
  /** The files it is reading before it answers; null when it is not. */
  const [reading, setReading] = useState<string[] | null>(null);
  const kept = memory.memories.filter((m) => m.status === "kept").length;

  const show = (next: Entry[]) => {
    latest.current = next;
    setEntries(next);
  };

  useEffect(() => {
    let cancel = false;
    const local = loadChat(LOCAL_KEY);
    const opened = new Set(local.map((e) => e.id));
    show(local);
    void loadPrivateChat({ data: { chat } })
      .then((kept) => {
        if (cancel || !kept.ok) return;
        if (kept.updatedAt === null) {
          // Never kept on the account: this browser's copy goes up.
          if (latest.current.length > 0)
            void savePrivateChat({ data: { chat, entries: latest.current.slice(-KEEP) } }).catch(
              () => {},
            );
          return;
        }
        // The account's copy wins (even an empty, cleared one); what was just said is kept.
        const merged = mergeChats(kept.entries, latest.current, opened);
        show(merged);
        saveChat(LOCAL_KEY, merged);
        if (merged.length > kept.entries.length)
          void savePrivateChat({ data: { chat, entries: merged } }).catch(() => {});
      })
      .catch(() => {
        // Offline: this browser's copy stands.
      });
    return () => {
      cancel = true;
    };
    // One conversation a mount: a page that shows another remounts it (a `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shown) end.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length, busy, live, shown]);

  // Leaving (a bubble closed for good, another page): an answer still being written stops.
  useEffect(() => () => stopper.current?.abort(), []);

  const update = (next: Entry[]) => {
    show(next);
    saveChat(LOCAL_KEY, next);
    void savePrivateChat({ data: { chat, entries: next.slice(-KEEP) } }).catch(() => {});
    const title = titleOf(next);
    if (title) onSaved?.({ id: chat, title, updatedAt: new Date().toISOString() });
  };

  async function send(text: string) {
    const said = text.trim();
    if ((!said && !att.any) || busy || att.busy) return;
    voice.cancel();
    const attached = att.take();
    const names = attachedNames(attached);
    const entry: Entry = {
      id: id(),
      role: "user",
      text: said,
      ...(names.length > 0 ? { files: names } : {}),
    };
    if (attached.images.length > 0)
      setSentPictures((now) => ({ ...now, [entry.id]: attached.images }));
    lastAttached.current = attached;
    const asked: Entry[] = [...latest.current, entry];
    update(asked);
    setDraft("");
    await ask(asked, attached);
  }

  /** The last answer, written again: the same question asked once more. */
  async function regenerate() {
    const last = latest.current.at(-1);
    if (busy || last?.role !== "assistant") return;
    const rest = latest.current.slice(0, -1);
    update(rest);
    await ask(rest, lastAttached.current);
  }

  const stop = useCallback(() => stopper.current?.abort(), []);

  /** Asks for the answer to the conversation as it stands, and shows it as it is written. */
  async function ask(conversation: Entry[], attached: Attached = NOTHING_ATTACHED) {
    setBusy(true);
    setLive("");
    const control = new AbortController();
    stopper.current = control;
    // The server reads the newest turns, each clipped: send no more than it takes.
    const turns: ChatTurn[] = conversation
      .filter((e) => !(e.role === "assistant" && e.error))
      .slice(-CHAT_LIMITS.turns)
      // Its suggestions of what to ask next were for the person, not the model.
      .map((e) => ({
        role: e.role,
        // What came with a message is said in a note: only the newest message carries it whole.
        text: (e.role === "assistant"
          ? replyFollowUps(e.text).text
          : turnWithNote(e.text, e.files)
        ).slice(0, CHAT_LIMITS.turnChars),
      }));
    let raw = "";
    // In the editor: what it shows now, with this message only.
    let context = editor && seeing ? await editor.context().catch(() => null) : null;
    /** The files it asked to read for this answer, as the project names them. */
    const asked: string[] = [];
    let out: Awaited<ReturnType<typeof streamPrivateChat>>;
    for (let round = 0; ; round++) {
      raw = "";
      out = await streamPrivateChat(turns, {
        onText: (piece) => {
          raw += piece;
          setLive(liveText(raw));
        },
        signal: control.signal,
        bearer: getBearerToken(),
        botName: bot?.name,
        images: attached.images,
        files: attached.files,
        ...(context ? { editor: context } : {}),
      });
      // It asked to read files: the editor sends them, and the same question goes again.
      const wants = out.ok && context && editor ? replyReads(out.reply).paths : [];
      const fresh = wants.filter((p) => !asked.includes(p));
      if (fresh.length === 0 || round >= EDITOR_LIMITS.readRounds || control.signal.aborted) break;
      asked.push(...fresh);
      setReading(fresh);
      setLive("");
      const next = await editor!.context(asked).catch(() => null);
      if (!next) break;
      context = next;
    }
    setReading(null);
    stopper.current = null;
    const looked = context?.extra.filter((f) => f.why === "asked").map((f) => f.path) ?? [];
    let reply: Entry | null;
    if (out.ok) {
      // Asked to read once too often: what it said, without the asking.
      const said = replyReads(out.reply).text || "I could not settle that from the files I read.";
      reply = {
        id: id(),
        role: "assistant",
        text: said,
        ...(looked.length > 0 ? { looked } : {}),
      };
      if (out.memories.length > 0) {
        memory.add(out.memories);
        const replyId = reply.id;
        setOffers((now) => ({ ...now, [replyId]: out.memories.map((m) => m.id) }));
      }
    } else if (out.stopped) {
      // Stopped: what was written so far stays, as it was on screen.
      const sofar = liveText(raw);
      reply = sofar ? { id: id(), role: "assistant", text: sofar } : null;
    } else reply = { id: id(), role: "assistant", text: out.error, error: true };
    setLive(null);
    setBusy(false);
    if (reply) {
      update([...latest.current, reply]);
      if (!reply.error) onReply?.(reply.text);
    }
    requestAnimationFrame(() => box.current?.focus());
  }

  const suggestions = (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {(editor ? EDITOR_SUGGESTIONS : PRIVATE_SUGGESTIONS).map((s) => (
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
  );
  /** The chat page with nothing asked yet: a greeting, and the box in the middle, as Grok's. */
  const empty = page && entries.length === 0 && !busy;
  const composer = (
    <form
      className={cn(empty ? "w-full" : "border-t border-border px-3 py-3")}
      onSubmit={(event) => {
        event.preventDefault();
        void send(draft);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        void att.attach([...event.dataTransfer.files]);
      }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={cn(
            "border border-border bg-elevated focus-within:ring-2 focus-within:ring-accent/40",
            empty ? "rounded-3xl p-1 shadow-lg" : "rounded-2xl",
          )}
        >
          <AttachTray att={att} />
          <div className={cn("flex items-end gap-2", empty ? "p-1.5" : "p-1.5")}>
            <AttachButton att={att} disabled={busy} />
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
              onPaste={(event) => {
                const pasted = [...event.clipboardData.files];
                if (pasted.length === 0) return;
                event.preventDefault();
                void att.attach(pasted);
              }}
              rows={1}
              maxLength={CHAT_LIMITS.turnChars}
              placeholder={
                voice.listening ? "Listening…" : page ? `Ask ${name} anything` : `Message ${name}`
              }
              aria-label={`Message to ${name}`}
              className={cn(
                "max-h-40 border-0 bg-transparent focus-visible:ring-0",
                empty ? "min-h-14 text-base" : "min-h-10",
              )}
            />
            <VoiceButton
              voice={voice}
              disabled={busy}
              onStart={() => {
                typedBefore.current = draft;
              }}
            />
            {busy ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={stop}
                aria-label="Stop the answer"
                title="Stop"
                className="shrink-0 rounded-full"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={att.busy || (!draft.trim() && !att.any)}
                aria-label="Send"
                className="shrink-0 rounded-full"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
        {att.error || voice.error ? (
          <p className="mt-2 px-1 text-xs text-danger" role="alert">
            {att.error ?? voice.error}
          </p>
        ) : editor ? (
          <button
            type="button"
            onClick={() => setSeeing((v) => !v)}
            aria-pressed={seeing}
            title={
              seeing
                ? "The open file, your selection and its problems go with each message. Click to stop sending them."
                : "Click to send the open file, your selection and its problems with each message."
            }
            className="mt-1.5 inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md px-1 text-xs text-subtle hover:text-fg"
          >
            {seeing ? (
              <Eye className="size-3.5 shrink-0 text-accent" aria-hidden />
            ) : (
              <EyeOff className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="truncate">
              {seeing
                ? peek
                  ? peekLine(peek)
                  : "Sees what the editor has open"
                : "Not looking at the editor"}
            </span>
          </button>
        ) : (
          <p className="mt-2 px-1 text-xs text-subtle">
            Uses your model key from Settings. Enter sends, Shift+Enter adds a line.
          </p>
        )}
      </div>
    </form>
  );

  return (
    <section
      className={cn("relative flex h-full min-h-0 flex-col", className)}
      aria-label={`Private chat with ${name}`}
    >
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {lead}
          <Face bot={bot} size="sm" working={busy} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {page || bot || summoned ? name : "Private chat"}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-subtle">
              <Lock className="size-3 shrink-0" aria-hidden />
              {summoned
                ? "Private. Nothing is posted anywhere."
                : "Just you and the bot. Nothing is posted anywhere."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {memory.available && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMemoryOpen((v) => !v)}
              aria-pressed={memoryOpen}
              aria-label={`Memory: ${kept} ${kept === 1 ? "thing" : "things"} remembered`}
              title={`What ${name} remembers about you`}
            >
              <Brain className="size-4" />
              {kept > 0 && <span className="text-xs tabular-nums">{kept}</span>}
            </Button>
          )}
          {/* On the chat page, a chat is deleted from the list of chats instead. */}
          {entries.length > 0 && !page && !summoned && (
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

      {memoryOpen && <MemoryPanel store={memory} onClose={() => setMemoryOpen(false)} />}

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5">
          {/* In the editor, the code comes first: the editor says what is missing itself. */}
          {!empty && !editor && <WelcomeTour onNavigate={onNavigate} />}
          {empty && (
            <div className="flex min-h-[min(60dvh,32rem)] flex-col items-center justify-center py-6 text-center">
              <Face bot={bot} size="xl" />
              <h1 className="mt-5 text-2xl font-medium tracking-tight text-balance sm:text-3xl">
                {greetingFor(new Date().getHours())}
                {firstName ? `, ${firstName}` : ""}.
              </h1>
              <p className="mt-1.5 text-pretty text-muted">
                I&apos;m {name}. What&apos;s on your mind?
              </p>
              <div className="mt-7 w-full max-w-2xl text-left">{composer}</div>
              {suggestions}
              {/* Someone new: getting set up, under the greeting rather than over it. */}
              <div className="mt-10 w-full max-w-2xl text-left">
                <WelcomeTour onNavigate={onNavigate} />
              </div>
            </div>
          )}
          {entries.length === 0 && !busy && !page && (
            <div className="flex flex-col items-center px-2 py-6 text-center">
              <Face bot={bot} size="lg" />
              <p className="mt-4 text-lg font-medium text-balance">
                {editor ? "Ask me about your code." : "Ask me anything."}
              </p>
              <p className="mt-1 max-w-md text-sm text-pretty text-muted">
                {editor
                  ? "I see the file you have open, what you selected and its problems. When you want a change, I hand it to Composer, which checks it before you Apply."
                  : "Questions, writing, planning, code. This chat is yours alone: it belongs to no repository, and nothing here reaches GitHub."}
              </p>
              {suggestions}
            </div>
          )}

          {entries.map((entry, at) =>
            entry.role === "user" ? (
              <div key={entry.id} className="flex flex-col items-end gap-1.5">
                <SentAttachments pictures={sentPictures[entry.id]} names={entry.files} />
                {entry.text && (
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {entry.text}
                  </p>
                )}
              </div>
            ) : (
              <div key={entry.id} className="flex gap-3">
                <Face bot={bot} size="sm" className="mt-0.5" />
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
                    <div className="space-y-2.5">
                      {entry.looked && entry.looked.length > 0 && (
                        <p className="truncate text-xs text-subtle" title={entry.looked.join("\n")}>
                          Read {entry.looked.join(" · ")}
                        </p>
                      )}
                      <Reply
                        text={entry.text}
                        onNavigate={onNavigate}
                        onComposer={editor?.toComposer}
                        openRef={editor?.open}
                      />
                      {offers[entry.id]?.map((offerId) => (
                        <MemoryOffer key={offerId} id={offerId} store={memory} />
                      ))}
                      <ReplyTools
                        text={entry.text}
                        onRegenerate={
                          at === entries.length - 1 && !busy ? () => void regenerate() : undefined
                        }
                      />
                      {at === entries.length - 1 && !busy && (
                        <FollowUps
                          asks={replyFollowUps(entry.text).asks}
                          onAsk={(ask) => void send(ask)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {busy &&
            (live && !reading ? (
              <div className="flex gap-3">
                <Face bot={bot} size="sm" working className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <Reply text={live} onNavigate={onNavigate} writing />
                </div>
              </div>
            ) : (
              <Typing
                name={name}
                avatar={<Face bot={bot} size="sm" working />}
                phrases={
                  reading
                    ? [`Reading ${reading.map((p) => p.split("/").pop()).join(", ")}`]
                    : THINKING
                }
              />
            ))}
          <div ref={end} />
        </div>
      </div>

      {!empty && composer}
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

function Reply({
  text,
  onNavigate,
  onComposer,
  openRef,
  writing = false,
}: {
  text: string;
  onNavigate?: () => void;
  /** In the editor: a change the reply proposes goes to Composer. */
  onComposer?: (instruction: string) => void;
  /** In the editor: the places in the code it names open there. */
  openRef?: OpenRef;
  /** Still being written: a caret at its end, and its buttons once it is done. */
  writing?: boolean;
}) {
  const { text: said, instruction } = replyComposer(replyReads(replyFollowUps(text).text).text);
  const { text: shown, actions } = replyActions(said);
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]",
        writing && "reply-writing",
      )}
    >
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
                    <Inline text={item} openRef={openRef} />
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
            <Inline text={block.text} openRef={openRef} />
          </blockquote>
        ) : (
          <p key={i} className={block.type === "h" ? "font-medium" : undefined}>
            <Inline text={block.text} openRef={openRef} />
          </p>
        ),
      )}
      {!writing && instruction && onComposer && (
        <ComposerHandoff instruction={instruction} onComposer={onComposer} />
      )}
      {!writing && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.map((action) => (
            <ActionLink key={action.id} action={action} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A change the reply proposes, for Composer: what it will be asked, and the
 * button that asks it. Composer makes it and checks it; Apply is still theirs.
 */
function ComposerHandoff({
  instruction,
  onComposer,
}: {
  instruction: string;
  onComposer: (instruction: string) => void;
}) {
  const [sent, setSent] = useState(false);
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
      <p className="text-xs text-muted">
        <span className="font-medium text-fg">For Composer:</span> {instruction}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            onComposer(instruction);
            setSent(true);
          }}
        >
          <Wand2 className="size-3.5" aria-hidden />
          {sent ? "Ask Composer again" : "Have Composer do it"}
        </Button>
        <span className="text-xs text-subtle">
          {sent
            ? "Sent. Check it in Composer, then Apply."
            : "It checks the change before you Apply."}
        </span>
      </div>
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

/** Under an answer: copy it, and for the last one, have it written again. */
function ReplyTools({ text, onRegenerate }: { text: string; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const tool =
    "inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-xs text-subtle hover:bg-elevated hover:text-fg";
  return (
    <div className="-ml-1.5 flex items-center gap-0.5">
      <button
        type="button"
        className={tool}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(replyActions(replyComposer(replyFollowUps(text).text).text).text)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        aria-label={copied ? "Copied" : "Copy the answer"}
        title="Copy"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        {copied && <span>Copied</span>}
      </button>
      {onRegenerate && (
        <button
          type="button"
          className={tool}
          onClick={onRegenerate}
          aria-label="Write the answer again"
          title="Regenerate"
        >
          <RefreshCw className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** The bot's face: the one its person chose, or Aperture Bot's own. */
function Face({
  bot,
  size,
  working = false,
  className,
}: {
  bot: MyBot | null;
  size: "sm" | "lg" | "xl";
  working?: boolean;
  className?: string;
}) {
  if (!bot)
    return <BotAvatar size={size === "sm" ? "sm" : "lg"} working={working} className={className} />;
  return (
    <MascotAvatar
      mascot={bot.mascot}
      mood={working ? "thinking" : "idle"}
      size={size === "sm" ? 28 : size === "lg" ? 56 : 80}
      label={bot.name}
      className={className}
    />
  );
}
