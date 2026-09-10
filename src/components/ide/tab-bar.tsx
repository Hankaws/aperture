import { X } from "lucide-react";
import { basename, cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

export function TabBar() {
  const openTabs = useWorkspace((s) => s.openTabs);
  const activePath = useWorkspace((s) => s.activePath);
  const setActive = useWorkspace((s) => s.setActive);
  const closeTab = useWorkspace((s) => s.closeTab);

  if (openTabs.length === 0) {
    return <div className="h-10 border-b border-border bg-surface" />;
  }

  return (
    <div className="flex h-10 items-stretch overflow-x-auto border-b border-border bg-surface">
      {openTabs.map((path) => {
        const active = path === activePath;
        return (
          <div
            key={path}
            className={cn(
              "group flex min-w-0 shrink-0 items-center gap-1 border-r border-border px-2",
              active ? "bg-bg text-fg" : "text-muted hover:text-fg",
            )}
          >
            <button
              type="button"
              className="max-w-40 truncate px-1 py-2 text-[13px]"
              onClick={() => setActive(path)}
            >
              {basename(path)}
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
