import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer2,
  PanelBottom,
  PanelRight,
  Palette,
  Pin,
  Send,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { useIdeUi } from "@/lib/ui-store";
import { RESIZE_TARGET, usePanelLayout } from "@/lib/use-panel-layout";
import { useWorkspace } from "@/lib/workspace/store";
import { cn, isModEvent } from "@/lib/utils";
import { StyleInspector, ThemePanel } from "@/components/ide/design-inspector";
import {
  assembleHtmlPreview,
  cssFromPreview,
  guessSource,
  hotReloadStyles,
  htmlFiles,
  isDesignPayload,
  pickHtmlEntry,
  previewMarkupKey,
  type DesignCapture,
} from "@/lib/workspace/design-mode";

function DockButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors",
        active ? "bg-elevated text-fg" : "text-subtle hover:bg-elevated hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** Where the preview sits, plus close. Phones always get a full-size preview, so only close shows there. */
export function PreviewDockControls() {
  const dock = useIdeUi((s) => s.previewDock);
  const setDock = useIdeUi((s) => s.setPreviewDock);
  const setDesignOpen = useIdeUi((s) => s.setDesignOpen);
  const full = dock === "full";

  return (
    <div className="flex items-center gap-0.5">
      <div className="hidden items-center gap-0.5 md:flex">
        <DockButton
          active={dock === "right"}
          label="Preview beside the code"
          onClick={() => setDock("right")}
        >
          <PanelRight className="size-4" strokeWidth={1.6} />
        </DockButton>
        <DockButton
          active={dock === "bottom"}
          label="Preview below the code"
          onClick={() => setDock("bottom")}
        >
          <PanelBottom className="size-4" strokeWidth={1.6} />
        </DockButton>
        <DockButton
          active={full}
          label={full ? "Restore preview beside the code" : "Maximize preview"}
          onClick={() => setDock(full ? "right" : "full")}
        >
          {full ? (
            <Minimize2 className="size-4" strokeWidth={1.6} />
          ) : (
            <Maximize2 className="size-4" strokeWidth={1.6} />
          )}
        </DockButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      </div>
      <DockButton label="Close preview" onClick={() => setDesignOpen(false)}>
        <X className="size-4" strokeWidth={1.6} />
      </DockButton>
    </div>
  );
}

const NOTES_SIZES = { canvas: 60, notes: 40 } as const;
/** The tab row stays visible when the panel is collapsed. */
const NOTES_COLLAPSED = "2.5rem";

