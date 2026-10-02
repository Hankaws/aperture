import { isPrivateAddress } from "../agent/custom-endpoint.ts";

export type McpServerView = { id: string; name: string; url: string; hasToken: boolean };

export type McpToolInfo = {
  server: string;
  name: string;
  description: string;
  readOnly: boolean;
};

/** HTTPS on a public host, path kept. No userinfo, no private address. */
export function cleanMcpUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host || isPrivateAddress(host)) return null;
  url.hash = "";
  return url.toString();
}

export function cleanMcpName(raw: string): string | null {
  const name = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._@-]{0,40}$/.test(name)) return null;
  return name;
}

/** A token is optional. When present it must be a single header value. */
export function cleanMcpToken(raw: string): string | null {
  const token = raw.trim();
  if (!token) return null;
  if (token.length > 512 || /[\s]/.test(token)) return null;
  return token;
}

/**
 * Without an explicit hint, only tools whose names are obviously reads run
 * immediately. Everything else waits for the same confirm step as a file edit.
 */
export function mcpReadOnly(name: string, hint?: boolean): boolean {
  if (hint === true) return true;
  if (hint === false) return false;
  return /^(get|list|search|read|fetch|find|query)([-_]|$)/i.test(name);
}

export function parseMcpPayload(text: string): { result?: unknown; error?: string } | null {
  const body = text.trim();
  const jsonText = body.startsWith("{")
    ? body
    : (body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .find((line) => line.startsWith("{")) ?? "");
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as { result?: unknown; error?: { message?: string } };
    if (parsed.error) return { error: parsed.error.message || "MCP error" };
    return { result: parsed.result };
  } catch {
    return null;
  }
}

/** Text the agent can read from a tools/call result. */
export function mcpResultText(result: unknown): string {
  if (!result || typeof result !== "object") return String(result ?? "");
  const content = (result as { content?: Array<{ text?: string; type?: string }> }).content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  return JSON.stringify(result);
}

export function toolsFromList(server: string, result: unknown): McpToolInfo[] {
  const tools = (result as { tools?: unknown })?.tools;
  if (!Array.isArray(tools)) return [];
  const out: McpToolInfo[] = [];
  for (const tool of tools.slice(0, 40)) {
    if (!tool || typeof tool !== "object") continue;
    const name = String((tool as { name?: string }).name ?? "");
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(name)) continue;
    const hint = (tool as { annotations?: { readOnlyHint?: boolean } }).annotations?.readOnlyHint;
    out.push({
      server,
      name,
      description: String((tool as { description?: string }).description ?? "").slice(0, 160),
      readOnly: mcpReadOnly(name, typeof hint === "boolean" ? hint : undefined),
    });
  }
  return out;
}

export function formatMcpTools(tools: McpToolInfo[]): string {
  if (tools.length === 0) return "";
  const lines = tools.slice(0, 40).map((tool) => {
    const mode = tool.readOnly ? "runs now" : "needs confirm";
    return `- ${tool.server} / ${tool.name} (${mode})${tool.description ? `: ${tool.description}` : ""}`;
  });
  return `MCP tools:\n${lines.join("\n")}`;
}

export type ProjectMcpServer = { id: string; name: string; url: string; token: string | null };

const PROJECT_MCP_PATHS = [".mcp.json", ".cursor/mcp.json", "mcp.json"];

function tokenFrom(entry: Record<string, unknown>): string | null {
  if (typeof entry.token === "string") return cleanMcpToken(entry.token);
  const headers = entry.headers;
  if (!headers || typeof headers !== "object") return null;
  const auth = (headers as Record<string, unknown>).Authorization ?? (headers as Record<string, unknown>).authorization;
  if (typeof auth !== "string") return null;
  return cleanMcpToken(auth.replace(/^Bearer\s+/i, ""));
}

function oneServer(name: string, value: unknown): { server: ProjectMcpServer | null; skip: boolean } {
  if (!value || typeof value !== "object") return { server: null, skip: false };
  const entry = value as Record<string, unknown>;
  const cleanedName = cleanMcpName(name);
  if (!cleanedName) return { server: null, skip: false };
  const rawUrl = typeof entry.url === "string" ? entry.url : typeof entry.serverUrl === "string" ? entry.serverUrl : "";
  if (!rawUrl) return { server: null, skip: typeof entry.command === "string" };
  const url = cleanMcpUrl(rawUrl);
  if (!url) return { server: null, skip: true };
  const tokenAsked = typeof entry.token === "string" || (entry.headers && typeof entry.headers === "object");
  const token = tokenFrom(entry);
  if (tokenAsked && typeof entry.token === "string" && entry.token.trim() && !token) return { server: null, skip: true };
  return { server: { id: `proj_${cleanedName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name: cleanedName, url, token }, skip: false };
}

/**
 * Remote HTTPS servers declared by the project. A local `command` server is
 * skipped: this editor does not start processes from a repo file.
 * Account servers with the same name win later, when the two lists merge.
 */
export function projectMcpServers(files: Record<string, string>): { servers: ProjectMcpServer[]; skipped: string[] } {
  const path = PROJECT_MCP_PATHS.find((candidate) => typeof files[candidate] === "string");
  if (!path) return { servers: [], skipped: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(files[path] ?? "");
  } catch {
    return { servers: [], skipped: [] };
  }
  if (!parsed || typeof parsed !== "object") return { servers: [], skipped: [] };
  const body = parsed as Record<string, unknown>;
  const table = body.mcpServers ?? body.servers;
  const servers: ProjectMcpServer[] = [];
  const skipped: string[] = [];
  const take = (name: string, value: unknown) => {
    const { server, skip } = oneServer(name, value);
    if (server) servers.push(server);
    else if (skip) skipped.push(name);
  };
  if (Array.isArray(table)) {
    for (const entry of table) {
      if (!entry || typeof entry !== "object") continue;
      const name = String((entry as { name?: string }).name ?? "");
      take(name, entry);
    }
  } else if (table && typeof table === "object") {
    for (const [name, value] of Object.entries(table)) take(name, value);
  }
  return { servers: servers.slice(0, 8), skipped };
}

/** Account servers keep their name. Project servers fill the remaining slots. */
export function mergeMcpServers<T extends { name: string }>(account: T[], project: T[], max = 8): T[] {
  const out = account.slice(0, max);
  for (const server of project) {
    if (out.length >= max) break;
    if (out.some((row) => row.name.toLowerCase() === server.name.toLowerCase())) continue;
    out.push(server);
  }
  return out;
}
