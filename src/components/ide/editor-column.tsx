import { TabBar } from "./tab-bar";
import { CodePane } from "./code-pane";
import { DiffBar } from "./diff-bar";
import { GenerateOverlay } from "./generate-overlay";
import { SelectionActions } from "./selection-actions";
import { pendingEditFor } from "@/lib/workspace/edits";
import { useWorkspace } from "@/lib/workspace/store";

export function EditorColumn() {
  const pending = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
  const running = useWorkspace((s) => s.agentRunning);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <TabBar />
      {pending && !running && <DiffBar edit={pending} />}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <CodePane />
        </div>
        <GenerateOverlay />
        <SelectionActions />
      </div>
    </div>
  );
}
