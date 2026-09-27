import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, LoaderCircle, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { changeChecks, renderEntry, type CheckRow, type RenderResult } from "@/lib/workspace/checks";
import { renderProbeDocument } from "@/lib/workspace/design-mode";
import { mergeEdits } from "@/lib/workspace/preview-check";
import type { ProposedEdit, VerifyReport } from "@/lib/workspace/types";

/** Long enough for a page's own scripts to settle; a page slower than this is a finding. */
const RENDER_TIMEOUT_MS = 5000;

/**
 * Renders the staged version of the page in a hidden, script-sandboxed frame
 * and reports what happened. The live preview shows applied files, so it
 * cannot say whether the change about to be applied renders.
 */
function useRenderCheck(files: Record<string, string>, edits: ProposedEdit[]) {
  const runScripts = useIdeUi((s) => s.runPreviewScripts);
  const doc = useMemo(() => {
    const entry = renderEntry(files, edits, { runScripts });
    return entry ? renderProbeDocument(mergeEdits(files, edits), entry, { runScripts }) : null;
  }, [files, edits, runScripts]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [settled, setSettled] = useState<{ doc: string; result: RenderResult } | null>(null);

  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => setSettled({ doc, result: { state: "timeout" } }), RENDER_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as { type?: string; errors?: unknown; blank?: unknown };
      if (data?.type !== "aperture-render-probe") return;
      window.clearTimeout(timer);
      const errors = Array.isArray(data.errors) ? data.errors.map(String).slice(0, 8) : [];
      setSettled({ doc: doc!, result: { state: "done", errors, blank: data.blank === true } });
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [doc]);

  const result: RenderResult = !doc ? null : settled?.doc === doc ? settled.result : { state: "pending" };
  const frame = doc ? (
    <iframe
      ref={frameRef}
      title="Render check"
      aria-hidden
      tabIndex={-1}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={doc}
      className="pointer-events-none fixed top-0 -left-[10000px] h-[768px] w-[1024px] border-0 opacity-0"
    />
  ) : null;
  return { result, frame };
}

const ICON = { pass: Check, fail: X, skip: Minus, running: LoaderCircle } as const;

function Chip({ row, onOpen }: { row: CheckRow; onOpen: (path: string) => void }) {
  const Icon = ICON[row.status] ?? Circle;
  const openable = row.status === "fail" && row.path;
  const status = { pass: "passed", fail: "failed", skip: "not run", running: "running" }[row.status];
  return (
    <li>
      <button
        type="button"
        disabled={!openable}
        title={row.detail}
        aria-label={`${row.label}: ${status}. ${row.detail}`}
        data-check={row.id}
        data-status={row.status}
        onClick={() => row.path && onOpen(row.path)}
        className={cn(
          "flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] disabled:cursor-default",
          row.status === "pass" && "border-ok/30 bg-ok/10 text-ok",
          row.status === "fail" && "border-danger/40 bg-danger/10 text-danger enabled:hover:bg-danger/15",
          (row.status === "skip" || row.status === "running") && "border-border text-subtle",
        )}
      >
        <Icon className={cn("size-3 shrink-0", row.status === "running" && "animate-spin")} aria-hidden />
        <span className="whitespace-nowrap">{row.label}</span>
      </button>
    </li>
  );
}

export function CheckResults({
  files,
  edits,
  verify,
  onOpen,
}: {
  files: Record<string, string>;
  edits: ProposedEdit[];
  verify: VerifyReport | null;
  onOpen: (path: string) => void;
}) {
  const { result, frame } = useRenderCheck(files, edits);
  const rows = useMemo(() => changeChecks({ files, edits, render: result, verify }), [files, edits, result, verify]);
  const failed = rows.filter((r) => r.status === "fail");
  return (
    <div className="border-t border-border px-2.5 py-1.5">
      <ul aria-label="Check results" className="flex flex-wrap items-center gap-1">
        {rows.map((row) => (
          <Chip key={row.id} row={row} onOpen={onOpen} />
        ))}
      </ul>
      {failed.length > 0 && (
        <p className="mt-1 truncate font-mono text-[11px] text-danger" title={failed[0]!.detail}>
          {failed[0]!.detail}
        </p>
      )}
      {frame}
    </div>
  );
}