type DesignTab = "style" | "theme" | "notes";
type Viewport = "full" | "tablet" | "phone";
const VIEWPORTS: Array<{
  id: Viewport;
  label: string;
  width: number | null;
  icon: typeof Monitor;
}> = [
  { id: "full", label: "Full width", width: null, icon: Monitor },
  { id: "tablet", label: "Tablet, 768px", width: 768, icon: Tablet },
  { id: "phone", label: "Phone, 390px", width: 390, icon: Smartphone },
];

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors",
        active ? "bg-elevated text-fg" : "text-subtle hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function DesignPane() {
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
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
  const runScripts = useIdeUi((s) => s.runPreviewScripts);
  const setRunScripts = useIdeUi((s) => s.setRunPreviewScripts);
  const notesLayout = usePanelLayout("preview-notes", NOTES_SIZES);
  const notesRef = usePanelRef();
  const noteCount = captures.filter((c) => c.note).length;
  const [tab, setTab] = useState<DesignTab>("style");
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("full");
  const srcdoc =
    entry && files[entry] !== undefined ? assembleHtmlPreview(files, entry, { runScripts }) : "";
  // The stylesheets the page links, in order: what the inspector and theme panel edit.
  const pageCss = useMemo(() => Object.keys(cssFromPreview(srcdoc)), [srcdoc]);
  const selected =
    captures.find((c) => c.id === selectedId) ?? captures[captures.length - 1] ?? null;
  const frameWidth = VIEWPORTS.find((v) => v.id === viewport)!.width;

  useEffect(() => {
    const next = pickHtmlEntry(files, activePath);
    setEntry((prev) => (prev && files[prev] !== undefined ? prev : next));
  }, [files, activePath]);

  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe || !srcdoc || !entry) return;
    if (srcdoc === lastHtml.current && lastEntry.current === entry) return;
    const doc = iframe.contentDocument;
    const samePage =
      lastEntry.current === entry && Boolean(doc?.documentElement) && lastHtml.current !== "";

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

  useEffect(() => {
    useIdeUi.getState().setPreviewErrors([]);
  }, [srcdoc]);

  function flash(kind: string) {
    setPulse(kind);
    window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(null), 900);
  }

  useEffect(() => {
    function onMsg(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as {
        type?: string;
        message?: string;
        payload?: Omit<DesignCapture, "id" | "path" | "source" | "note">;
      };
      if (data?.type === "aperture-preview-error") {
        const line = (data.message ?? "Preview error").trim();
        if (!line) return;
        const prev = useIdeUi.getState().previewErrors;
        if (prev.includes(line)) return;
        useIdeUi.getState().setPreviewErrors([...prev, line]);
        if (prev.length === 0) toast.error(line.slice(0, 80));
        return;
      }
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
      setSelectedId(id);
      // The open tab decides what a click is for: a note to write, or a style to change.
      if (tabRef.current === "notes") {
        setEditingId(id);
        setDraft("");
      } else setTab("style");
      const panel = notesRef.current;
      if (panel?.isCollapsed()) panel.expand();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [addCapture, entry, notesRef]);

  function saveNote() {
    if (!editingId) return;
    updateCapture(editingId, { note: draft.trim() });
    setEditingId(null);
    setDraft("");
  }

  function sendToComposer() {
    if (editingId) saveNote();
    useIdeUi.setState({ chatOpen: true, mobilePane: "agent", designOpen: true });
    toast.success(`${captures.length} element${captures.length === 1 ? "" : "s"} in Composer`);
  }

  function cancelNote() {
    setEditingId(null);
    setDraft("");
  }

  function startEditing(cap: DesignCapture) {
    setEditingId(cap.id);
    setDraft(cap.note);
  }

  const header = (
    <div className="ide-chrome-row flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <MousePointer2 className="size-3.5 shrink-0 text-accent" />
      <span className="shrink-0 text-[12px] font-medium text-fg @max-md:hidden">Preview</span>
      {pages.length > 0 && (
        <select
          value={entry ?? pages[0]}
          onChange={(e) => setEntry(e.target.value)}
          className="h-6 min-w-24 max-w-56 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-[11px] text-fg"
          aria-label="Preview page"
        >
          {pages.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      )}
      {pulse && <span className="shrink-0 text-[11px] text-ok">Hot reload · {pulse}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {pages.length > 0 && (
          <div
            className="flex items-center gap-0.5 @max-sm:hidden"
            role="group"
            aria-label="Preview width"
          >
            {VIEWPORTS.map((v) => (
              <DockButton
                key={v.id}
                active={viewport === v.id}
                label={v.label}
                onClick={() => setViewport(v.id)}
              >
                <v.icon className="size-4" strokeWidth={1.6} />
              </DockButton>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          </div>
        )}
        {pages.length > 0 && (
          <button
            type="button"
            onClick={() => setRunScripts(!runScripts)}
            aria-pressed={runScripts}
            title={
              runScripts
                ? "The page's own scripts run in the preview, and their errors are reported. Click to stop running them."
                : "Run the page's own scripts in the preview, so real runtime errors are reported."
            }
            className={cn(
              "h-6 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors",
              runScripts
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-bg text-subtle hover:text-fg",
            )}
          >
            {runScripts ? "Scripts on" : "Scripts off"}
          </button>
        )}
        <PreviewDockControls />
      </div>
    </div>
  );

  if (pages.length === 0) {
    return (
      <div className="@container flex h-full min-h-0 flex-col">
        {header}
        <div className="grid min-h-0 flex-1 place-items-center px-6">
          <div className="max-w-sm text-center">
            <MousePointer2 className="mx-auto size-6 text-accent" />
            <p className="mt-3 text-sm font-medium text-fg">Design Mode</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              This project has no HTML page to preview. Add one, then click an element to restyle it or pin a note for Composer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      {header}
      <Group
        orientation="vertical"
        className="min-h-0 flex-1"
        groupRef={notesLayout.groupRef}
        defaultLayout={notesLayout.defaultLayout}
        onLayoutChanged={notesLayout.onLayoutChanged}
        resizeTargetMinimumSize={RESIZE_TARGET}
      >
        <Panel
          id="canvas"
          defaultSize={notesLayout.size("canvas")}
          minSize="25%"
          className="min-h-0 overflow-hidden"
        >
          <div className={cn("h-full", frameWidth && "overflow-auto bg-bg")}>
            <div
              className={cn("relative h-full", frameWidth && "mx-auto ring-1 ring-border")}
              style={frameWidth ? { width: frameWidth, maxWidth: "100%" } : undefined}
            >
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
                  // Sits just above the element (below it when it touches the top),
                  // so it never covers the text it points at.
                  className={cn(
                    "absolute z-10 grid size-5 place-items-center rounded-full text-[10px] font-semibold shadow-sm ring-2 ring-bg",
                    editingId === cap.id || selected?.id === cap.id
                      ? "bg-accent text-bg"
                      : "bg-fg text-bg",
                  )}
                  style={{
                    left: Math.max(2, cap.bounds.x),
                    top: cap.bounds.y >= 24 ? cap.bounds.y - 22 : cap.bounds.y + cap.bounds.h + 2,
                  }}
                  aria-label={`Pin ${i + 1}: ${cap.selector}`}
                  onClick={() => {
                    setSelectedId(cap.id);
                    if (tab === "notes") startEditing(cap);
                    else setTab("style");
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <Separator
          id="sep-preview-notes"
          className="ide-sep-y"
          title="Drag to resize the preview and the design panel"
        >
          <span className="ide-sep-grip" />
        </Separator>
        <Panel
          id="notes"
          panelRef={notesRef}
          defaultSize={notesLayout.size("notes")}
          minSize="18%"
          collapsible
          collapsedSize={NOTES_COLLAPSED}
          className="min-h-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col bg-surface">
            <div
              className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2"
              role="tablist"
              aria-label="Design"
            >
              <TabButton
                active={tab === "style"}
                onClick={() => setTab("style")}
                icon={<SlidersHorizontal className="size-3.5" />}
              >
                Style
              </TabButton>
              <TabButton
                active={tab === "theme"}
                onClick={() => setTab("theme")}
                icon={<Palette className="size-3.5" />}
              >
                Theme
              </TabButton>
              <TabButton
                active={tab === "notes"}
                onClick={() => setTab("notes")}
                icon={<Pin className="size-3.5" />}
              >
                Notes
                {noteCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-bg px-1 text-[10px] text-muted">
                    {noteCount}
                  </span>
                )}
              </TabButton>
              {tab === "notes" && captures.length > 0 && (
                <Button size="sm" className="ml-auto h-7 shrink-0" onClick={sendToComposer}>
                  <Send className="size-3.5" />
                  <span className="@max-sm:hidden">Send to Composer</span>
                  <span className="@sm:hidden">Send</span>
                </Button>
              )}
            </div>
            {tab === "style" && (
              <div className="aperture-scroll @container min-h-0 flex-1 overflow-y-auto p-3">
                {selected ? (
                  <>
                    <p
                      className="mb-3 truncate font-mono text-[12px] text-fg"
                      title={selected.selector}
                    >
                      {selected.selector}
                    </p>
                    <StyleInspector capture={selected} pageCss={pageCss} />
                  </>
                ) : (
                  <p className="text-[13px] leading-relaxed text-muted">
                    Click any element in the preview to style it. Changes are written to your CSS
                    and show up at once.
                  </p>
                )}
              </div>
            )}
            {tab === "theme" && (
              <div className="aperture-scroll @container min-h-0 flex-1 overflow-y-auto p-3">
                <ThemePanel pageCss={pageCss} />
              </div>
            )}
            {tab === "notes" && captures.length === 0 && (
              <p className="p-3 text-[13px] leading-relaxed text-muted">
                Click an element in the preview, write what should change, then send your notes to
                Composer.
              </p>
            )}
            {tab === "notes" && (
              <ul className="aperture-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {captures.map((cap, i) => (
                  <li key={cap.id} className="rounded-lg border border-border bg-bg p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-[11px] font-semibold text-fg">
                        {i + 1}
                      </span>
                      {cap.screenshot ? (
                        <img
                          src={cap.screenshot}
                          alt=""
                          className="size-12 shrink-0 rounded-md border border-border object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate font-mono text-[12px] text-fg">{cap.selector}</p>
                        {cap.source && (
                          <p className="mt-0.5 truncate text-[11px] text-subtle">{cap.source}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${cap.selector}`}
                        title="Remove note"
                        className="grid size-8 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-danger"
                        onClick={() => {
                          if (editingId === cap.id) cancelNote();
                          if (selectedId === cap.id) setSelectedId(null);
                          removeCapture(cap.id);
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {editingId === cap.id ? (
                      <div className="mt-3">
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && isModEvent(e)) {
                              e.preventDefault();
                              saveNote();
                            } else if (e.key === "Escape") {
                              // Cancel the note only; the editor's Escape would close the preview.
                              e.stopPropagation();
                              cancelNote();
                            }
                          }}
                          placeholder="What should change? For example: make the title bolder and add space above it."
                          rows={3}
                          className="block max-h-48 min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-fg [field-sizing:content] placeholder:text-subtle focus:border-accent/60 focus:outline-none"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <span className="mr-auto truncate text-[11px] text-subtle @max-sm:hidden">
                            Ctrl/⌘ ↵ to save
                          </span>
                          <Button size="sm" variant="ghost" className="h-8" onClick={cancelNote}>
                            Cancel
                          </Button>
                          <Button size="sm" className="h-8" onClick={saveNote}>
                            Save note
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2.5 block w-full rounded-md px-0 text-left text-[13px] leading-relaxed text-muted transition-colors hover:text-fg"
                        onClick={() => startEditing(cap)}
                      >
                        {cap.note || <span className="text-subtle">Add what should change…</span>}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
