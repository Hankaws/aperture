/** How to add Aperture's MCP server to each agent. Settings → Agents and /agents show the same text. */
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
      name: "Grok Bot or any MCP client",
      text: `Server URL: ${url}\nHeader: Authorization: Bearer ${token}`,
    },
  ];
}

/** What to tell the agent so it checks before it is done. */
export const AGENT_PROMPT =
  "Before you finish, call check_change on Aperture with the project's files and the new text of every file you changed. If a check is red, fix what it says and call check_change again until nothing is red. Then run the project's tests.";
