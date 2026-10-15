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
  needsToken,
  OPEN_METHODS,
  readCheckInput,
  serve,
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

// Discovery without a token, everything else with one.

const GOOD = "user-1";
const rpc = (method: string, id: number | null = 1, params?: unknown) => ({
  jsonrpc: "2.0",
  ...(id === null ? {} : { id }),
  method,
  ...(params ? { params } : {}),
});
const smallCall = (id = 1) =>
  call(
    { files: { "a.ts": "export const a = 1;\n" }, changes: { "a.ts": "export const a = 2;\n" } },
    id,
  );

/** serve() with a caller holding `user` (null: no account), recording what it asked. */
async function served(body: unknown, user: string | null, presented = false) {
  let signIns = 0;
  const users: (string | null)[] = [];
  const checks: CheckInput[] = [];
  const out = await serve(
    body,
    async () => {
      signIns++;
      return user;
    },
    (userId) => {
      users.push(userId);
      return ctx({
        check: async (input) => {
          checks.push(input);
          return nodeCheck(input);
        },
      });
    },
    presented,
  );
  return { ...out, signIns, users, checks, answer: out.body as any };
}

test("initialize and tools/list answer without a token, and never look one up", async () => {
  const init = await served(rpc("initialize", 1, { protocolVersion: "2025-06-18" }), null);
  assert.equal(init.status, 200);
  assert.equal(init.answer.result.serverInfo.name, "aperture");
  assert.equal(init.signIns, 0);
  assert.deepEqual(init.users, [null]);

  const list = await served(rpc("tools/list", 2), null);
  assert.equal(list.status, 200);
  assert.equal(list.signIns, 0);
  assert.deepEqual(
    list.answer.result.tools.map((tool: { name: string }) => tool.name),
    ["check_change"],
  );
});

test("tools/list is the same static list with or without a token", async () => {
  const open = await served(rpc("tools/list"), null);
  const signedIn = await served(rpc("tools/list"), GOOD);
  assert.deepEqual(open.answer, signedIn.answer);
  assert.deepEqual(open.answer.result.tools, [CHECK_TOOL]);
});

test("ping and notifications/initialized need no token", async () => {
  const ping = await served(rpc("ping", 3), null);
  assert.equal(ping.status, 200);
  assert.deepEqual(ping.answer.result, {});
  const note = await served(rpc("notifications/initialized", null), null);
  assert.equal(note.status, 202);
  assert.equal(note.signIns, 0);
});

test("prompts/list and resources/list need no token and say there are none", async () => {
  for (const method of ["prompts/list", "resources/list"]) {
    const out = await served(rpc(method, 4), null);
    assert.equal(out.status, 200);
    assert.equal(out.answer.error.code, -32601);
  }
});

test("tools/call without a token is a 401 JSON-RPC error, and nothing runs", async () => {
  const out = await served(smallCall(7), null);
  assert.equal(out.status, 401);
  assert.equal(out.signIns, 1);
  assert.deepEqual(out.users, []);
  assert.equal(out.checks.length, 0);
  assert.equal(out.answer.jsonrpc, "2.0");
  assert.equal(out.answer.id, 7);
  assert.equal(out.answer.error.code, -32001);
  assert.match(out.answer.error.message, /Bearer/);
});

test("a token that matches no account gets a 401 that says so, not that one is missing", async () => {
  const out = await served(smallCall(8), null, true);
  assert.equal(out.status, 401);
  assert.equal(out.checks.length, 0);
  assert.equal(out.answer.id, 8);
  assert.equal(out.answer.error.code, -32001);
  assert.match(out.answer.error.message, /not valid: it was revoked, or it is mistyped/);
  assert.doesNotMatch(out.answer.error.message, /needs an agent token/);

  const missing = await served(smallCall(9), null);
  assert.match(missing.answer.error.message, /needs an agent token/);
  // An open method never looks at the token, valid or not.
  const list = await served(rpc("tools/list", 10), null, true);
  assert.equal(list.status, 200);
  assert.equal(list.signIns, 0);
});

test("tools/call with a token runs the checks for that account", async () => {
  const out = await served(smallCall(8), GOOD);
  assert.equal(out.status, 200);
  assert.deepEqual(out.users, [GOOD]);
  assert.equal(out.checks.length, 1);
  assert.equal(out.answer.id, 8);
  assert.equal(out.answer.result.isError, false);
});

test("methods outside the open list need a token, unknown ones included", async () => {
  for (const method of [
    "tools/call",
    "resources/read",
    "prompts/get",
    "logging/setLevel",
    "made/up",
  ])
    assert.equal(needsToken(rpc(method)), true, method);
  for (const method of OPEN_METHODS) assert.equal(needsToken(rpc(method)), false, method);
  assert.equal(needsToken({ jsonrpc: "2.0", id: 1, result: {} }), false);
  assert.equal(needsToken("garbage"), false);
});

test("a batch mixing tools/list and tools/call is refused whole without a token", async () => {
  const out = await served([rpc("tools/list", 1), smallCall(2)], null);
  assert.equal(out.status, 401);
  assert.equal(out.answer.id, null);
  assert.equal(out.answer.error.code, -32001);
  assert.equal(out.checks.length, 0);
  assert.deepEqual(out.users, []);
});

test("a tools/call hidden past the first 20 messages still needs a token", async () => {
  const batch = [...Array.from({ length: 20 }, (_, i) => rpc("ping", i)), smallCall(99)];
  assert.equal((await served(batch, null)).status, 401);
});

test("a batch mixing tools/list and tools/call answers both with a token", async () => {
  const out = await served([rpc("tools/list", 1), smallCall(2)], GOOD);
  assert.equal(out.status, 200);
  assert.equal(out.answer.length, 2);
  assert.deepEqual(out.answer[0].result.tools, [CHECK_TOOL]);
  assert.equal(out.answer[1].result.isError, false);
  assert.equal(out.checks.length, 1);
});

test("an all-open batch answers without a token", async () => {
  const out = await served(
    [rpc("initialize", 1), rpc("notifications/initialized", null), rpc("tools/list", 2)],
    null,
  );
  assert.equal(out.status, 200);
  assert.equal(out.signIns, 0);
  assert.deepEqual(
    out.answer.map((a: { id: number }) => a.id),
    [1, 2],
  );
});
