import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RUN_MS,
  MAX_RUN_MS,
  clampTimeout,
  declaredScripts,
  installCommand,
  isRunnable,
  planRun,
  runnableScripts,
  sandboxEnv,
  approvalForRun,
  SANDBOX_ALLOWED_DOMAINS,
} from "./policy.ts";

const pkg = (scripts: Record<string, string>) => ({
  "package.json": JSON.stringify({ name: "p", scripts }),
});

test("scripts come from package.json, and a broken one yields none", () => {
  assert.deepEqual(declaredScripts(pkg({ test: "node --test", build: "vite build" })).sort(), [
    "build",
    "test",
  ]);
  assert.deepEqual(declaredScripts({ "package.json": "{oops" }), []);
  assert.deepEqual(declaredScripts({}), []);
});

test("servers that never exit are not runnable", () => {
  // A run against `dev` can only end in the timeout, burning the budget to
  // learn nothing.
  const files = pkg({ dev: "vite", start: "node .", preview: "vite preview", test: "node --test" });
  assert.deepEqual(runnableScripts(files), ["test"]);
  for (const name of ["dev", "start", "preview"]) {
    assert.equal(isRunnable(files, name), false, name);
    const plan = planRun(files, name);
    assert.equal(plan.ok, false);
    assert.match(plan.ok ? "" : plan.error, /never exits/);
  }
});

test("an undeclared script is refused, and the refusal lists what exists", () => {
  const plan = planRun(pkg({ test: "node --test", lint: "eslint ." }), "typecheck");
  assert.equal(plan.ok, false);
  assert.match(plan.ok ? "" : plan.error, /No script named "typecheck"/);
  assert.match(plan.ok ? "" : plan.error, /lint, test/);
});

test("a project with no package.json or no scripts cannot run", () => {
  const none = planRun({}, "test");
  assert.match(none.ok ? "" : none.error, /no package\.json/);
  const empty = planRun({ "package.json": '{"name":"p"}' }, "test");
  assert.match(empty.ok ? "" : empty.error, /no scripts/);
});

test("a runnable script plans install then the script", () => {
  const plan = planRun(pkg({ test: "node --test" }), "test");
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(
    plan.steps.map((s) => `${s.command} ${s.args.join(" ")}`),
    ["npm install --no-audit --no-fund", "npm run test"],
  );
});

test("a lockfile makes the install reproducible", () => {
  assert.deepEqual(installCommand({}).args, ["install", "--no-audit", "--no-fund"]);
  assert.deepEqual(installCommand({ "package-lock.json": "{}" }).args, ["ci", "--no-audit", "--no-fund"]);
  const planned = planRun({ ...pkg({ test: "x" }), "package-lock.json": "{}" }, "test");
  assert.equal(planned.ok && planned.steps[0]!.args[0], "ci");
});

test("the sandbox environment carries nothing secret", () => {
  // The agent can author a package.json script and have it run, so anything
  // readable in there is public to whatever the agent writes.
  const env = sandboxEnv();
  const blob = JSON.stringify(env).toLowerCase();
  for (const leak of ["key", "token", "secret", "password", "database_url", "session"]) {
    assert.equal(blob.includes(leak), false, `sandbox env mentions ${leak}`);
  }
  assert.equal(env.CI, "1");
  assert.equal(approvalForRun({ env, network: SANDBOX_ALLOWED_DOMAINS }).ok, true);
});

test("a secret or a host outside the registry allowlist needs approval", () => {
  const closed = approvalForRun({ env: { NPM_TOKEN: "1" }, network: SANDBOX_ALLOWED_DOMAINS });
  assert.equal(closed.ok, false);
  assert.match(closed.ok ? "" : closed.reason, /NPM_TOKEN/);
  const wider = approvalForRun({ env: sandboxEnv(), network: [...SANDBOX_ALLOWED_DOMAINS, "evil.example"] });
  assert.equal(wider.ok, false);
  assert.match(wider.ok ? "" : wider.reason, /evil\.example/);
  assert.match(wider.ok ? "" : wider.reason, /registry\.npmjs\.org/);
  const allowed = approvalForRun({
    env: { NPM_TOKEN: "1" },
    network: [...SANDBOX_ALLOWED_DOMAINS, "evil.example"],
    approved: true,
  });
  assert.equal(allowed.ok, true);
});

test("timeouts are clamped into a billable range", () => {
  assert.equal(clampTimeout(undefined), DEFAULT_RUN_MS);
  assert.equal(clampTimeout(Number.NaN), DEFAULT_RUN_MS);
  assert.equal(clampTimeout(1), 10_000);
  assert.equal(clampTimeout(9_999_999), MAX_RUN_MS);
  assert.equal(clampTimeout(60_000), 60_000);
});
