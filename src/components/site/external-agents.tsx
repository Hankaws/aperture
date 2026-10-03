import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAgent, listAgents, saveAgent, type AgentConnection } from "@/lib/acp/api";
import { ACP_KINDS, BUILTIN_ACP, acpAgentNames, type AcpKind } from "@/lib/acp/kinds";
import type { AccountSnapshot } from "@/lib/billing/api";
import { showPricing } from "@/lib/billing/pricing-visible";
import { cn } from "@/lib/utils";

export function ExternalAgents({ account }: { account: AccountSnapshot }) {
  const [agents, setAgents] = useState<AgentConnection[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AcpKind>("claude-code");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account.acp) return;
    void listAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [account.acp]);

  if (!account.acp) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-medium tracking-tight">External agents</h2>
        <p className="mt-2 max-w-xl text-sm text-pretty text-muted">
          Pro runs {acpAgentNames("and")} as ACP sessions in Composer — plan, traces, and the same staged diffs.
          Pro is coming soon. Hobby has Composer, Chat, and Inline.
        </p>
        {showPricing && (
          <Link to="/pricing" className={cn(buttonVariants(), "mt-4")}>
            See plans
          </Link>
        )}
      </div>
    );
  }

  async function add() {
    setBusy(true);
    try {
      const next = await saveAgent({ data: { name, kind, endpoint, token } });
      setAgents(next);
      setName("");
      setEndpoint("");
      setToken("");
      toast.success("Bridge connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium tracking-tight">External agents</h2>
        <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
          Pick {acpAgentNames("or")} in the Composer model menu. They speak ACP in this panel — checklist, tool
          calls, staged diffs. A remote JSON-RPC bridge is optional if you already pay for a CLI.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {BUILTIN_ACP.map((agent) => (
          <li key={agent.id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">{agent.name}</p>
            <p className="mt-1 text-xs text-subtle">Built-in ACP · same diff UI · uses the model you pick</p>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-medium">Remote ACP bridge</p>
        <p className="mt-1 text-xs text-subtle">
          JSON-RPC: initialize → session/new → session/prompt. session/update plan and diff blocks land here. Falls
          back to POST aperture.acp.v1 {"{ text, edits }"}. No hosted turn.
        </p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AcpKind)}
              className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
            >
              {ACP_KINDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://bridge.example/acp"
            className="font-mono"
          />
          <Input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bearer token (optional)"
            className="font-mono"
          />
          <Button type="submit" disabled={busy || name.trim().length < 2 || endpoint.trim().length < 8} className="sm:w-40">
            {busy ? "Saving…" : "Add bridge"}
          </Button>
        </form>
      </div>

      <ul className="space-y-3">
        {agents.length === 0 ? (
          <li className="text-sm text-muted">No remote bridges. Built-in ACP is already in the Composer picker.</li>
        ) : (
          agents.map((agent) => (
            <li key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{agent.name}</p>
                <p className="truncate text-xs text-subtle">
                  {ACP_KINDS.find((k) => k.id === agent.kind)?.label} · {agent.endpoint}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    setAgents(await deleteAgent({ data: agent.id }));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not remove");
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
