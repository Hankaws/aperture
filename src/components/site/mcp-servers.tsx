import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mcpStatus, removeMcpServer, saveMcpServer } from "@/lib/mcp/api";
import type { McpServerView } from "@/lib/mcp/config";

/** Remote MCP servers on the signed-in account. Tokens stay on the server. */
export function McpServersCard() {
  const [servers, setServers] = useState<McpServerView[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void mcpStatus()
      .then((next) => {
        if (!cancel) setServers(next.servers);
      })
      .catch(() => {
        if (!cancel) setError("Could not load MCP servers.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const next = await saveMcpServer({ data: { name, url, token } });
      if (!next.ok) {
        setError(next.error);
        return;
      }
      setServers(next.servers);
      setName("");
      setUrl("");
      setToken("");
      toast.success("MCP server connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const next = await removeMcpServer({ data: { id } });
      setServers(next.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-medium">MCP</p>
      <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
        Connect a remote MCP server over HTTPS. A `.mcp.json` in the open project is picked up as well. Local
        command servers in that file are ignored. The agent can call the tools. Reads run immediately. Anything that
        changes state waits for you to confirm, the same as a file edit.
      </p>
      {servers.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {servers.map((server) => (
            <li key={server.id} className="flex items-center justify-between gap-2 px-2 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="font-medium">{server.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{server.url}</span>
              </span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(server.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name, e.g. Linear" />
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://mcp.example.com/mcp"
          className="font-mono text-[13px]"
          spellCheck={false}
        />
        <Input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Bearer token, optional"
          className="font-mono"
        />
        <div>
          <Button type="submit" size="sm" disabled={busy || !name.trim() || !url.trim()}>
            {busy ? "Saving…" : "Connect"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
