import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MousePointer2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import {
  assembleHtmlPreview,
  htmlFiles,
  pickHtmlEntry,
  PREVIEW_CSS_PATH,
  PREVIEW_HTML_PATH,
  STARTER_PREVIEW_CSS,
  STARTER_PREVIEW_HTML,
  type DesignCapture,
} from "@/lib/workspace/design-mode";

export function DesignPane() {
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
  const createFile = useWorkspace((s) => s.createFile);
  const addCapture = useIdeUi((s) => s.addCapture);
  const pages = useMemo(() => htmlFiles(files), [files]);
  const [entry, setEntry] = useState<string | null>(() => pickHtmlEntry(files, activePath));
  const frameRef = useRef<HTMLIFrameElement>(null);
  const srcdoc = entry && files[entry] !== undefined ? assembleHtmlPreview(files, entry) : "";

  useEffect(() => {
    const next = pickHtmlEntry(files, activePath);
    setEntry((prev) => (prev && files[prev] !== undefined ? prev : next));
  }, [files, activePath]);

  useEffect(() => {
    function onMsg(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; payload?: Omit<DesignCapture, "id" | "path"> };
      if (data?.type !== "aperture-design-pick" || !data.payload || !entry) return;
      addCapture({
        id: `d_${Date.now()}`,
        path: entry,
        ...data.payload,
      });
      toast.success(`Captured ${data.payload.selector}`);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [addCapture, entry]);

  function seedPreview() {
    if (files[PREVIEW_CSS_PATH] === undefined) createFile(PREVIEW_CSS_PATH, STARTER_PREVIEW_CSS);
    if (files[PREVIEW_HTML_PATH] === undefined) createFile(PREVIEW_HTML_PATH, STARTER_PREVIEW_HTML);
    setEntry(PREVIEW_HTML_PATH);
  }

  if (pages.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="max-w-sm text-center">
          <MousePointer2 className="mx-auto size-6 text-accent" />
          <p className="mt-3 text-sm font-medium text-fg">No HTML to inspect</p>
          <p className="mt-1 text-xs text-muted">
            Preview loads a page from this workspace. Click an element to send its HTML, CSS, and a crop to Composer.
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
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
        <MousePointer2 className="size-3.5 text-accent" />
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
        <span className="hidden text-[11px] text-subtle sm:inline">Click an element</span>
      </div>
      <iframe
        ref={frameRef}
        title="Design Mode"
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}
