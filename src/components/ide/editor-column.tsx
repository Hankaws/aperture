import { TabBar } from "./tab-bar";
import { CodePane } from "./code-pane";
import { DiffBar } from "./diff-bar";
import { GenerateOverlay } from "./generate-overlay";
import { SelectionActions } from "./selection-actions";
import { MarkdownPreview } from "./md-preview";
import { DesignPane } from "./design-pane";
import { pendingEditFor } from "@/lib/workspace/edits";
import { languageFromPath } from "@/lib/parser/language";
import { useWorkspace } from "@/lib/workspace/store";
import { useIdeUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

export function EditorColumn() {
  const pending = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
  const running = useWorkspace((s) => s.agentRunning);
  const activePath = useWorkspace((s) => s.activePath);
  const files = useWorkspace((s) => s.files);
  const previewOpen = useIdeUi((s) => s.designOpen);
  const markdown = Boolean(activePath && languageFromPath(activePath) === "markdown");
  const showMarkdown = previewOpen && markdown;
  const showDesign = previewOpen && !markdown;
  const split = showMarkdown || showDesign;
  const body = activePath ? files[activePath] ?? "" : "";

  return (
    <div className="ide-editor bg-bg">
      <TabBar />
      <div className={cn("min-h-0 min-w-0", split ? "ide-preview-split" : "flex min-h-0 flex-col")}>
        {pending && !running && !split && <DiffBar edit={pending} />}
        <div className={cn("relative min-h-0 min-w-0", split && "ide-code")}>
          <div className="absolute inset-0">
            <CodePane />
          </div>
          {!split && <GenerateOverlay />}
          {!split && <SelectionActions />}
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
      </div>
    </div>
  );
}
