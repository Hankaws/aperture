import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RefactorAsk } from "@/lib/editor/ts-intel";
import { useIdeUi } from "@/lib/ui-store";
import { applyRefactor } from "@/lib/workspace/quick-fix";
import { useWorkspace } from "@/lib/workspace/store";

/** The line and column of `offset` in `text`, and the length of the name there, for the editor to select. */
function nameAt(text: string, offset: number) {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const col = offset - (before.lastIndexOf("\n") + 1);
  const length = /^[\w$]+/.exec(text.slice(offset))?.[0].length ?? 0;
  return { line, col, length };
}

/**
 * Ctrl/⌘+Shift+R's menu: TypeScript's refactors for the selection, such as
 * "Extract to function in module scope". Arrow keys and Enter, or a click;
 * Escape closes it. A refactor is written with one Undo, and a name it made
 * up is selected, ready for F2.
 */
export function RefactorMenu({ ask, onClose }: { ask: RefactorAsk; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => list.current?.focus(), []);

  async function run(index: number) {
    const action = ask.actions[index];
    if (!action || busy) return;
    setBusy(true);
    const { tsRefactorEdits } = await import("@/lib/workspace/tsc");
    const text = ask.basis[ask.path] ?? "";
    const edit = await tsRefactorEdits(ask.basis, ask.path, text, ask.start, ask.end, action);
    setBusy(false);
    if (!edit) {
      toast.info("TypeScript could not do that here any more. Press Ctrl/⌘+Shift+R again.");
      return onClose();
    }
    const rename = applyRefactor(action.description, edit, ask.basis);
    onClose();
    if (!rename) return;
    const written = useWorkspace.getState().files[rename.path];
    if (written === undefined) return;
    useWorkspace.getState().openFile(rename.path);
    useIdeUi.getState().setReveal({ path: rename.path, ...nameAt(written, rename.offset) });
  }

  // Under the selection, or over it when the bottom of the window is too near: never on top of it.
  const left = Math.max(8, Math.min(ask.at?.left ?? 80, window.innerWidth - 368));
  const below = ask.at ? window.innerHeight - ask.at.bottom : window.innerHeight;
  const style =
    ask.at && below < 300
      ? { left, bottom: window.innerHeight - ask.at.top + 4 }
      : { left, top: (ask.at?.bottom ?? 120) + 4 };

  return (
    <div
      className="fixed z-50 w-[22rem] rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-float)]"
      style={style}
    >
      <p className="px-2 pt-1 pb-1.5 text-[11px] text-subtle">
        {busy ? "Working it out…" : "Refactor · Enter to apply, Esc to close"}
      </p>
      <ul
        ref={list}
        role="menu"
        aria-label="Refactor"
        tabIndex={-1}
        className="aperture-scroll max-h-64 overflow-y-auto outline-none"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % ask.actions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + ask.actions.length) % ask.actions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            void run(active);
          }
        }}
      >
        {ask.actions.map((action, i) => (
          <li key={`${action.refactor}:${action.action}`} role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-current={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void run(i)}
              className={
                i === active
                  ? "w-full rounded px-2 py-1.5 text-left text-[12px] text-fg bg-elevated"
                  : "w-full rounded px-2 py-1.5 text-left text-[12px] text-muted"
              }
            >
              {action.description}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
