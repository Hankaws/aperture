import assert from "node:assert/strict";
import test from "node:test";
import {
  ACP_KINDS,
  BUILTIN_ACP,
  acpAgentNames,
  acpLabel,
  acpSystemPreamble,
  builtinById,
  isAcpKind,
  isBuiltinAgentId,
} from "./kinds.ts";

test("Grok Build is a built-in seat", () => {
  const seat = builtinById("builtin:grok-build");
  assert.equal(seat?.kind, "grok-build");
  assert.equal(seat?.name, "Grok Build");
  assert.equal(isBuiltinAgentId("builtin:grok-build"), true);
  assert.equal(isAcpKind("grok-build"), true);
  assert.equal(acpLabel("grok-build"), "Grok Build");
});

test("isAcpKind tracks the list rather than a hand-written set", () => {
  for (const { id } of ACP_KINDS) assert.equal(isAcpKind(id), true, id);
  assert.equal(isAcpKind("not-a-kind"), false);
  assert.equal(isAcpKind(""), false);
});

test("every built-in kind carries a preamble", () => {
  // The guard that matters when the next seat is added: a built-in with no
  // preamble runs with an empty system prompt and behaves like a generic model.
  for (const agent of BUILTIN_ACP) {
    const preamble = acpSystemPreamble(agent.kind);
    assert.ok(preamble.length > 0, `${agent.kind} has no preamble`);
    assert.match(preamble, /Aperture/, `${agent.kind} does not say where it is running`);
    assert.match(preamble, /set_plan/, `${agent.kind} is not told to plan first`);
  }
});

test("an unknown or preamble-less kind yields an empty string, not a crash", () => {
  assert.equal(acpSystemPreamble("custom"), "");
  assert.equal(acpSystemPreamble("nonsense"), "");
  assert.equal(acpSystemPreamble("aperture"), "");
});

test("acpAgentNames renders the list for prose", () => {
  const names = BUILTIN_ACP.map((a) => a.name);
  assert.equal(acpAgentNames(), names.join(", "));
  assert.equal(acpAgentNames("and"), `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
  assert.equal(acpAgentNames("or"), `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
  assert.match(acpAgentNames("and"), /Grok Build$/);
});

test("every built-in id is an accepted agent reference", () => {
  for (const agent of BUILTIN_ACP) assert.equal(isBuiltinAgentId(agent.id), true, agent.id);
  assert.equal(isBuiltinAgentId("builtin:nope"), false);
});
