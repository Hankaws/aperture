import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { applySearchReplace } from "../agent/apply-edit.ts";
import { CASES, FIXTURES } from "../bench/cases.ts";
import type { CheckRow } from "../workspace/checks.ts";
import { staticChangeChecks } from "../workspace/static-checks.ts";
import type { TscCache } from "../workspace/tsc-core.ts";
import {
  CHECK_LIMITS,
  CHECK_TOOL,
  handleMessage,
  PROTOCOL_VERSIONS,
  readCheckInput,
  type CheckInput,
  type ServerContext,
} from "./protocol.ts";
import { AGENT_STOPS } from "./example.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (name: string) => {
  try {
    return readFileSync(join(libDir, name), "utf8");
  } catch {
    return undefined;
  }
};
const cache: TscCache = new Map();

/** What check.server.ts does, with the library files read from disk. */
async function nodeCheck(input: CheckInput): Promise<CheckRow[]> {
  return staticChangeChecks({
    tsc: ts,
    readLib,
    cache,
    before: input.files,
    changes: input.changes,
    tests: { state: "unsupported", reason: "this server does not run code." },
  });
}

const ctx = (over: Partial<ServerContext> = {}): ServerContext => ({
  version: "9.9.9",
  check: nodeCheck,
  busy: () => null,
  ...over,
});
const call = (args: unknown, id = 1) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name: "check_change", arguments: args },
});

type Answer = { result?: Record<string, any>; error?: { code: number; message: string } };
const ask = async (message: unknown, c = ctx()) =>
  (await handleMessage(message, c)) as Answer | null;

test("initialize answers with the version asked for when it is supported, else the newest", async () => {
  const older = await ask({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26" },
  });
  assert.equal(older?.result?.protocolVersion, "2025-03-26");
  assert.deepEqual(older?.result?.serverInfo, {
    name: "aperture",
    title: "Aperture",
    version: "9.9.9",
  });
  assert.deepEqual(older?.result?.capabilities, { tools: { listChanged: false } });
  const unknown = await ask({
    jsonrpc: "2.0",
    id: 2,
    method: "initialize",
    params: { protocolVersion: "1999-01-01" },
  });
  assert.equal(unknown?.result?.protocolVersion, PROTOCOL_VERSIONS[0]);
});

