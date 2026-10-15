import assert from "node:assert/strict";
import { test } from "node:test";
import { agentSetups, installLinks } from "./agent-setup.ts";

const URL_ = "https://aperturesais.grok.me/api/mcp";
const TOKEN = "apt_abc123";

test("the Cursor link carries the server config, base64 in the query, and opens Cursor itself", () => {
  const cursor = installLinks(URL_, TOKEN).find((link) => link.name === "Cursor")!;
  const href = new URL(cursor.href);
  assert.equal(href.protocol, "cursor:");
  assert.equal(href.searchParams.get("name"), "aperture");
  const config = JSON.parse(
    Buffer.from(href.searchParams.get("config")!, "base64").toString("utf8"),
  );
  assert.deepEqual(config, { url: URL_, headers: { Authorization: `Bearer ${TOKEN}` } });
});

test("the VS Code link carries a named http server with the token header", () => {
  const vscode = installLinks(URL_, TOKEN).find((link) => link.name === "VS Code")!;
  assert.ok(vscode.href.startsWith("vscode:mcp/install?"));
  const config = JSON.parse(decodeURIComponent(vscode.href.slice("vscode:mcp/install?".length)));
  assert.deepEqual(config, {
    name: "aperture",
    type: "http",
    url: URL_,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
});

test("no install link goes to a website, so the token stays on this computer", () => {
  for (const link of installLinks(URL_, TOKEN)) {
    assert.doesNotMatch(link.href, /^https?:/, link.name);
  }
});

test("the setups cover Claude Code, Cursor, VS Code and any client, each with the URL and token", () => {
  const setups = agentSetups(URL_, TOKEN);
  assert.deepEqual(
    setups.map((setup) => setup.name.split(" ")[0]),
    ["Claude", "Cursor", "VS", "Grok"],
  );
  for (const setup of setups) {
    assert.ok(setup.text.includes(URL_), setup.name);
    assert.ok(setup.text.includes(`Bearer ${TOKEN}`), setup.name);
  }
  const vscode = JSON.parse(setups[2]!.text);
  assert.equal(vscode.servers.aperture.type, "http");
});
