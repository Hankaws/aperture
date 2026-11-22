import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import { receiptFor, runFor, type Risk } from "@/lib/workspace/receipt";
import type { ProposedEdit } from "@/lib/workspace/types";

const DOT: Record<Risk, string> = { high: "bg-danger", look: "bg-warn", low: "bg-subtle" };
const SAID: Record<Risk, string> = { high: "Look carefully", look: "Worth a look", low: "Small" };
/** Files shown before "Show all". */
const FIRST = 5;

/**
 * The review guide: the staged change's receipt, in the order to read it.
 * Where to start and why, each file with the plan step that made it and what
 * makes it worth a look, and the files the agent read without changing. Built
 * from the run itself (receipt.ts): no model.
 */
export function ReviewGuide({
  edits,
  onOpen,
}: {
  edits: ProposedEdit[];
  onOpen: (path: string, detail?: string) => void;
}) {
  const messages = useWorkspace((s) => s.messages);
  const [all, setAll] = useState(false);
  const receipt = useMemo(() => {
    const run = runFor(messages, edits);
    return run ? receiptFor({ ...run, edits }) : receiptFor({ request: "", traces: [], edits });
  }, [messages, edits]);
  if (receipt.files.length === 0) return null;
  const shown = all ? receipt.files : receipt.files.slice(0, FIRST);
  return (
    <section
      aria-label="Review guide"
      className="mt-1.5 rounded-md border border-border px-2 py-1.5"
      data-review-guide
    >
      <p className="text-[12px] font-medium text-fg">Review guide</p>
      <p className="mt-0.5 text-[11px] text-muted" data-review-start>
        {receipt.lookAt}
      </p>
      <ol className="mt-1.5 space-y-1">
        {shown.map((file) => (
          <li
            key={file.path}
            className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-x-2"
            data-review-file={file.risk}
          >
            <span
              className={cn("mt-1.5 size-1.5 rounded-full", DOT[file.risk])}
              title={SAID[file.risk]}
              aria-label={SAID[file.risk]}
            />
            <span className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(file.path)}
                className="max-w-full truncate font-mono text-[11px] text-fg underline-offset-2 hover:underline"
              >
                {file.path}
              </button>
              <span className="ml-1.5 text-[11px] text-subtle tabular-nums">
                {file.deleted ? "deleted" : `+${file.added} −${file.removed}`}
              </span>
              {(file.step || file.change) && (
                <span className="block text-[11px] text-muted">
                  {file.step ? <span className="text-subtle">Plan: </span> : null}
                  {(file.step ?? file.change).replace(/`/g, "")}
                </span>
              )}
              {file.reasons.length > 0 && (
                <span
                  className={cn(
                    "block text-[11px]",
                    file.risk === "high" ? "text-danger" : "text-warn",
                  )}
                >
                  {file.reasons.join(" · ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {receipt.files.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll((on) => !on)}
          className="mt-1 h-7 text-[11px] text-subtle underline-offset-2 hover:text-fg hover:underline"
        >
          {all ? "Show fewer" : `Show all ${receipt.files.length} files`}
        </button>
      )}
      {receipt.read.length > 0 && (
        <p className="mt-1 text-[11px] text-subtle" data-review-read>
          Read first, not changed:{" "}
          {receipt.read.slice(0, 6).map((path, i) => (
            <span key={path}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => onOpen(path)}
                className="font-mono hover:text-fg hover:underline"
              >
                {path}
              </button>
            </span>
          ))}
          {receipt.read.length > 6 && ` and ${receipt.read.length - 6} more`}
        </p>
      )}
    </section>
  );
}
