import { useWorkspace } from "@/lib/workspace/store";
import { languageFromPath } from "@/lib/parser/language";
import { modSymbol } from "@/lib/utils";
import type { AccountSnapshot } from "@/lib/billing/api";

function tabLabel(account: AccountSnapshot | null | undefined) {
  if (!account?.tab) return "Tab · Pro";
  const keyed = account.modelSource !== "hosted" && account.keys[account.modelSource]?.set;
  if (keyed) return "Tab · your key";
  return `Tab ${account.tabRemaining}/${account.tabCap}`;
}

export function StatusBar({ aiLabel, account }: { aiLabel: string; account?: AccountSnapshot | null }) {
  const activePath = useWorkspace((s) => s.activePath);
  const chunks = useWorkspace((s) => s.chunks);
  const indexing = useWorkspace((s) => s.indexing);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const files = useWorkspace((s) => s.files);
  const selection = useWorkspace((s) => s.selection);
  const lang = activePath ? languageFromPath(activePath) : "";
  const mod = modSymbol();
  const line = selection && selection.path === activePath ? selection.fromLine : null;

  return (
    <div className="flex h-8 items-center justify-between gap-3 border-t border-border bg-surface px-3 text-xs text-subtle">
      <div className="flex min-w-0 items-center gap-3">
        <span className={indexing || agentRunning ? "shimmer-text" : ""}>
          {agentRunning ? "Agent running" : indexing ? "Indexing…" : "Ready"}
        </span>
        <span className="tabular-nums">
          {Object.keys(files).length} files · {chunks.length} chunks
        </span>
        {activePath && <span className="hidden truncate sm:inline">{activePath}</span>}
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        {line != null && <span className="tabular-nums">Ln {line}</span>}
        {lang && <span className="uppercase">{lang}</span>}
        <span>{aiLabel}</span>
        <span>{tabLabel(account)}</span>
        <span>
          {mod}I agent · {mod}K edit · {mod}P files
        </span>
      </div>
    </div>
  );
}
