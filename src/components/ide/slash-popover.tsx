import { BookOpen, Search, Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlashHit } from "@/lib/agent/slash";

function iconFor(item: SlashHit) {
  if (item.skill) return BookOpen;
  if (item.name === "fix") return Wrench;
  if (item.name === "explain") return Search;
  return Sparkles;
}

export function SlashPopover({
  items,
  active,
  onPick,
}: {
  items: SlashHit[];
  active: number;
  onPick: (item: SlashHit) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-elevated py-1">
      {items.map((item, index) => {
        const Icon = iconFor(item);
        return (
          <li key={`${item.skill ? "skill" : "command"}:${item.name}`}>
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
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[13px] text-fg">/{item.name}</span>
                  {item.skill && <span className="text-[10px] tracking-wide text-subtle uppercase">skill</span>}
                </span>
                <span className="block text-[11px] leading-snug text-subtle">{item.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
