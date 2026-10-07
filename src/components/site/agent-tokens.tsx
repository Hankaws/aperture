import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authEnabled } from "@/lib/auth/client";
import { agentSetups } from "./agent-setup";
import { createAgentToken, listAgentTokens, revokeAgentToken } from "@/lib/mcp-server/tokens.api";
import type { AgentTokenView } from "@/lib/mcp-server/tokens.server";

function copy(value: string, what: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${what} copied`),
    () => toast.error(`Could not copy the ${what.toLowerCase()}`),
  );
}

function when(iso: string | null): string {
  if (!iso) return "never used";
  return `used ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

/** Settings → Agents: tokens that let an agent call Aperture's MCP server. */
export function AgentTokens() {
  const [tokens, setTokens] = useState<AgentTokenView[]>([]);
  const [name, setName] = useState("");
  const [made, setMade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("/api/mcp");

  useEffect(() => {
    setUrl(`${window.location.origin}/api/mcp`);
    if (!authEnabled) return;
    void listAgentTokens()
      .then(setTokens)
      .catch(() => setTokens([]));
  }, []);

  async function make() {
    setBusy(true);
    try {
      const result = await createAgentToken({ data: { name } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTokens(result.tokens);
      setMade(result.token);
      setName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not make a token");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      setTokens(await revokeAgentToken({ data: { id } }));
      toast.success("Token revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke");
    }
  }

  return (
    <div className="space-y-4" aria-label="Connect an agent" role="region">
      <div>
        <h2 className="text-xl font-medium tracking-tight">Connect an agent</h2>
        <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
          Let Grok Bot, Claude Code, Cursor or any MCP client check its own changes with Aperture
          before it applies them: Parses, Imports resolve and Types, the same checks as the editor,
          plus tests skipped or cut short. Nothing the agent sends is run or kept. Free on every
          plan.{" "}
          <Link to="/agents" className="text-fg underline-offset-2 hover:underline">
            How it works
          </Link>
        </p>
      </div>

      {!authEnabled ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          Sign-in is off on this site, so there is no account for an agent to connect to.
        </p>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium">MCP server</p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm">
              {url}
            </code>
            <Button size="sm" variant="outline" onClick={() => copy(url, "URL")}>
              Copy
            </Button>
          </div>

          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void make();
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Token name, e.g. Grok Bot"
              maxLength={60}
            />
            <Button type="submit" disabled={busy || name.trim().length === 0} className="sm:w-40">
              {busy ? "Making…" : "Make a token"}
            </Button>
          </form>

          {made && (
            <div className="mt-4 rounded-xl border border-ok/40 bg-bg p-4" data-agent-token-made>
              <p className="text-sm font-medium">Copy this token now</p>
              <p className="mt-1 text-xs text-subtle">
                Aperture keeps only a hash of it, so it cannot be shown again.
              </p>
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-sm" data-agent-token>
                  {made}
                </code>
                <Button size="sm" variant="outline" onClick={() => copy(made, "Token")}>
                  Copy
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {agentSetups(url, made ?? "<token>").map((setup) => (
              <div key={setup.name}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted">{setup.name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => copy(setup.text, "Setup")}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs whitespace-pre">
                  {setup.text}
                </pre>
              </div>
            ))}
          </div>

          <ul className="mt-5 space-y-2" aria-label="Agent tokens">
            {tokens.length === 0 ? (
              <li className="text-sm text-muted">No tokens yet.</li>
            ) : (
              tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{token.name}</p>
                    <p className="truncate font-mono text-xs text-subtle">
                      {token.hint} · {when(token.lastUsedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void revoke(token.id)}
                    aria-label={`Revoke ${token.name}`}
                  >
                    Revoke
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
