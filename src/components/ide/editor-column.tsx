import { useEffect, useRef, useState, type ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { TabBar } from "./tab-bar";
import { Breadcrumbs } from "./breadcrumbs";
import { CodePane } from "./code-pane";
import { ReviewStrip } from "./review-strip";
import { GenerateOverlay } from "./generate-overlay";
import { SelectionActions } from "./selection-actions";
import { MarkdownPreview } from "./md-preview";
import { DesignPane } from "./design-pane";
import { languageFromPath } from "@/lib/parser/language";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

function CodeStage() {
  return (
    <div className="relative h-full min-h-0 min-w-0">
      <div className="absolute inset-0">
        <CodePane />
      </div>
      <GenerateOverlay />
      <SelectionActions />
    </div>
  );
}

function useColumnWide(min: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const next = el.clientWidth >= min;
      setWide((prev) => (prev === next ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);

  return { ref, wide };
}

function CodeDesignSplit({
  code,
  preview,
  split,
  peek,
}: {
  code: ReactNode;
  preview: ReactNode;
  split: boolean;
  peek: boolean;
}) {
  const together = split && peek;
  const { ref, wide } = useColumnWide(560);
  const stack = together && !wide;

  return (
    <div
      ref={ref}
      className="ide-split"
      data-split={split ? "on" : "off"}
      data-peek={peek ? "on" : "off"}
    >
      <Group
        id="aperture-code-design"
        orientation={stack ? "vertical" : "horizontal"}
        className="h-full min-h-0 min-w-0"
      >
        <Panel id="code-peek" defaultSize="38%" minSize="16%" maxSize="80%" className="min-h-0 overflow-hidden">
          {code}
        </Panel>
        <Separator
          id="sep-code-design"
          className={cn(
            "z-10 bg-border hover:bg-accent data-[active]:bg-accent",
            stack ? "h-2" : "w-2",
          )}
          title="Drag to resize code and preview"
        />
        <Panel id="design-peek" minSize="20%" className="min-h-0 overflow-hidden">
          {preview}
        </Panel>
      </Group>
    </div>
  );
}

export function EditorColumn() {
  const activePath = useWorkspace((s) => s.activePath);
  const body = useWorkspace((s) => (s.activePath ? (s.files[s.activePath] ?? "") : ""));
  const previewOpen = useIdeUi((s) => s.designOpen);
  const codePeek = useIdeUi((s) => s.codePeek);
  const markdown = Boolean(activePath && languageFromPath(activePath) === "markdown");
  const showMarkdown = previewOpen && markdown;
  const showDesign = previewOpen && !markdown;
  const split = showMarkdown || showDesign;

  const preview = showDesign ? (
    <DesignPane />
  ) : showMarkdown ? (
    <div className="h-full min-h-0 overflow-auto">
      <MarkdownPreview text={body} />
    </div>
  ) : (
    <div className="h-full bg-bg" />
  );

  return (
    <div className="ide-editor bg-bg">
      <TabBar />
      <div>
        <Breadcrumbs />
        <ReviewStrip />
      </div>
      <CodeDesignSplit code={<CodeStage />} preview={preview} split={split} peek={codePeek} />
    </div>
  );
}
