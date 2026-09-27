import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  VercelSandboxRunner,
  sandboxMode,
  toSandboxFiles,
  type CreateSandbox,
  type SandboxHandle,
} from "./vercel.server.ts";

type Call = { cmd: string; args?: string[]; env?: Record<string, string>; timeoutMs?: number };

function fakeSandbox(results: { exitCode: number; output: string }[] | ((call: Call) => never)) {
  const log = { created: 0, stopped: 0, written: [] as { path: string; content: string }[], calls: [] as Call[] };
  const handle: SandboxHandle = {
    async writeFiles(files) {
      log.written.push(...files);
    },
    async runCommand(call) {
      log.calls.push(call);
      if (typeof results === "function") return results(call);
      const next = results[log.calls.length - 1] ?? { exitCode: 0, output: "" };
      return { exitCode: next.exitCode, output: async () => next.output };
    },
    async stop() {
      log.stopped += 1;
    },
  };
  const create: CreateSandbox = async () => {
    log.created += 1;
    return handle;
  };
  return { log, create };
}

const request = {
  files: { "package.json": '{"scripts":{"test":"node t.js"}}', "src/a.ts": "export const a = 1;" },
  steps: [
    { command: "npm", args: ["install"], label: "install" },
    { command: "npm", args: ["run", "test"], label: "test" },
  ],
  env: { CI: "1" },
  timeoutMs: 60_000,
};

test("writes the workspace, runs each step with the run's env, and stops the sandbox", async () => {
  const { log, create } = fakeSandbox([
    { exitCode: 0, output: "added 3 packages" },
    { exitCode: 0, output: "\u001b[32m1 passing\u001b[0m" },
  ]);
  const outcome = await new VercelSandboxRunner(create).run(request);
  assert.deepEqual(outcome, {
    ok: true,
    passed: true,
    steps: [
      { label: "install", exitCode: 0, output: "added 3 packages", durationMs: outcome.ok ? outcome.steps[0]!.durationMs : 0 },
      { label: "test", exitCode: 0, output: "1 passing", durationMs: outcome.ok ? outcome.steps[1]!.durationMs : 0 },
    ],
  });
  assert.deepEqual(log.written.map((f) => f.path), ["package.json", "src/a.ts"]);
  assert.deepEqual(log.calls.map((c) => [c.cmd, ...(c.args ?? [])]), [["npm", "install"], ["npm", "run", "test"]]);
  assert.ok(log.calls.every((c) => c.env?.CI === "1"));
  assert.ok(log.calls.every((c) => (c.timeoutMs ?? 0) > 0 && (c.timeoutMs ?? 0) <= request.timeoutMs));
  assert.equal(log.stopped, 1);
});

test("a failed install stops the run and is reported as not passed", async () => {
  const { log, create } = fakeSandbox([{ exitCode: 1, output: "npm ERR! 404 left-padd" }]);
  const outcome = await new VercelSandboxRunner(create).run(request);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.passed, false);
  assert.equal(outcome.steps.length, 1);
  assert.equal(outcome.steps[0]!.output, "npm ERR! 404 left-padd");
  assert.equal(log.calls.length, 1);
  assert.equal(log.stopped, 1);
});

test("a sandbox that cannot start is an error, with only the first line of the message", async () => {
  const create: CreateSandbox = async () => {
    throw new Error("Could not get credentials from OIDC context.\nPlease make sure OIDC is set up");
  };
  const outcome = await new VercelSandboxRunner(create).run(request);
  assert.deepEqual(outcome, { ok: false, error: "The sandbox failed: Could not get credentials from OIDC context." });
});

test("a command that throws still stops the sandbox", async () => {
  const { log, create } = fakeSandbox(() => {
    throw new Error("connection reset");
  });
  const outcome = await new VercelSandboxRunner(create).run(request);
  assert.deepEqual(outcome, { ok: false, error: "The sandbox failed: connection reset" });
  assert.equal(log.stopped, 1);
});

test("a run cancelled before it starts never creates a sandbox", async () => {
  const controller = new AbortController();
  controller.abort();
  const { log, create } = fakeSandbox([]);
  const outcome = await new VercelSandboxRunner(create).run({ ...request, signal: controller.signal });
  assert.deepEqual(outcome, { ok: false, error: "Run cancelled." });
  assert.equal(log.created, 0);
});

test("a run cancelled mid-way stops at the next step and stops the sandbox", async () => {
  const controller = new AbortController();
  const { log, create } = fakeSandbox([{ exitCode: 0, output: "installed" }]);
  const runner = new VercelSandboxRunner(async (params) => {
    const handle = await create(params);
    return {
      ...handle,
      runCommand: async (call) => {
        const result = await handle.runCommand(call);
        controller.abort();
        return result;
      },
    };
  });
  const outcome = await runner.run({ ...request, signal: controller.signal });
  assert.deepEqual(outcome, { ok: false, error: "Run cancelled." });
  assert.equal(log.calls.length, 1);
  assert.equal(log.stopped, 1);
});

test("toSandboxFiles drops paths that would escape the project", () => {
  const files = toSandboxFiles({ "ok.txt": "a", "/etc/passwd": "b", "../up.txt": "c", "a/../../x": "d", "a/b.txt": "e" });
  assert.deepEqual(files.map((f) => f.path), ["ok.txt", "a/b.txt"]);
});

const ENV_KEYS = ["VERCEL_SANDBOX_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "APERTURE_SANDBOX", "VERCEL"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function setEnv(values: Record<string, string>) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

test("sandboxMode is off unless a deployment opts in", () => {
  setEnv({});
  assert.equal(sandboxMode(), null);
  // Merely running on Vercel is not consent to spend that project's compute.
  setEnv({ VERCEL: "1" });
  assert.equal(sandboxMode(), null);
  // The opt-in only means something on Vercel, where there is an OIDC identity.
  setEnv({ APERTURE_SANDBOX: "vercel-oidc" });
  assert.equal(sandboxMode(), null);
  setEnv({ APERTURE_SANDBOX: "vercel-oidc", VERCEL: "1" });
  assert.deepEqual(sandboxMode(), { kind: "oidc" });
});

test("sandboxMode uses a token only when all three parts are set", () => {
  setEnv({ VERCEL_SANDBOX_TOKEN: "t", VERCEL_TEAM_ID: "team_x" });
  assert.equal(sandboxMode(), null);
  setEnv({ VERCEL_SANDBOX_TOKEN: "t", VERCEL_TEAM_ID: "team_x", VERCEL_PROJECT_ID: "prj_y" });
  assert.deepEqual(sandboxMode(), { kind: "token", credentials: { token: "t", teamId: "team_x", projectId: "prj_y" } });
});
