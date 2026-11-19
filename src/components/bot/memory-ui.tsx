import { useState } from "react";
import { Brain, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Memory } from "@/lib/bot/memory";
import { cn } from "@/lib/utils";
import type { MemoryStore } from "./use-memory";

/**
 * Under a reply that offered to remember something: the line, and the
 * person's choice. Keep, Edit (then keep), or Don't; once decided it says so.
 */
export function MemoryOffer({ id, store }: { id: string; store: MemoryStore }) {
  const memory = store.memories.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory?.text ?? "");
  const [busy, setBusy] = useState(false);
  if (!memory) return null;
  if (memory.status === "kept")
    return (
      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <Check className="size-3.5 text-ok" aria-hidden />
        Remembered: {memory.text}
      </p>
    );
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    await task();
    setBusy(false);
  };
  return (
    <div
      role="group"
      aria-label="Remember this?"
      className="rounded-xl border border-border bg-elevated/40 px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Brain className="size-3.5" aria-hidden />
        Remember this?
      </p>
      {editing ? (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (await store.keep(memory.id, text)) setEditing(false);
            });
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            aria-label="What to remember"
            className="h-9"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !text.trim()}>
              Keep
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-1 text-sm text-pretty">{memory.text}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void run(() => store.keep(memory.id))}>
              Keep
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setText(memory.text);
                setEditing(true);
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => store.forget(memory.id))}
            >
              Don&apos;t
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Everything Aperture Bot remembers, as Grok Bot's knowledge is kept: what
 * waits for the person's yes, and what they kept, each to edit or forget;
 * and a way to forget it all.
 */
export function MemoryPanel({ store, onClose }: { store: MemoryStore; onClose: () => void }) {
  const waiting = store.memories.filter((m) => m.status === "pending");
  const kept = store.memories.filter((m) => m.status === "kept");
  const [sure, setSure] = useState(false);
  return (
    <section
      aria-label="Memory"
      className="absolute inset-x-0 top-14 bottom-0 z-10 flex flex-col overflow-hidden bg-surface"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Brain className="size-4" aria-hidden />
            Memory
          </p>
          <p className="text-xs text-pretty text-subtle">
            What Aperture Bot knows about you. It uses only what you keep.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close memory">
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {store.error && <p className="text-sm text-danger">{store.error}</p>}
        {waiting.length > 0 && (
          <div>
            <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
              Waiting for you
            </h3>
            <ul className="mt-2 space-y-2">
              {waiting.map((m) => (
                <li key={m.id}>
                  <MemoryOffer id={m.id} store={store} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
            Remembered · {kept.length}
          </h3>
          {kept.length === 0 ? (
            <p className="mt-2 text-sm text-pretty text-muted">
              Nothing yet. Tell Aperture Bot something worth remembering, such as how you like to
              work, and it will ask to keep it.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {kept.map((m) => (
                <KeptLine key={m.id} memory={m} store={store} />
              ))}
            </ul>
          )}
        </div>
      </div>
      {store.memories.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          {sure ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Forget everything Aperture Bot knows about you?</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setSure(false);
                  void store.forgetAll();
                }}
              >
                Forget all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSure(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setSure(true)}>
              Forget everything
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function KeptLine({ memory, store }: { memory: Memory; store: MemoryStore }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.text);
  return (
    <li className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-elevated/60">
      {editing ? (
        <form
          className="flex w-full flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void store.keep(memory.id, text).then((ok) => ok && setEditing(false));
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            aria-label="Edit what is remembered"
            className="h-9"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!text.trim()}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-sm text-pretty [overflow-wrap:anywhere]">
            {memory.text}
          </span>
          <span
            className={cn(
              "flex shrink-0 gap-0.5 transition-opacity",
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setText(memory.text);
                setEditing(true);
              }}
              aria-label={`Edit: ${memory.text}`}
              className="grid size-7 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void store.forget(memory.id)}
              aria-label={`Forget: ${memory.text}`}
              className="grid size-7 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-danger"
            >
              <X className="size-3.5" />
            </button>
          </span>
        </>
      )}
    </li>
  );
}
