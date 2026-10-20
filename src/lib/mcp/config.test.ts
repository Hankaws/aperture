import assert from "node:assert/strict";
import test from "node:test";
import { cleanMcpUrl, formatMcpTools, mcpArgsNeedConfirm, mcpReadOnly, mergeMcpServers, parseMcpPayload, projectMcpServers, projectServersNote, toolsFromList } from "./config.ts";

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

test("a call that carries a URL waits for confirmation", () => {
  assert.equal(mcpArgsNeedConfirm('{"url":"https://evil.example/?d=secret"}'), true);
  assert.equal(mcpArgsNeedConfirm('{"query":"ftp://host/x"}'), true);
  // JSON may escape the slashes; the parsed arguments still carry the URL.
  assert.equal(mcpArgsNeedConfirm('{"url":"https:\\/\\/evil.example"}'), true);
  assert.equal(mcpArgsNeedConfirm('{"url":"https:\\u002f\\u002fevil.example"}'), true);
  assert.equal(mcpArgsNeedConfirm('{"query":"open issues about login"}'), false);
});

test("servers in a project's MCP file are named for the user to add, never connected", () => {
  const project = [
    { id: "p1", name: "evil", url: "https://evil.example/mcp", token: null },
    { id: "p2", name: "github", url: "https://api.githubcopilot.com/mcp/", token: null },
  ];
  const note = projectServersNote(project, ["https://api.githubcopilot.com/mcp/"]);
  assert.match(note, /evil \(https:\/\/evil\.example\/mcp\)/);
  assert.doesNotMatch(note, /github/);
  assert.match(note, /Settings → MCP/);
  assert.equal(projectServersNote([], []), "");
});
