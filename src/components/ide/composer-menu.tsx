import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AtSign,
  Check,
  ChevronDown,
  Clock,
  ListTodo,
  MessageSquare,
  Paperclip,
  Plus,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** How Composer takes the next message: a question, a plan to build, or an edit straight away. */
export type ComposerMode = "ask" | "plan" | "edit";

const MODES: Array<{ id: ComposerMode; label: string; hint: string; icon: LucideIcon }> = [
  {
    id: "ask",
    label: "Ask",
    hint: "Questions about the code. Nothing is edited.",
    icon: MessageSquare,
  },
  {
    id: "plan",
    label: "Plan",
    hint: "Composer posts a plan and waits for Build it.",
    icon: ListTodo,
  },
  {
    id: "edit",
    label: "Edit",
    hint: "Composer edits straight away. Nothing lands before Apply.",
    icon: Sparkles,
  },
];

/** A small menu that opens above its button, inside the box, and closes on a click away or Escape. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);
  return { open, setOpen, box };
}

const PANEL =
  "absolute bottom-full z-30 mb-1.5 rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow-float)]";
const ROW =
  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The mode, inside the box as Grok's is: Ask, Plan (plan first, then Build it)
 * or Edit (straight away). One choice in place of the tabs and the switch.
 */
export function ModeMenu({
  mode,
  onPick,
  disabled,
}: {
  mode: ComposerMode;
  onPick: (mode: ComposerMode) => void;
  disabled?: boolean;
}) {
  const { open, setOpen, box } = useMenu();
  const current = MODES.find((m) => m.id === mode)!;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Mode: ${current.label}`}
        title={current.hint}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-[11px] font-medium text-muted hover:text-fg disabled:opacity-50"
      >
        <current.icon className="size-3" aria-hidden />
        {current.label}
        <ChevronDown className="size-3 text-subtle" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Mode" className={cn(PANEL, "left-0 w-64")}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitemradio"
              aria-checked={m.id === mode}
              onClick={() => {
                onPick(m.id);
                setOpen(false);
              }}
              className={ROW}
            >
              <m.icon className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-fg">{m.label}</span>
                <span className="block text-subtle">{m.hint}</span>
              </span>
              {m.id === mode && (
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Everything else the box can take, behind one "+" as Grok's: context with @,
 * files and screenshots, a background run, and below, the crew and the quick
 * actions on the selection.
 */
export function PlusMenu({
  onContext,
  onAttach,
  onBackground,
  backgroundTitle,
  onBestOf,
  children,
}: {
  onContext: () => void;
  onAttach: () => void;
  /** Runs the message in the background; left out when it cannot. */
  onBackground?: () => void;
  backgroundTitle?: string;
  /** Runs the message three times in the background and lets the checks pick; left out when it cannot. */
  onBestOf?: () => void;
  /** More, under the actions: the crew, the quick actions. */
  children?: ReactNode;
}) {
  const { open, setOpen, box } = useMenu();
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add context, files and more"
        title="Add context, files and more"
        className="grid size-7 place-items-center rounded-full text-subtle hover:bg-elevated hover:text-fg"
      >
        <Plus className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Add"
          className={cn(PANEL, "left-0 w-[min(20rem,calc(100vw-2rem))]")}
        >
          <button type="button" role="menuitem" onClick={act(onContext)} className={ROW}>
            <AtSign className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
            <span>
              <span className="block font-medium text-fg">Add context</span>
              <span className="block text-subtle">A file or symbol, as typing @ does</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={act(onAttach)} className={ROW}>
            <Paperclip className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
            <span>
              <span className="block font-medium text-fg">Add files or screenshots</span>
              <span className="block text-subtle">Or paste or drop them in the box</span>
            </span>
          </button>
          {onBackground && (
            <button type="button" role="menuitem" onClick={act(onBackground)} className={ROW}>
              <Clock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
              <span>
                <span className="block font-medium text-fg">Run in the background</span>
                <span className="block text-subtle">{backgroundTitle}</span>
              </span>
            </button>
          )}
          {onBestOf && (
            <button type="button" role="menuitem" onClick={act(onBestOf)} className={ROW}>
              <Trophy className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
              <span>
                <span className="block font-medium text-fg">Best of 3</span>
                <span className="block text-subtle">
                  Three attempts in the background; the checks pick the best
                </span>
              </span>
            </button>
          )}
          {children && <div className="mt-1 space-y-2 border-t border-border p-2">{children}</div>}
        </div>
      )}
    </div>
  );
}
