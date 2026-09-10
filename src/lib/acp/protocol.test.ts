import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSessionUpdates, parseJsonRpc } from "./protocol.ts";
import { mapAcpUpdates } from "./map.ts";

test("parseJsonRpc accepts requests and results", () => {
  const req = parseJsonRpc({ jsonrpc: "2.0", id: 1, method: "session/new", params: { cwd: "/" } });
  assert.equal(req && "method" in req ? req.method : "", "session/new");
  const res = parseJsonRpc({ jsonrpc: "2.0", id: 1, result: { sessionId: "s1" } });
  assert.equal(res && "result" in res ? (res.result as { sessionId: string }).sessionId : "", "s1");
  assert.equal(parseJsonRpc({ foo: 1 }), null);
});

test("collectSessionUpdates walks notifications and nested arrays", () => {
  const updates = collectSessionUpdates({
    jsonrpc: "2.0",
    id: 3,
    result: { stopReason: "end_turn" },
    updates: [
      { sessionUpdate: "plan", entries: [{ content: "Read store", status: "pending" }] },
      {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: "s1",
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "t1",
            title: "Edit",
            kind: "edit",
            content: [{ type: "diff", path: "src/store.ts", oldText: "a", newText: "b" }],
          },
        },
      },
    ],
  });
  assert.equal(updates[0]?.sessionUpdate, "plan");
  assert.equal(updates[1]?.sessionUpdate, "tool_call");
});

test("mapAcpUpdates turns plan + diff into Composer events", () => {
  const mapped = mapAcpUpdates(
    [
      { sessionUpdate: "plan", entries: [{ content: "Fix off-by-one", status: "in_progress" }] },
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Patching store." } },
      {
        sessionUpdate: "tool_call",
        toolCallId: "c1",
        title: "Edit",
        kind: "edit",
        locations: [{ path: "src/store.ts" }],
        content: [{ type: "diff", path: "src/store.ts", oldText: "return tasks", newText: "return tasks.slice(0)" }],
      },
    ],
    { "src/store.ts": "return tasks" },
  );
  assert.equal(mapped.plan[0]?.content, "Fix off-by-one");
  assert.equal(mapped.text, "Patching store.");
  assert.equal(mapped.edits[0]?.path, "src/store.ts");
  assert.equal(mapped.traces[0]?.name, "Edit");
  assert.ok(mapped.events.some((e) => e.type === "plan"));
  assert.ok(mapped.events.some((e) => e.type === "edits"));
});
