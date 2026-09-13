import { FileCode, Folder, Library, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MentionItem } from "@/lib/workspace/mentions";

function mentionIcon(item: MentionItem) {
  if (item.path === "codebase") return Library;
  if (item.path === "repo-map") return ListTree;
  if (item.kind === "folder") return Folder;
  return FileCode;
}

export function MentionPopover({
  items,
  active,
  onPick,
}: {
  items: MentionItem[];
  active: number;
  onPick: (item: MentionItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-elevated py-1">
      {items.map((item, index) => {
        const Icon = mentionIcon(item);
        return (
          <li key={`${item.kind}:${item.path}`}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
              }}
              className={cn(
                "flex w-full items-start gap-2 px-2.5 py-1.5 text-left",
                index === active ? "bg-list-focus text-fg" : "text-muted hover:bg-list-hover hover:text-fg",
              )}
            >
              <Icon className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.7} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px] text-fg">{item.path}</span>
                {item.description && (
                  <span className="block truncate text-[11px] leading-snug text-subtle">{item.description}</span>
                )}
              </span>
              <span className="mt-0.5 shrink-0 text-[10px] tracking-wide text-subtle uppercase">
                {item.kind === "source" ? "ctx" : item.kind}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
