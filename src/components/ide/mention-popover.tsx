import { FileCode, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MentionItem } from "@/lib/workspace/mentions";

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
    <ul className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-elevated py-1">
      {items.map((item, index) => {
        const Icon = item.kind === "folder" ? Folder : FileCode;
        return (
          <li key={`${item.kind}:${item.path}`}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]",
                index === active ? "bg-border text-fg" : "text-muted hover:bg-bg hover:text-fg",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate font-mono">{item.path}</span>
              <span className="ml-auto text-[10px] tracking-wide text-subtle uppercase">{item.kind}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
