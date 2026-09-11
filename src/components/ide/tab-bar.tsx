import { useMemo } from "react";
import { FileCode, FileJson, FileText, X } from "lucide-react";
import { basename, cn, extOf } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import { pendingPathKey } from "@/lib/workspace/edits";

function tabIcon(path: string) {
  const ext = extOf(path);
  if (ext === "json") return FileJson;
  if (ext === "md") return FileText;
  return FileCode;
}

export function TabBar() {
  const openTabs = useWorkspace((s) => s.openTabs);
  const activePath = useWorkspace((s) => s.activePath);
  const setActive = useWorkspace((s) => s.setActive);
  const closeTab = useWorkspace((s) => s.closeTab);
  const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
  const pending = useMemo(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);

  if (openTabs.length === 0) {
    return <div className="h-10 border-b border-border bg-surface" />;
  }

  return (
    <div className="flex h-10 items-stretch overflow-x-auto border-b border-border bg-surface">
      {openTabs.map((path) => {
        const active = path === activePath;
        const Icon = tabIcon(path);
        const staged = pending.has(path);
        return (
          <div
            key={path}
            className={cn(
              "group relative flex min-w-0 shrink-0 items-center gap-1 border-r border-border px-2",
              active ? "bg-bg text-fg" : "text-muted hover:bg-elevated/50 hover:text-fg",
            )}
          >
            {active && <span className="absolute inset-x-0 bottom-0 h-px bg-accent" />}
            <button
              type="button"
              className="flex max-w-48 items-center gap-1.5 truncate px-1 py-2 text-sm"
              onClick={() => setActive(path)}
            >
              <Icon className="size-3.5 shrink-0 text-subtle" strokeWidth={1.6} />
              <span className="truncate">{basename(path)}</span>
              {staged && (
                <span className="size-1.5 shrink-0 rounded-full bg-ok" aria-label="Staged diff" />
              )}
            </button>
            <button
              type="button"
              aria-label={`Close ${basename(path)}`}
              className={cn(
                "flex size-6 items-center justify-center rounded-md hover:bg-elevated",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
              onClick={() => closeTab(path)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
