import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Circle, CircleDot, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LIMIT, planEdits } from "@/lib/workspace/plan";
import type { PlanEntry } from "@/lib/workspace/types";

/**
 * The plan Composer posted. While it waits for Build it, and `onChange` is
 * given, every step can be reworded, moved or removed, and steps added: the
 * build follows the plan as it stands when Build it is clicked.
 */
export function PlanCard({
  entries,
  awaitingBuild = false,
  onChange,
}: {
  entries: PlanEntry[];
  awaitingBuild?: boolean;
  onChange?: (entries: PlanEntry[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (entries.length === 0) return null;
  const done = entries.filter((e) => e.status === "completed").length;
  const live = entries.some((e) => e.status === "in_progress");
  const change = awaitingBuild ? onChange : undefined;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1">
        <p className="text-[0.65rem] tracking-[0.14em] text-subtle uppercase">Plan</p>
        <p className="text-[11px] text-subtle">
          {done}/{entries.length}
          {awaitingBuild ? (change ? " · waiting · click a step to edit" : " · waiting") : live ? " · running" : done === entries.length ? " · done" : ""}
        </p>
      </div>
      <ol className="py-1" aria-label="Plan steps">
        {entries.map((entry, i) => (
          <li key={entry.id} className="flex items-start gap-2 px-3 py-1">
            <StatusIcon status={entry.status} />
            <span className="mt-px font-mono text-[10px] leading-snug text-subtle">{String(i + 1).padStart(2, "0")}</span>
            {change && editing === entry.id ? (
              <StepInput
                label={`Step ${i + 1}`}
                initial={entry.content}
                onDone={(text) => {
                  setEditing(null);
                  if (text !== null) change(planEdits.rename(entries, entry.id, text));
                }}
              />
            ) : change ? (
              <button
                type="button"
                aria-label={`Edit step ${i + 1}: ${entry.content}`}
                className="min-w-0 flex-1 cursor-text rounded-sm text-left text-[12px] leading-snug text-fg hover:text-accent"
                onClick={() => setEditing(entry.id)}
              >
                {entry.content}
              </button>
            ) : (
              <span
                className={cn(
                  "min-w-0 flex-1 text-[12px] leading-snug",
                  entry.status === "completed" ? "text-subtle line-through" : "text-fg",
                  entry.status === "in_progress" && "text-accent",
                )}
              >
                {entry.content}
              </span>
            )}
            {change && editing !== entry.id && (
              <span className="-my-0.5 flex shrink-0 items-center gap-0.5">
                <StepButton
                  label={`Move step ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => change(planEdits.move(entries, entry.id, -1))}
                >
                  <ArrowUp className="size-3" />
                </StepButton>
                <StepButton
                  label={`Move step ${i + 1} down`}
                  disabled={i === entries.length - 1}
                  onClick={() => change(planEdits.move(entries, entry.id, 1))}
                >
                  <ArrowDown className="size-3" />
                </StepButton>
                <StepButton
                  label={`Remove step ${i + 1}`}
                  disabled={entries.length <= 1}
                  onClick={() => change(planEdits.remove(entries, entry.id))}
                >
                  <X className="size-3" />
                </StepButton>
              </span>
            )}
          </li>
        ))}
      </ol>
      {change && (
        <div className="border-t border-border px-3 py-1.5">
          {adding ? (
            <div className="flex items-start gap-2">
              <Plus className="mt-1 size-3.5 shrink-0 text-subtle" aria-hidden />
              <StepInput
                label="New step"
                initial=""
                onDone={(text) => {
                  setAdding(false);
                  if (text !== null) change(planEdits.add(entries, text));
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              disabled={entries.length >= PLAN_LIMIT.steps}
              className="tap flex items-center gap-1.5 text-[11px] text-muted hover:text-fg disabled:cursor-default disabled:opacity-50"
              title={entries.length >= PLAN_LIMIT.steps ? `A plan has at most ${PLAN_LIMIT.steps} steps.` : undefined}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3" aria-hidden />
              Add a step
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Enter, or leaving the field, keeps the text; Escape leaves the step as it was. */
function StepInput({
  label,
  initial,
  onDone,
}: {
  label: string;
  initial: string;
  onDone: (text: string | null) => void;
}) {
  const [text, setText] = useState(initial);
  const finished = useRef(false);
  const finish = (value: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  };
  return (
    <input
      autoFocus
      aria-label={label}
      value={text}
      maxLength={PLAN_LIMIT.chars}
      placeholder="Describe the step"
      className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[12px] leading-snug text-fg outline-none focus:border-accent"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          finish(text);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      }}
      onBlur={() => finish(text === initial ? null : text)}
    />
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-5 place-items-center rounded text-subtle hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-30 pointer-coarse:size-8"
    >
      {children}
    </button>
  );
}

function StatusIcon({ status }: { status: PlanEntry["status"] }) {
  if (status === "completed") {
    return <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />;
  }
  if (status === "in_progress") {
    return <CircleDot className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />;
  }
  return <Circle className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />;
}
