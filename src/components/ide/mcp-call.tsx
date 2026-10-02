import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmMcpCall } from "@/lib/mcp/api";
import { submitAgent } from "@/lib/agent/run";
import { useWorkspace } from "@/lib/workspace/store";
import type { McpCall } from "@/lib/workspace/types";

/** A staged MCP write. Nothing runs until Confirm. */
export function McpCallList({ messageId, calls }: { messageId: string; calls: McpCall[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  function patch(id: string, next: Partial<McpCall>) {
    const message = useWorkspace.getState().messages.find((row) => row.id === messageId);
    if (!message?.mcpCalls) return;
    useWorkspace.getState().patchMessage(messageId, {
      mcpCalls: message.mcpCalls.map((call) => (call.id === id ? { ...call, ...next } : call)),
    });
  }

  async function confirm(call: McpCall) {
    setBusy(call.id);
    try {
      const result = await confirmMcpCall({ data: { server: call.server, tool: call.tool, args: call.args } });
      if (!result.ok) {
        patch(call.id, { status: "failed", result: result.error });
        return;
      }
      patch(call.id, { status: "done", result: result.text });
    } catch (error) {
      patch(call.id, { status: "failed", result: error instanceof Error ? error.message : "Could not reach the server." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="mt-2 space-y-2">
      {calls.map((call) => (
        <li key={call.id} className="rounded-xl border border-border bg-bg px-3 py-2">
          <p className="font-mono text-[12px]">
            {call.server} / {call.tool}
          </p>
          {call.args && call.args !== "{}" && (
            <p className="mt-1 truncate font-mono text-[11px] text-muted" title={call.args}>
              {call.args}
            </p>
          )}
          {call.status === "pending" && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy !== null} onClick={() => void confirm(call)}>
                {busy === call.id ? "Running…" : "Confirm"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => patch(call.id, { status: "rejected" })}>
                Cancel
              </Button>
            </div>
          )}
          {call.status === "rejected" && <p className="mt-1 text-[12px] text-muted">Cancelled. Nothing ran.</p>}
          {call.result && (
            <pre className="mt-2 max-h-32 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-muted">{call.result}</pre>
          )}
          {call.status === "done" && call.result && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() =>
                void submitAgent(`MCP ${call.server} / ${call.tool} returned:\n${call.result}\n\nContinue from this.`, "composer")
              }
            >
              Continue with this
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
