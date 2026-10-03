import { setModelSource, type AccountSnapshot } from "@/lib/billing/api";
import { PROVIDERS, type ModelSource } from "@/lib/billing/plans";
import type { AgentConnection } from "@/lib/acp/api";
import { BUILTIN_ACP } from "@/lib/acp/kinds";
import { cn } from "@/lib/utils";

export type RunTarget =
  | { kind: "model"; source: ModelSource }
  | { kind: "acp"; id: string; name: string; remote: boolean };

export function ModelPicker({
  account,
  target,
  onTarget,
  onAccount,
  agents,
}: {
  account: AccountSnapshot;
  target: RunTarget;
  onTarget: (next: RunTarget) => void;
  onAccount: (next: AccountSnapshot) => void;
  agents: AgentConnection[];
}) {
  async function pickModel(source: ModelSource) {
    onTarget({ kind: "model", source });
    try {
      onAccount(await setModelSource({ data: source }));
    } catch {
      // keep local pick
    }
  }

  return (
    <label className="relative min-w-0">
      <span className="sr-only">Model</span>
      <select
        className={cn(
          "h-7 max-w-[12.5rem] truncate rounded-md border border-border bg-bg px-1.5 text-[11px] text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        )}
        value={target.kind === "acp" ? `acp:${target.id}` : target.source}
        onChange={(e) => {
          const value = e.target.value;
          if (value.startsWith("acp:")) {
            const id = value.slice(4);
            const builtin = BUILTIN_ACP.find((a) => a.id === id);
            if (builtin) {
              onTarget({ kind: "acp", id: builtin.id, name: builtin.name, remote: false });
              return;
            }
            const agent = agents.find((a) => a.id === id);
            if (agent) onTarget({ kind: "acp", id: agent.id, name: agent.name, remote: true });
            return;
          }
          void pickModel(value as ModelSource);
        }}
      >
        <option value="hosted">Your Grok key</option>
        {PROVIDERS.map((provider) => (
          <option key={provider.id} value={provider.id} disabled={!account.keys[provider.id]?.set}>
            {account.keys[provider.id]?.set
              ? `Your ${provider.short}`
              : `${provider.short} (add key)`}
          </option>
        ))}
        <option value="custom" disabled={!account.custom?.base || !account.custom.model}>
          {account.custom?.model ? `Custom · ${account.custom.model}` : "Custom (set endpoint)"}
        </option>
        <optgroup label={account.acp ? "ACP · same diff UI" : "ACP (Pro)"}>
          {BUILTIN_ACP.map((agent) => (
            <option key={agent.id} value={`acp:${agent.id}`} disabled={!account.acp}>
              {agent.name}
            </option>
          ))}
          {agents.map((agent) => (
            <option key={agent.id} value={`acp:${agent.id}`}>
              {agent.name} · bridge
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
