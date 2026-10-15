/** How to add Aperture's MCP server to each agent. Settings → Agents and the Bot page's Agents tab show the same text. */
export function agentSetups(url: string, token: string): Array<{ name: string; text: string }> {
  return [
    {
      name: "Claude Code",
      text: `claude mcp add --transport http aperture ${url} --header "Authorization: Bearer ${token}"`,
    },
    {
      name: "Cursor (.cursor/mcp.json)",
      text: JSON.stringify(
        { mcpServers: { aperture: { url, headers: { Authorization: `Bearer ${token}` } } } },
        null,
        2,
      ),
    },
    {
      name: "VS Code (.vscode/mcp.json)",
      text: JSON.stringify(
        {
          servers: {
            aperture: { type: "http", url, headers: { Authorization: `Bearer ${token}` } },
          },
        },
        null,
        2,
      ),
    },
    {
      name: "Grok Bot or any MCP client",
      text: `Server URL: ${url}\nHeader: Authorization: Bearer ${token}`,
    },
  ];
}

/** What to tell the agent so it checks before it is done. */
export const AGENT_PROMPT =
  "Before you finish, call check_change on Aperture with the project's files and the new text of every file you changed. If a check is red, fix what it says and call check_change again until nothing is red. Then run the project's tests.";

/** Base64 of a string's UTF-8 bytes, the same in the browser and in Node. */
function base64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Links that add Aperture's MCP server to an editor in one click, with the
 * token filled in. Only the editors' own deeplinks (`cursor://`, `vscode:`):
 * the browser hands them to the app on this computer, so the token never goes
 * to a website, as it would through Cursor's https install page.
 */
export function installLinks(url: string, token: string): Array<{ name: string; href: string }> {
  const headers = { Authorization: `Bearer ${token}` };
  const cursor = base64(JSON.stringify({ url, headers }));
  const vscode = JSON.stringify({ name: "aperture", type: "http", url, headers });
  return [
    {
      name: "Cursor",
      href: `cursor://anysphere.cursor-deeplink/mcp/install?name=aperture&config=${encodeURIComponent(cursor)}`,
    },
    { name: "VS Code", href: `vscode:mcp/install?${encodeURIComponent(vscode)}` },
  ];
}
