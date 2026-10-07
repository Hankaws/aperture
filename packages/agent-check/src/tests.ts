/**
 * The project's own tests, run on this machine: `npm run <script>` in the
 * checkout. When they fail, the same script runs on the base in a separate
 * worktree, so a failure the change did not cause is reported as one.
 *
 * This runs the pull request's code. That is what a CI test step does anyway;
 * the action's README says to use it on `pull_request`, never on
 * `pull_request_target`, where the code would run with the base's secrets.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "./git.ts";

export type TestRun =
  { ran: false; reason: string } | { ran: true; passed: boolean; detail: string; evidence: string };

const FAILURE_LINE = /(✗|✖|×|\bFAIL\b|^not ok\b|AssertionError|\bError:|failed)/;

/** One line saying what failed, and the end of the output in full. */
export function summarizeOutput(
  output: string,
  code: number | null,
): { detail: string; evidence: string } {
  const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
  const first = lines.find((line) => FAILURE_LINE.test(line.trim()));
  const detail = (first?.trim() || `exited with code ${code ?? "unknown"}`).slice(0, 200);
  return { detail, evidence: lines.filter(Boolean).slice(-60).join("\n") };
}

function readScripts(cwd: string): { scripts: Record<string, string>; hasDeps: boolean } | string {
  let text: string;
  try {
    text = readFileSync(join(cwd, "package.json"), "utf8");
  } catch {
    return "there is no package.json at the root of the checkout.";
  }
  try {
    const pkg = JSON.parse(text) as {
      scripts?: Record<string, string>;
      dependencies?: object;
      devDependencies?: object;
    };
    const hasDeps =
      Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length >
      0;
    return { scripts: pkg.scripts ?? {}, hasDeps };
  } catch {
    return "package.json is not valid JSON.";
  }
}

/** Whether `npm run <script>` can run in `cwd`, or why not. */
export function testsRunnable(cwd: string, script: string): string | null {
  const pkg = readScripts(cwd);
  if (typeof pkg === "string") return pkg;
  if (!pkg.scripts[script]) return `package.json has no "${script}" script.`;
  if (pkg.hasDeps && !existsSync(join(cwd, "node_modules"))) {
    return "the dependencies are not installed. Run npm ci (or your package manager's install) before this step.";
  }
  return null;
}

/**
 * The environment the project's tests get. NODE_TEST_CONTEXT is dropped: when
 * this tool itself runs under `node --test`, a project's `node --test` would
 * inherit it and report to a parent runner that is not listening, so its
 * failures would go unseen.
 */
export function testEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { NODE_TEST_CONTEXT: _parent, ...rest } = env;
  return { ...rest, CI: "true", FORCE_COLOR: "0", NO_COLOR: "1" };
}

export function runTests(cwd: string, script: string, timeoutMs: number): TestRun {
  const why = testsRunnable(cwd, script);
  if (why) return { ran: false, reason: why };
  const run = spawnSync("npm", ["run", script], {
    cwd,
    env: testEnv(process.env),
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  if (run.error && (run.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    return {
      ran: true,
      passed: false,
      detail: `did not finish in ${Math.round(timeoutMs / 60_000)} minutes.`,
      evidence: `${run.stdout ?? ""}${run.stderr ?? ""}`.split("\n").slice(-60).join("\n"),
    };
  }
  if (run.error) return { ran: false, reason: `npm could not be started: ${run.error.message}` };
  if (run.status === 0) return { ran: true, passed: true, detail: "", evidence: "" };
  return {
    ran: true,
    passed: false,
    ...summarizeOutput(`${run.stdout ?? ""}\n${run.stderr ?? ""}`, run.status),
  };
}

/**
 * The same script on the base, in a throwaway worktree that borrows this
 * checkout's node_modules. Null when it could not be set up.
 */
export function runTestsAtBase(
  cwd: string,
  rev: string,
  script: string,
  timeoutMs: number,
): TestRun | null {
  const dir = mkdtempSync(join(tmpdir(), "aperture-agent-check-"));
  try {
    git(["worktree", "add", "--detach", "--force", dir, rev], cwd);
  } catch {
    rmSync(dir, { recursive: true, force: true });
    return null;
  }
  try {
    const modules = join(cwd, "node_modules");
    if (existsSync(modules) && !existsSync(join(dir, "node_modules")))
      symlinkSync(modules, join(dir, "node_modules"), "dir");
    return runTests(dir, script, timeoutMs);
  } finally {
    try {
      git(["worktree", "remove", "--force", dir], cwd);
    } catch {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
