import { TabBar } from "./tab-bar";
import { CodePane } from "./code-pane";
import { DiffBar } from "./diff-bar";
import { GenerateOverlay } from "./generate-overlay";
import { SelectionActions } from "./selection-actions";
import { languageLabel } from "@/lib/parser/language";
import { hasCodeRange, pendingEditFor } from "@/lib/workspace/edits";
import { useWorkspace } from "@/lib/workspace/store";

export function EditorColumn() {
  const pending = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
  const running = useWorkspace((s) => s.agentRunning);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabBar />
      {pending && !running && <DiffBar edit={pending} />}
      {!pending && <EditorHint />}
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

function EditorHint() {
  const activePath = useWorkspace((s) => s.activePath);
  const selection = useWorkspace((s) => s.selection);
  if (!activePath) return null;
  const lang = languageLabel(activePath);
  const selected = hasCodeRange(selection) && selection?.path === activePath;
  const parts = activePath.split("/").filter(Boolean);

  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-bg px-3">
      <p className="min-w-0 flex-1 truncate font-mono text-xs">
        {parts.map((part, i) => (
          <span key={`${i}-${part}`}>
            {i > 0 && <span className="text-subtle"> / </span>}
            <span className={i === parts.length - 1 ? "text-fg" : "text-muted"}>{part}</span>
          </span>
        ))}
      </p>
      {lang ? <span className="hidden shrink-0 text-xs text-subtle sm:inline">{lang}</span> : null}
      <p className="hidden shrink-0 text-xs text-subtle md:inline">
        {selected ? "Explain or Fix this selection" : "Select code to Explain or Fix"}
      </p>
    </div>
  );
}
