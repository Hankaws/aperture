import assert from "node:assert/strict";
import test from "node:test";
import { cleanMcpUrl, formatMcpTools, mcpReadOnly, mergeMcpServers, parseMcpPayload, projectMcpServers, toolsFromList } from "./config.ts";

test("mcp urls are https and public", () => {
  assert.equal(cleanMcpUrl("https://mcp.example.com/rpc"), "https://mcp.example.com/rpc");
  assert.equal(cleanMcpUrl("http://127.0.0.1:3000/mcp"), null);
  assert.equal(cleanMcpUrl("https://10.0.0.5/mcp"), null);
  assert.equal(cleanMcpUrl("https://user:pass@example.com/mcp"), null);
});

test("reads run immediately and writes wait", () => {
  assert.equal(mcpReadOnly("search_issues"), true);
  assert.equal(mcpReadOnly("create_issue"), false);
  assert.equal(mcpReadOnly("create_issue", true), true);
  assert.equal(mcpReadOnly("search_issues", false), false);
});

test("a project mcp.json adds https servers and skips local commands", () => {
  const { servers, skipped } = projectMcpServers({
    ".mcp.json": JSON.stringify({
      mcpServers: {
        github: { url: "https://mcp.example.com/rpc" },
        local: { command: "npx", args: ["server"] },
        loop: { url: "http://127.0.0.1:9/mcp" },
      },
    }),
  });
  assert.equal(servers.length, 1);
  assert.equal(servers[0]?.name, "github");
  assert.deepEqual(skipped.sort(), ["local", "loop"]);
  const merged = mergeMcpServers(
    [{ id: "acct", name: "github", url: "https://account.example/mcp", token: null }],
    servers,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.url, "https://account.example/mcp");
});

test("tool list and payloads parse", () => {
  const tools = toolsFromList("github", {
    tools: [{ name: "search_issues", description: "Find issues", annotations: { readOnlyHint: true } }],
  });
  assert.equal(tools[0]?.readOnly, true);
  assert.match(formatMcpTools(tools), /github \/ search_issues/);
  const sse = parseMcpPayload('event: message\ndata: {"result":{"ok":true}}\n');
  assert.deepEqual(sse?.result, { ok: true });
});
