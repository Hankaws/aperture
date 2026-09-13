import assert from "node:assert/strict";
import { test } from "node:test";
import { isReadTool, parseCall, partitionCalls } from "./parallel.ts";

test("read tools batch; edits stay serial", () => {
  assert.equal(isReadTool("grep"), true);
  assert.equal(isReadTool("propose_edit"), false);
  const calls = [
    { id: "1", name: "grep", args: {} },
    { id: "2", name: "read_file", args: {} },
    { id: "3", name: "propose_edit", args: {} },
    { id: "4", name: "read_file", args: {} },
  ];
  const batches = partitionCalls(calls);
  assert.equal(batches.length, 3);
  assert.deepEqual(
    batches.map((b) => b.map((c) => c.name)),
    [["grep", "read_file"], ["propose_edit"], ["read_file"]],
  );
});

test("parseCall survives bad json", () => {
  const call = parseCall({ id: "x", function: { name: "grep", arguments: "{not json" } });
  assert.equal(call.name, "grep");
  assert.deepEqual(call.args, {});
});
