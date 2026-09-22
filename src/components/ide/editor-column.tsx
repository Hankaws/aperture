import { type ReactNode } from "react";
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
  return (
    <div
      className="ide-split"
      data-split={split ? "on" : "off"}
      data-peek={peek ? "on" : "off"}
    >
      <Group
        id="aperture-code-design-v"
        orientation="vertical"
        className="h-full min-h-0 min-w-0"
      >
        <Panel id="code-peek" defaultSize="38%" minSize="18%" maxSize="80%" className="min-h-0 overflow-hidden">
          {code}
        </Panel>
        <Separator
          id="sep-code-design"
          className="group z-10 flex h-2 shrink-0 items-center justify-center bg-border hover:bg-accent data-[active]:bg-accent"
          title="Drag to resize code and preview"
        >
          <span className="h-0.5 w-8 rounded-full bg-subtle group-hover:bg-bg group-data-[active]:bg-bg" />
        </Separator>
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
    <div className="ide-editor bg-bg" data-split={split ? "on" : "off"}>
      {split ? (
        <CodeDesignSplit code={<CodeChrome />} preview={preview} split={split} peek={codePeek} />
      ) : (
        <CodeChrome />
      )}
    </div>
  );
}
