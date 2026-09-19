import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MousePointer2, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";
import {
  assembleHtmlPreview,
  guessSource,
  hotReloadStyles,
  htmlFiles,
  isDesignPayload,
  pickHtmlEntry,
  PREVIEW_CSS_PATH,
  PREVIEW_HTML_PATH,
  previewMarkupKey,
  STARTER_PREVIEW_CSS,
  STARTER_PREVIEW_HTML,
  type DesignCapture,
} from "@/lib/workspace/design-mode";

export function DesignPane() {
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
  const createFile = useWorkspace((s) => s.createFile);
  const captures = useIdeUi((s) => s.captures);
  const addCapture = useIdeUi((s) => s.addCapture);
  const updateCapture = useIdeUi((s) => s.updateCapture);
  const removeCapture = useIdeUi((s) => s.removeCapture);
  const pages = useMemo(() => htmlFiles(files), [files]);
  const [entry, setEntry] = useState<string | null>(() => pickHtmlEntry(files, activePath));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastEntry = useRef<string | null>(null);
  const lastHtml = useRef("");
  const pulseTimer = useRef<number>(0);
  const [pulse, setPulse] = useState<string | null>(null);
  const srcdoc = entry && files[entry] !== undefined ? assembleHtmlPreview(files, entry) : "";

  useEffect(() => {
    const next = pickHtmlEntry(files, activePath);
    setEntry((prev) => (prev && files[prev] !== undefined ? prev : next));
  }, [files, activePath]);

  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe || !srcdoc || !entry) return;
    if (srcdoc === lastHtml.current && lastEntry.current === entry) return;
    const doc = iframe.contentDocument;
    const samePage = lastEntry.current === entry && Boolean(doc?.documentElement) && lastHtml.current !== "";

    if (samePage && previewMarkupKey(lastHtml.current) === previewMarkupKey(srcdoc)) {
      lastHtml.current = srcdoc;
      if (hotReloadStyles(doc!, srcdoc)) flash("CSS");
      return;
    }

    const scroll = samePage
      ? { x: iframe.contentWindow?.scrollX ?? 0, y: iframe.contentWindow?.scrollY ?? 0 }
      : null;
    lastEntry.current = entry;
    lastHtml.current = srcdoc;
    if (scroll) {
      iframe.onload = () => {
        iframe.contentWindow?.scrollTo(scroll.x, scroll.y);
        iframe.onload = null;
      };
      flash("HTML");
    }
    iframe.srcdoc = srcdoc;
  }, [srcdoc, entry]);

  function flash(kind: string) {
    setPulse(kind);
    window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(null), 900);
  }

  useEffect(() => {
    function onMsg(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; payload?: Omit<DesignCapture, "id" | "path" | "source" | "note"> };
      if (data?.type !== "aperture-design-pick" || !isDesignPayload(data.payload) || !entry) return;
      const id = `d_${Date.now()}`;
      addCapture({
        ...data.payload,
        neighborhood: data.payload.neighborhood ?? "",
        id,
        path: entry,
        source: guessSource(useWorkspace.getState().files, data.payload.selector),
        note: "",
      });
      setEditingId(id);
      setDraft("");
      toast.success(`Pinned ${data.payload.selector}`);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [addCapture, entry]);

  function seedPreview() {
    if (files[PREVIEW_CSS_PATH] === undefined) createFile(PREVIEW_CSS_PATH, STARTER_PREVIEW_CSS);
    if (files[PREVIEW_HTML_PATH] === undefined) createFile(PREVIEW_HTML_PATH, STARTER_PREVIEW_HTML);
    setEntry(PREVIEW_HTML_PATH);
  }

  function saveNote() {
    if (!editingId) return;
    updateCapture(editingId, { note: draft.trim() });
    setEditingId(null);
    setDraft("");
  }

  function sendToComposer() {
    if (editingId) saveNote();
    useIdeUi.setState({ chatOpen: true, mobilePane: "agent", designOpen: true });
    toast.success(`${captures.length} note${captures.length === 1 ? "" : "s"} in Composer`);
  }

  if (pages.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-sm text-center">
          <MousePointer2 className="mx-auto size-6 text-accent" />
          <p className="mt-3 text-sm font-medium text-fg">Design Mode</p>
          <p className="mt-1 text-xs text-muted">
            Click any element on a page. HTML, CSS, and a crop pin here — add what to change, then send them to Composer.
          </p>
          <Button size="sm" className="mt-4" onClick={seedPreview}>
            <Plus className="size-3.5" />
            Create preview.html
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2">
        <MousePointer2 className="size-3.5 text-accent" />
        <span className="text-[12px] font-medium text-fg">Design Mode</span>
        <select
          value={entry ?? pages[0]}
          onChange={(e) => setEntry(e.target.value)}
          className="h-6 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-[11px] text-fg"
          aria-label="Preview page"
        >
          {pages.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
        <span className={cn("text-[11px]", pulse ? "text-ok" : "hidden text-subtle sm:inline")}>
          {pulse ? `Hot reload · ${pulse}` : "Click to pin"}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={frameRef}
          title="Design Mode"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
        {captures.map((cap, i) => (
          <button
            key={cap.id}
            type="button"
            className={cn(
              "absolute z-10 grid size-5 place-items-center rounded-full text-[10px] font-semibold shadow-sm",
              editingId === cap.id ? "bg-accent text-bg" : "bg-fg text-bg",
            )}
            style={{ left: Math.max(4, cap.bounds.x), top: Math.max(4, cap.bounds.y) }}
            aria-label={`Note ${i + 1}: ${cap.selector}`}
            onClick={() => {
              setEditingId(cap.id);
              setDraft(cap.note);
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="max-h-44 shrink-0 border-t border-border">
        {captures.length === 0 ? (
          <p className="px-3 py-2 text-xs text-subtle">Click an element. Notes stay here until you send them to Composer.</p>
        ) : (
          <ul className="aperture-scroll max-h-32 overflow-y-auto">
            {captures.map((cap, i) => (
              <li key={cap.id} className="border-b border-border px-3 py-2 last:border-b-0">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-semibold text-fg">
                    {i + 1}
                  </span>
                  {cap.screenshot ? (
                    <img src={cap.screenshot} alt="" className="mt-0.5 size-8 shrink-0 rounded-sm object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] text-fg">{cap.selector}</p>
                    {cap.source && <p className="truncate text-[10px] text-subtle">{cap.source}</p>}
                    {editingId === cap.id ? (
                      <div className="mt-1.5">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="What should change?"
                          rows={2}
                          className="w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-subtle"
                        />
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={saveNote}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              setEditingId(null);
                              setDraft("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-0.5 text-left text-[11px] text-muted hover:text-fg"
                        onClick={() => {
                          setEditingId(cap.id);
                          setDraft(cap.note);
                        }}
                      >
                        {cap.note || "Edit — add what to change"}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${cap.selector}`}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:text-danger"
                    onClick={() => {
                      if (editingId === cap.id) {
                        setEditingId(null);
                        setDraft("");
                      }
                      removeCapture(cap.id);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {captures.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
            <p className="text-[11px] text-subtle">
              {captures.length} note{captures.length === 1 ? "" : "s"}
            </p>
            <Button size="sm" className="h-7" onClick={sendToComposer}>
              <Send className="size-3.5" />
              Send to Composer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
