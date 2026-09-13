import { useMemo } from "react";
import { Eye, FileCode, FileJson, FileText, Pin, X } from "lucide-react";
import { basename, cn, extOf } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import { pendingPathKey } from "@/lib/workspace/edits";
import { useIdeUi } from "@/lib/ui-store";

function tabIcon(path: string) {
  const ext = extOf(path);
  if (ext === "json") return FileJson;
  if (ext === "md") return FileText;
  return FileCode;
}

export function PreviewToggle({ className }: { className?: string }) {
  const open = useIdeUi((s) => s.designOpen);
  const setOpen = useIdeUi((s) => s.setDesignOpen);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-pressed={open}
      aria-label={open ? "Close preview" : "Open preview"}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium",
        open ? "bg-accent text-bg" : "border border-border bg-elevated text-fg hover:bg-list-hover",
        className,
      )}
    >
      <Eye className="size-3.5" strokeWidth={2} />
      Preview
    </button>
  );
}

export function TabBar() {
  const openTabs = useWorkspace((s) => s.openTabs);
  const activePath = useWorkspace((s) => s.activePath);
  const previewPath = useWorkspace((s) => s.previewPath);
  const pinned = useWorkspace((s) => s.pinned);
  const dirtyPaths = useWorkspace((s) => s.dirtyPaths);
  const setActive = useWorkspace((s) => s.setActive);
  const closeTab = useWorkspace((s) => s.closeTab);
  const pinTab = useWorkspace((s) => s.pinTab);
  const openFile = useWorkspace((s) => s.openFile);
  const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
  const pending = useMemo(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);

  return (
    <div className="flex h-8 items-stretch border-b border-border bg-surface">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {openTabs.length === 0 ? (
          <span className="flex items-center px-3 text-xs text-subtle">Open a file from Workspace to start</span>
        ) : (
          openTabs.map((path) => {
            const active = path === activePath;
            const preview = path === previewPath;
            const isPinned = pinned.includes(path);
            const dirty = dirtyPaths.includes(path);
            const Icon = tabIcon(path);
            const staged = pending.has(path);
            return (
              <div
                key={path}
                className={cn(
                  "group relative flex min-w-0 shrink-0 items-center gap-0.5 border-r border-border px-1.5",
                  active ? "bg-bg text-fg" : "text-muted hover:bg-tab-hover hover:text-fg",
                )}
                onDoubleClick={() => openFile(path)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(path);
                  }
                }}
              >
                {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
                <button
                  type="button"
                  className="flex max-w-44 items-center gap-1 truncate px-1 py-1.5 text-xs"
                  title={preview ? "Preview tab — double-click to keep" : isPinned ? "Pinned" : basename(path)}
                  onClick={() => setActive(path)}
                >
                  {isPinned && <Pin className="size-3 shrink-0 text-subtle" strokeWidth={1.8} />}
                  <Icon className="size-3 shrink-0 text-subtle" strokeWidth={1.6} />
                  <span className={cn("truncate", active && "font-medium", preview && "italic text-muted")}>
                    {basename(path)}
                  </span>
                  {staged && <span className="size-1.5 shrink-0 rounded-full bg-ok" aria-label="Staged change" />}
                </button>
                <button
                  type="button"
                  aria-label={isPinned ? `Unpin ${basename(path)}` : `Pin ${basename(path)}`}
                  className="hidden size-6 items-center justify-center rounded-md text-subtle hover:bg-elevated hover:text-fg group-hover:flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    pinTab(path);
                  }}
                >
                  <Pin className={cn("size-3", isPinned && "text-fg")} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  aria-label={dirty ? `Unsaved · Close ${basename(path)}` : `Close ${basename(path)}`}
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-md hover:bg-elevated",
                    active || dirty ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  onClick={() => closeTab(path)}
                >
                  {dirty && <span className="size-1.5 rounded-full bg-tab-modified group-hover:opacity-0" />}
                  <X className={cn("size-3", dirty && "absolute opacity-0 group-hover:opacity-100")} />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="hidden shrink-0 items-center border-l border-border px-1.5 md:flex">
        <PreviewToggle />
      </div>
    </div>
  );
}
