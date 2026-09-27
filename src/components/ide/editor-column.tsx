import { type ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { FileText } from "lucide-react";
import { TabBar } from "./tab-bar";
import { Breadcrumbs } from "./breadcrumbs";
import { CodePane } from "./code-pane";
import { ReviewStrip } from "./review-strip";
import { GenerateOverlay } from "./generate-overlay";
import { SelectionActions } from "./selection-actions";
import { MarkdownPreview } from "./md-preview";
import { DesignPane, PreviewDockControls } from "./design-pane";
import { effectiveDock } from "@/lib/layout-prefs";
import { languageFromPath } from "@/lib/parser/language";
import { RESIZE_TARGET, usePanelLayout } from "@/lib/use-panel-layout";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";

function CodeStage() {
  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <div className="absolute inset-0">
        <CodePane />
      </div>
      <GenerateOverlay />
      <SelectionActions />
    </div>
  );
}

function CodeChrome() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <TabBar />
      <Breadcrumbs />
      <ReviewStrip />
      <CodeStage />
    </div>
  );
}

function MarkdownPane({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ide-chrome-row flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <FileText className="size-3.5 text-subtle" />
        <span className="text-[12px] font-medium text-fg">Markdown preview</span>
        <div className="ml-auto">
          <PreviewDockControls />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <MarkdownPreview text={text} />
      </div>
    </div>
  );
}

const SPLIT_SIZES = { code: 50, preview: 50 } as const;

/**
 * Code and preview side by side (or stacked, or preview maximized). The dock
 * is a user choice from the Layout menu or the preview header; sizes are
 * remembered separately for side-by-side and stacked, since a good width is
 * rarely a good height.
 */
function CodePreviewSplit({ code, preview, dock }: { code: ReactNode; preview: ReactNode; dock: "right" | "bottom" | "full" }) {
  const vertical = dock === "bottom";
  const split = usePanelLayout(vertical ? "code-preview-v" : "code-preview-h", SPLIT_SIZES);

  return (
    <div className="ide-split" data-dock={dock}>
      <Group
        orientation={vertical ? "vertical" : "horizontal"}
        className="h-full min-h-0 min-w-0"
        groupRef={split.groupRef}
        defaultLayout={split.defaultLayout}
        onLayoutChanged={split.onLayoutChanged}
        resizeTargetMinimumSize={RESIZE_TARGET}
      >
        <Panel id="code" defaultSize={split.size("code")} minSize="20%" className="min-h-0 overflow-hidden">
          {code}
        </Panel>
        <Separator
          id="sep-code-preview"
          className={vertical ? "ide-sep-y" : "ide-sep-x"}
          title="Drag to resize code and preview"
        >
          <span className="ide-sep-grip" />
        </Separator>
        <Panel id="preview" defaultSize={split.size("preview")} minSize="20%" className="min-h-0 overflow-hidden">
          {preview}
        </Panel>
      </Group>
    </div>
  );
}

export function EditorColumn({ desktop }: { desktop: boolean }) {
  const activePath = useWorkspace((s) => s.activePath);
  const body = useWorkspace((s) => (s.activePath ? (s.files[s.activePath] ?? "") : ""));
  const previewOpen = useIdeUi((s) => s.designOpen);
  const codePeek = useIdeUi((s) => s.codePeek);
  const previewDock = useIdeUi((s) => s.previewDock);
  const markdown = Boolean(activePath && languageFromPath(activePath) === "markdown");
  const dock = effectiveDock(previewDock, { desktop, codePeek });

  return (
    <div className="ide-editor bg-bg" data-split={previewOpen ? "on" : "off"}>
      {previewOpen ? (
        // Keyed by orientation: the panel library can't flip a live group.
        <CodePreviewSplit
          key={dock === "bottom" ? "v" : "h"}
          code={<CodeChrome />}
          preview={markdown ? <MarkdownPane text={body} /> : <DesignPane />}
          dock={dock}
        />
      ) : (
        <CodeChrome />
      )}
    </div>
  );
}
