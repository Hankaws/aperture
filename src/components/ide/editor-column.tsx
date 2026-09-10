import { TabBar } from "./tab-bar";
import { CodePane } from "./code-pane";

export function EditorColumn() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabBar />
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <CodePane />
        </div>
      </div>
    </div>
  );
}
