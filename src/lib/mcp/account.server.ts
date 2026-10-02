import { cleanMcpName, cleanMcpToken, formatMcpTools, mergeMcpServers, mcpReadOnly, projectMcpServers, type McpServerView, type McpToolInfo } from "./config";
import { assertMcpUrl, callServerTool, listServerTools, type StoredMcpServer } from "./client.server";

const MAX_SERVERS = 8;

async function readServers(userId: string): Promise<StoredMcpServer[]> {
  const { decryptSecret } = await import("@/lib/security/secrets.server");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ mcp_json: string | null }>`
    select mcp_json from user_settings where user_id = ${userId}
  `;
  const raw = decryptSecret(rows[0]?.mcp_json ?? null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredMcpServer[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.id === "string" && typeof row.url === "string").slice(0, MAX_SERVERS);
  } catch {
    return [];
  }
}

async function writeServers(userId: string, servers: StoredMcpServer[]) {
  const { encryptSecret } = await import("@/lib/security/secrets.server");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const month = new Date().toISOString().slice(0, 7);
  await sql`
    insert into user_settings (user_id, plan, usage_month, model_source)
    values (${userId}, 'hobby', ${month}, 'hosted')
    on conflict (user_id) do nothing
  `;
  await sql`
    update user_settings
    set mcp_json = ${encryptSecret(JSON.stringify(servers.slice(0, MAX_SERVERS)))}, updated_at = now()
    where user_id = ${userId}
  `;
}

function view(server: StoredMcpServer): McpServerView {
  return { id: server.id, name: server.name, url: server.url, hasToken: Boolean(server.token) };
}

export async function listMcpViews(userId: string): Promise<{ servers: McpServerView[] }> {
  return { servers: (await readServers(userId)).map(view) };
}

export async function addMcpServer(
  userId: string,
  input: { name: string; url: string; token?: string },
): Promise<{ ok: true; servers: McpServerView[] } | { ok: false; error: string }> {
  const name = cleanMcpName(input.name);
  if (!name) return { ok: false, error: "Name the server with letters, numbers, or spaces." };
  let url: string;
  try {
    url = await assertMcpUrl(input.url);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That URL is not allowed." };
  }
  const token = input.token?.trim() ? cleanMcpToken(input.token) : null;
  if (input.token?.trim() && !token) return { ok: false, error: "That token is not a single header value." };
  const servers = await readServers(userId);
  if (servers.some((server) => server.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "A server with that name is already connected." };
  }
  if (servers.length >= MAX_SERVERS) return { ok: false, error: "Eight MCP servers is the limit." };
  servers.push({ id: `mcp_${crypto.randomUUID()}`, name, url, token });
  await writeServers(userId, servers);
  return { ok: true, servers: servers.map(view) };
}

export async function deleteMcpServer(userId: string, id: string): Promise<{ servers: McpServerView[] }> {
  const servers = (await readServers(userId)).filter((server) => server.id !== id);
  await writeServers(userId, servers);
  return { servers: servers.map(view) };
}

export async function runConfirmedMcp(
  userId: string,
  input: { server: string; tool: string; args: string },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const servers = await readServers(userId);
  const server = servers.find((row) => row.name.toLowerCase() === input.server.toLowerCase());
  if (!server) return { ok: false, error: "That MCP server is not connected." };
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(input.tool)) return { ok: false, error: "That tool name is not valid." };
  let args: unknown = {};
  try {
    args = input.args ? JSON.parse(input.args) : {};
  } catch {
    return { ok: false, error: "Those arguments are not JSON." };
  }
  try {
    return { ok: true, text: await callServerTool(server, input.tool, args) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The MCP server did not answer." };
  }
}

/** Tools the agent may call this turn. A server that does not answer is skipped. */
export async function mcpToolsFor(
  userId: string | undefined,
  files?: Record<string, string>,
): Promise<{ servers: StoredMcpServer[]; tools: McpToolInfo[]; note: string }> {
  const account = userId ? await readServers(userId) : [];
  const project = projectMcpServers(files ?? {});
  const fromProject: StoredMcpServer[] = [];
  const skipped = [...project.skipped];
  for (const server of project.servers) {
    try {
      const url = await assertMcpUrl(server.url);
      fromProject.push({ ...server, url });
    } catch {
      skipped.push(server.name);
    }
  }
  const servers = mergeMcpServers(account, fromProject);
  const skipNote = skipped.length > 0 ? `Skipped local MCP (${skipped.join(", ")}): only HTTPS servers load.` : "";
  if (servers.length === 0) return { servers, tools: [], note: skipNote };
  const lists = await Promise.all(
    servers.map(async (server) => {
      try {
        return await listServerTools(server);
      } catch {
        return [] as McpToolInfo[];
      }
    }),
  );
  const tools = lists.flat().slice(0, 40);
  const named = servers.map((server) => server.name).join(", ");
  const listed = tools.length > 0 ? formatMcpTools(tools) : `MCP servers connected: ${named}. Their tool lists did not load.`;
  const note = [listed, skipNote].filter(Boolean).join("\n");
  return { servers, tools, note };
}

export async function invokeMcp(
  servers: StoredMcpServer[],
  tools: McpToolInfo[],
  serverName: string,
  toolName: string,
  argsText: string,
): Promise<{ text: string; pending: boolean }> {
  const server = servers.find((row) => row.name.toLowerCase() === serverName.toLowerCase());
  if (!server) return { text: `No MCP server named ${serverName}.`, pending: false };
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(toolName)) return { text: "That tool name is not valid.", pending: false };
  const known = tools.find((tool) => tool.server === server.name && tool.name === toolName);
  const readOnly = known ? known.readOnly : mcpReadOnly(toolName);
  if (!readOnly) {
    return {
      text: `Staged ${server.name} / ${toolName}. The user confirms it before it runs, the same as a file edit.`,
      pending: true,
    };
  }
  let args: unknown = {};
  try {
    args = argsText ? JSON.parse(argsText) : {};
  } catch {
    return { text: "Those arguments are not JSON.", pending: false };
  }
  try {
    return { text: await callServerTool(server, toolName, args), pending: false };
  } catch (error) {
    return { text: error instanceof Error ? error.message : "The MCP server did not answer.", pending: false };
  }
}
