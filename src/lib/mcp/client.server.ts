import { lookup } from "node:dns/promises";
import { isPrivateAddress } from "@/lib/agent/custom-endpoint";
import { cleanMcpUrl, mcpResultText, parseMcpPayload, toolsFromList, type McpToolInfo } from "./config";

export type StoredMcpServer = { id: string; name: string; url: string; token: string | null };

const listed = new Map<string, { at: number; tools: McpToolInfo[] }>();

/** Refuses a public name that resolves to a private address. Returns the cleaned URL. */
export async function assertMcpUrl(raw: string): Promise<string> {
  const url = cleanMcpUrl(raw);
  if (!url) throw new Error("Use an https URL on a public host.");
  const host = new URL(url).hostname;
  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve that MCP server.");
  }
  if (records.length === 0 || records.some((rec) => isPrivateAddress(rec.address))) {
    throw new Error("That MCP server does not resolve to a public address.");
  }
  return url;
}

async function rpc(server: StoredMcpServer, method: string, params: unknown): Promise<unknown> {
  const res = await fetch(server.url, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(server.token ? { Authorization: `Bearer ${server.token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (res.status >= 300 && res.status < 400) throw new Error("The MCP server redirected. That is not allowed.");
  if (!res.ok) throw new Error(`The MCP server returned ${res.status}.`);
  const parsed = parseMcpPayload(await res.text());
  if (!parsed) throw new Error("The MCP server did not return JSON.");
  if (parsed.error) throw new Error(parsed.error);
  return parsed.result;
}

export async function listServerTools(server: StoredMcpServer): Promise<McpToolInfo[]> {
  const key = `${server.id}:${server.url}`;
  const hit = listed.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.tools;
  const result = await rpc(server, "tools/list", {});
  const tools = toolsFromList(server.name, result);
  listed.set(key, { at: Date.now(), tools });
  return tools;
}

export async function callServerTool(server: StoredMcpServer, name: string, args: unknown): Promise<string> {
  const result = await rpc(server, "tools/call", { name, arguments: args ?? {} });
  const text = mcpResultText(result).slice(0, 4000);
  return text || "(empty)";
}
