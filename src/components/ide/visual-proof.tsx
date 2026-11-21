import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { renderEntry } from "@/lib/workspace/checks";
import { snapshotDocument } from "@/lib/workspace/design-mode";
import { mergeEdits } from "@/lib/workspace/preview-check";
import type { ProposedEdit } from "@/lib/workspace/types";
import { diffLine, visualDiff, type VisualDiff } from "@/lib/workspace/visual-diff";

type Shot = { url: string | null; width: number; height: number; overflow: number };
type View = "desktop" | "phone";

const VIEWS: Record<View, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: "Desktop" },
  phone: { width: 390, height: 844, label: "Phone" },
};
/** A page that has not drawn its picture by then is shown as not taken. */
const SNAPSHOT_TIMEOUT_MS = 8000;

/** Renders one document off screen at one size and keeps the picture it takes of itself. */
function useSnapshot(doc: string | null, view: View) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const key = doc ? `${view}:${doc}` : null;
  const [settled, setSettled] = useState<{ key: string; shot: Shot } | null>(null);
  useEffect(() => {
    if (!key) return;
    const size = VIEWS[view];
    const timer = window.setTimeout(
      () =>
        setSettled({
          key,
          shot: { url: null, width: size.width, height: size.height, overflow: 0 },
        }),
      SNAPSHOT_TIMEOUT_MS,
    );
    function onMessage(event: MessageEvent) {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as Partial<Shot> & { type?: string };
      if (data?.type !== "aperture-snapshot") return;
      window.clearTimeout(timer);
      setSettled({
        key: key!,
        shot: {
          url: typeof data.url === "string" && data.url.startsWith("data:image/") ? data.url : null,
          width: Number(data.width) || size.width,
          height: Number(data.height) || size.height,
          overflow: Number(data.overflow) || 0,
        },
      });
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [key, view]);
  const shot = key && settled?.key === key ? settled.shot : null;
  const frame = doc ? (
    <iframe
      key={key}
      ref={frameRef}
      title="Visual proof"
      aria-hidden
      tabIndex={-1}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={doc}
      style={{ width: VIEWS[view].width, height: VIEWS[view].height }}
      className="pointer-events-none fixed top-0 -left-[10000px] border-0 opacity-0"
    />
  ) : null;
  return { shot, frame };
}

function pixels(url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ width: canvas.width, height: canvas.height, data });
    };
    img.onerror = () => reject(new Error("could not read the picture"));
    img.src = url;
  });
}

function Picture({
  title,
  shot,
  diff,
}: {
  title: string;
  shot: Shot | null | "none";
  diff: VisualDiff | null;
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-[11px] text-subtle">{title}</figcaption>
      <div className="aperture-scroll max-h-64 overflow-y-auto rounded-md border border-border bg-bg">
        {shot === "none" ? (
          <p className="px-2 py-6 text-center text-[11px] text-subtle">
            A new page: nothing before it.
          </p>
        ) : !shot ? (
          <p className="px-2 py-6 text-center text-[11px] text-subtle shimmer-text">
            Drawing the page…
          </p>
        ) : !shot.url ? (
          <p className="px-2 py-6 text-center text-[11px] text-subtle">
            This browser would not draw a picture of it.
          </p>
        ) : (
          <div className="relative">
            <img src={shot.url} alt={`${title}: the page as it renders`} className="block w-full" />
            {diff?.boxes.map((box, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute rounded-sm border-2 border-warn bg-warn/10"
                style={{
                  left: `${(box.x / shot.width) * 100}%`,
                  top: `${(box.y / shot.height) * 100}%`,
                  width: `${(box.w / shot.width) * 100}%`,
                  height: `${(box.h / shot.height) * 100}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * Visual proof: the page before and after the staged change, side by side,
 * at desktop or phone width, with what changed outlined. The checks say the
 * page renders; this shows what it renders, and a page that starts to scroll
 * sideways. Drawn in this tab from the files: no model, nothing sent.
 */
export function VisualProof({
  files,
  edits,
}: {
  files: Record<string, string>;
  edits: ProposedEdit[];
}) {
  const runScripts = useIdeUi((s) => s.runPreviewScripts);
  const [view, setView] = useState<View>("desktop");
  const { beforeDoc, afterDoc, isNew } = useMemo(() => {
    const entry = renderEntry(files, edits, { runScripts });
    if (!entry) return { beforeDoc: null, afterDoc: null, isNew: false };
    const merged = mergeEdits(files, edits);
    const existed = files[entry] !== undefined;
    return {
      beforeDoc: existed ? snapshotDocument(files, entry, { runScripts }) : null,
      afterDoc: snapshotDocument(merged, entry, { runScripts }),
      isNew: !existed,
    };
  }, [files, edits, runScripts]);
  const before = useSnapshot(beforeDoc, view);
  const after = useSnapshot(afterDoc, view);
  const [diff, setDiff] = useState<{ key: string; diff: VisualDiff | null } | null>(null);
  const diffKey = `${view}|${before.shot?.url ?? ""}|${after.shot?.url ?? ""}`;

  useEffect(() => {
    const a = before.shot?.url;
    const b = after.shot?.url;
    if (!a || !b) return;
    let live = true;
    void Promise.all([pixels(a), pixels(b)])
      .then(([pa, pb]) => {
        if (live) setDiff({ key: diffKey, diff: visualDiff(pa, pb) });
      })
      .catch(() => {
        if (live) setDiff({ key: diffKey, diff: null });
      });
    return () => {
      live = false;
    };
  }, [before.shot?.url, after.shot?.url, diffKey]);

  if (!afterDoc) return null;
  const shown = diff?.key === diffKey ? diff.diff : null;
  const sideways =
    after.shot && after.shot.overflow > 0 && (before.shot?.overflow ?? 0) === 0
      ? after.shot.overflow
      : 0;
  const line = isNew
    ? "A new page."
    : !before.shot || !after.shot
      ? "Drawing the page before and after…"
      : !before.shot.url || !after.shot.url
        ? "No picture to compare in this browser."
        : diffLine(shown);
  return (
    <section
      aria-label="Visual proof"
      className="mt-1.5 rounded-md border border-border px-2 py-1.5"
      data-visual-proof
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-medium text-fg">How the page looks</p>
        <p className="min-w-0 flex-1 text-[11px] text-muted sm:truncate" data-visual-line>
          {line}
        </p>
        <div role="group" aria-label="Width" className="flex rounded-md border border-border p-0.5">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-6 rounded px-2 text-[11px]",
                view === v ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {VIEWS[v].label}
            </button>
          ))}
        </div>
      </div>
      {sideways > 0 && (
        <p className="mt-1 text-[11px] text-warn" data-visual-sideways>
          After this change the page scrolls sideways by {sideways}px at{" "}
          {VIEWS[view].label.toLowerCase()} width; before it did not.
        </p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Picture title="Before" shot={isNew ? "none" : before.shot} diff={shown} />
        <Picture title="After" shot={after.shot} diff={shown} />
      </div>
      {before.frame}
      {after.frame}
    </section>
  );
}