test("notifications get no answer; ping, tools/list and unknown methods do", async () => {
  assert.equal(await ask({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.deepEqual((await ask({ jsonrpc: "2.0", id: "a", method: "ping" }))?.result, {});
  const list = await ask({ jsonrpc: "2.0", id: 3, method: "tools/list" });
  assert.deepEqual(
    list?.result?.tools.map((tool: { name: string }) => tool.name),
    ["check_change"],
  );
  assert.equal(CHECK_TOOL.annotations.readOnlyHint, true);
  assert.equal(
    (await ask({ jsonrpc: "2.0", id: 4, method: "resources/list" }))?.error?.code,
    -32601,
  );
  assert.equal(
    (await ask({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "rm_rf" } }))?.error
      ?.code,
    -32602,
  );
  assert.equal((await ask({ id: 6, method: "ping" }))?.error?.code, -32600);
  assert.equal((await ask("ping"))?.error?.code, -32600);
});

test("check_change refuses paths outside the project, non-text files and oversize input", () => {
  for (const path of [
    "../x.ts",
    "/etc/passwd",
    "a/../../b.ts",
    "a\\b.ts",
    "a//b.ts",
    "./a.ts",
    "",
  ]) {
    const read = readCheckInput({ files: {}, changes: { [path]: "x" } });
    assert.equal(read.ok, false, path);
  }
  assert.equal(readCheckInput({ files: { "a.ts": 1 }, changes: { "a.ts": "x" } }).ok, false);
  assert.equal(readCheckInput({ files: [], changes: { "a.ts": "x" } }).ok, false);
  assert.equal(
    readCheckInput({ files: { "a.ts": "x" }, changes: { "a.ts": "x" } }).ok,
    false,
    "no change",
  );
  const big = "x".repeat(CHECK_LIMITS.fileChars + 1);
  assert.equal(readCheckInput({ files: {}, changes: { "a.ts": big } }).ok, false);
  const many = Object.fromEntries(
    Array.from({ length: CHECK_LIMITS.files + 1 }, (_, i) => [`f${i}.ts`, ""]),
  );
  assert.equal(readCheckInput({ files: many, changes: { "a.ts": "x" } }).ok, false);
  const total = Object.fromEntries(
    Array.from({ length: 13 }, (_, i) => [`f${i}.ts`, "x".repeat(CHECK_LIMITS.fileChars)]),
  );
  assert.equal(readCheckInput({ files: total, changes: { "a.ts": "x" } }).ok, false);
  const ok = readCheckInput({ changes: { "src/a.ts": "export const a = 1;\n" } });
  assert.ok(ok.ok && ok.input.summary === "" && Object.keys(ok.input.files).length === 0);
});

test("a caller over its limit gets a tool error and no check runs", async () => {
  let ran = false;
  const answer = await ask(
    call({ files: {}, changes: { "a.ts": "x" } }),
    ctx({ busy: () => "Too many checks.", check: async () => ((ran = true), []) }),
  );
  assert.equal(answer?.result?.isError, true);
  assert.equal(answer?.result?.content[0].text, "Too many checks.");
  assert.equal(ran, false);
});

test("a red change says not to apply it and names the file and line", async () => {
  const files = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "ESNext",
        moduleResolution: "bundler",
        target: "ES2022",
      },
    }),
    "src/math.ts": "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
    "src/index.ts": 'import { add } from "./math";\nexport const total: number = add(1, 2);\n',
  };
  const answer = await ask(
    call({
      files,
      changes: {
        "src/math.ts":
          "export function add(a: number, b: number): string {\n  return String(a + b);\n}\n",
      },
    }),
  );
  const result = answer?.result;
  assert.equal(result?.isError, false);
  assert.equal(result?.structuredContent.verdict, "red");
  assert.match(result?.content[0].text, /^Do not apply this change as it is: 1 check red/);
  assert.match(result?.content[0].text, /src\/index\.ts: TS2322 at line 2/);
  assert.deepEqual(
    result?.structuredContent.checks.map((row: { id: string }) => row.id),
    ["parse", "imports", "types", "tests"],
  );
  assert.deepEqual(result?.structuredContent.notRun, [
    "tests: run the project's tests yourself",
    "page preview",
  ]);
});

test("every benchmark case gets the editor's verdict from check_change, except tests it would have to run", async () => {
  const published = JSON.parse(
    readFileSync(new URL("../bench/results.json", import.meta.url), "utf8"),
  ) as {
    cases: Array<{ id: string; detail: string | null; checks: Record<string, string> }>;
  };
  let stoppedBad = 0;
  let flaggedGood = 0;
  for (const item of CASES) {
    const before: Record<string, string> = { ...FIXTURES[item.fixture] };
    const after = { ...before };
    for (const edit of item.edits) {
      const applied = applySearchReplace(after[edit.path] ?? "", edit.search, edit.replace);
      assert.ok(applied.ok, `${item.id}: ${edit.path}`);
      after[edit.path] = applied.next;
    }
    const changes = Object.fromEntries(item.edits.map((edit) => [edit.path, after[edit.path]!]));
    const answer = await ask(call({ files: before, changes }));
    const rows = answer?.result?.structuredContent.checks as Array<{ id: string; status: string }>;
    const status = Object.fromEntries(rows.map((row) => [row.id, row.status]));
    const editor = published.cases.find((row) => row.id === item.id)!;
    for (const id of ["parse", "imports", "types"])
      assert.equal(status[id], editor.checks[id], `${item.id}: ${id}`);
    // Tampering is read from the change, so it is red here as in the editor; a failing run needs the run.
    const tampered =
      editor.checks.tests === "fail" && /^Not counted as a pass/.test(editor.detail ?? "");
    assert.equal(status.tests, tampered ? "fail" : "skip", `${item.id}: tests`);
    if (Object.values(status).includes("fail")) {
      if (item.kind === "bad") stoppedBad += 1;
      else flaggedGood += 1;
    }
  }
  // Of the 27 a check can see, the 7 behaviour mistakes need a test run. The editor's one false alarm is here too.
  assert.equal(stoppedBad, AGENT_STOPS, "/agents states AGENT_STOPS: update it in example.ts");
  assert.equal(flaggedGood, 1);
});
