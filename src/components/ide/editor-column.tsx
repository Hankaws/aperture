import type { ReactNode } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
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

function CodeDesignSplit({ code, preview }: { code: ReactNode; preview: ReactNode }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "aperture-code-design",
    panelIds: ["code-peek", "design-peek"],
  });

  return (
    <Group
      id="aperture-code-design"
      orientation="horizontal"
      className="h-full min-h-0 min-w-0"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="code-peek" defaultSize="38%" minSize="16%" maxSize="72%" className="min-h-0 overflow-hidden">
        {code}
      </Panel>
      <Separator
        className="z-10 w-2 bg-border hover:bg-accent data-[active]:bg-accent"
        title="Drag to resize code and preview"
      />
      <Panel id="design-peek" minSize="24%" className="min-h-0 overflow-hidden border-l border-border">
        {preview}
      </Panel>
    </Group>
  );
}

export function EditorColumn() {
  const activePath = useWorkspace((s) => s.activePath);
  const files = useWorkspace((s) => s.files);
  const previewOpen = useIdeUi((s) => s.designOpen);
  const codePeek = useIdeUi((s) => s.codePeek);
  const markdown = Boolean(activePath && languageFromPath(activePath) === "markdown");
  const showMarkdown = previewOpen && markdown;
  const showDesign = previewOpen && !markdown;
  const split = showMarkdown || showDesign;
  const together = split && codePeek;
  const body = activePath ? files[activePath] ?? "" : "";

  const preview = showDesign ? (
    <DesignPane />
  ) : showMarkdown ? (
    <div className="h-full min-h-0 overflow-auto">
      <MarkdownPreview text={body} />
    </div>
  ) : null;

  return (
    <div className="ide-editor bg-bg">
      <TabBar />
      <div>
        <Breadcrumbs />
        <ReviewStrip />
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0",
          together ? "h-full" : split ? "ide-preview-split" : "flex min-h-0 flex-col",
        )}
      >
        {together ? (
          <CodeDesignSplit code={<CodeStage />} preview={preview} />
        ) : (
          <>
            <div className={cn("relative min-h-0 min-w-0", split && "ide-code")}>
              <CodeStage />
            </div>
            {showDesign && (
              <div className="min-h-0 min-w-0 border-t border-border md:border-t-0 md:border-l">
                <DesignPane />
              </div>
            )}
            {showMarkdown && (
              <div className="min-h-0 min-w-0 overflow-auto border-t border-border md:border-t-0 md:border-l">
                <MarkdownPreview text={body} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
