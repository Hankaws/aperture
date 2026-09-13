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

export function EditorColumn() {
  const pending = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
  const running = useWorkspace((s) => s.agentRunning);
  const activePath = useWorkspace((s) => s.activePath);
  const files = useWorkspace((s) => s.files);
  const previewOpen = useIdeUi((s) => s.designOpen);
  const markdown = Boolean(activePath && languageFromPath(activePath) === "markdown");
  const showMarkdown = previewOpen && markdown;
  const showDesign = previewOpen && !markdown;
  const body = activePath ? files[activePath] ?? "" : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <TabBar />
      {pending && !running && !previewOpen && <DiffBar edit={pending} />}
      <div className="relative min-h-0 flex-1">
        {showDesign ? (
          <DesignPane />
        ) : (
          <>
            <div className="absolute inset-0">
              {showMarkdown ? <MarkdownPreview text={body} /> : <CodePane />}
            </div>
            {!showMarkdown && <GenerateOverlay />}
            {!showMarkdown && <SelectionActions />}
          </>
        )}
      </div>
    </div>
  );
}
