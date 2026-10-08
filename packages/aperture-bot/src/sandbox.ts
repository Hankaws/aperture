/**
 * Where code the agent wrote runs: never next to the model key or the GitHub
 * token. Each run works on a throwaway copy of the project (without `.git` and
 * `node_modules`), so nothing it does reaches the checkout the bot commits from.
 *
 * - docker: a container with no network, an empty environment, and the
 *   project's installed packages mounted read-only.
 * - none: this machine, with only PATH and HOME in the environment. For trying
 *   the bot locally on your own task; the Action always uses docker.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { summarizeOutput, type TestRun, type TestRunner } from "../../agent-check/src/tests.ts";

/** Docker Hub's official Node image, through Google's mirror: no pull limits on shared runners. */
export const DEFAULT_IMAGE = "mirror.gcr.io/library/node:22-slim";

export type Sandbox = {
  kind: "docker" | "none";
  /** Where the run happened, for the report. */
  where: string;
  /** Runs `npm run <script>` on a copy of `dir` with `overlay` written over it. */
  run(
    dir: string,
    overlay: Record<string, string> | null,
    script: string,
    timeoutMs: number,
    modules: string,
  ): TestRun;
};

/** A copy of the project in `dir`, minus `.git` and `node_modules`, with `overlay` written over it. */
export function copyProject(dir: string, overlay: Record<string, string> | null): string {
  const work = mkdtempSync(join(tmpdir(), "aperture-bot-run-"));
  cpSync(dir, work, {
    recursive: true,
    filter: (src) => !["node_modules", ".git"].includes(basename(src)),
  });
  for (const [path, text] of Object.entries(overlay ?? {})) {
    const target = join(work, path);
    let current: string | null = null;
    try {
      current = readFileSync(target, "utf8");
    } catch {
      // A file the agent added.
    }
    if (current === text) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  return work;
}

/** Why `npm run <script>` cannot run in `work`, or null when it can. */
export function cannotRun(work: string, script: string, modules: string): string | null {
  let pkg: { scripts?: Record<string, string>; dependencies?: object; devDependencies?: object };
  try {
    pkg = JSON.parse(readFileSync(join(work, "package.json"), "utf8")) as typeof pkg;
  } catch {
    return "there is no readable package.json in the project.";
  }
  if (!pkg.scripts?.[script]) return `package.json has no "${script}" script.`;
  const deps =
    Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length;
  if (deps > 0 && !existsSync(modules))
    return "the dependencies are not installed. Run npm ci --ignore-scripts before the bot.";
  return null;
}

export function dockerArgs(input: {
  work: string;
  modules: string | null;
  script: string;
  image: string;
  name: string;
  user: string;
}): string[] {
  return [
    "run",
    "--rm",
    "--name",
    input.name,
    "--network",
    "none",
    "--memory",
    "4g",
    "--cpus",
    "2",
    "--pids-limit",
    "1024",
    "--user",
    input.user,
    "-e",
    "CI=true",
    "-e",
    "HOME=/tmp",
    "-e",
    "FORCE_COLOR=0",
    "-e",
    "NO_COLOR=1",
    "-v",
    `${input.work}:/work`,
    ...(input.modules ? ["-v", `${input.modules}:/work/node_modules:ro`] : []),
    "-w",
    "/work",
    input.image,
    "npm",
    "run",
    input.script,
  ];
}

const minutes = (ms: number) => Math.round(ms / 60_000);

function outcome(
  status: number | null,
  output: string,
  timedOut: boolean,
  timeoutMs: number,
): TestRun {
  if (timedOut)
    return {
      ran: true,
      passed: false,
      detail: `did not finish in ${minutes(timeoutMs)} minutes.`,
      evidence: output.split("\n").slice(-60).join("\n"),
    };
  if (status === 0) return { ran: true, passed: true, detail: "", evidence: "" };
  return { ran: true, passed: false, ...summarizeOutput(output, status) };
}

export function dockerSandbox(image = DEFAULT_IMAGE): Sandbox {
  return {
    kind: "docker",
    where: "in a container with no network",
    run(dir, overlay, script, timeoutMs, modules) {
      const work = copyProject(dir, overlay);
      try {
        const why = cannotRun(work, script, modules);
        if (why) return { ran: false, reason: why };
        const name = `aperture-bot-${randomBytes(6).toString("hex")}`;
        const user =
          typeof process.getuid === "function"
            ? `${process.getuid()}:${process.getgid!()}`
            : "1000";
        const args = dockerArgs({
          work,
          modules: existsSync(modules) ? modules : null,
          script,
          image,
          name,
          user,
        });
        const run = spawnSync("docker", args, {
          encoding: "utf8",
          timeout: timeoutMs,
          maxBuffer: 64 * 1024 * 1024,
        });
        const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
        const timedOut = (run.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
        if (timedOut) spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
        else if (run.error)
          return { ran: false, reason: `Docker could not be started: ${run.error.message}` };
        // 125: docker itself failed (no daemon, the image could not be pulled), before any test ran.
        if (run.status === 125) {
          const last = (run.stderr ?? "").trim().split("\n").at(-1) ?? "";
          return { ran: false, reason: `the sandbox could not start: ${last.slice(0, 200)}` };
        }
        return outcome(run.status, output, timedOut, timeoutMs);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
  };
}

export function localSandbox(): Sandbox {
  return {
    kind: "none",
    where: "on this machine, with no secrets in its environment",
    run(dir, overlay, script, timeoutMs, modules) {
      const work = copyProject(dir, overlay);
      try {
        const why = cannotRun(work, script, modules);
        if (why) return { ran: false, reason: why };
        if (existsSync(modules)) symlinkSync(modules, join(work, "node_modules"), "dir");
        const run = spawnSync("npm", ["run", script], {
          cwd: work,
          env: {
            PATH: process.env.PATH ?? "",
            HOME: work,
            CI: "true",
            FORCE_COLOR: "0",
            NO_COLOR: "1",
          },
          encoding: "utf8",
          timeout: timeoutMs,
          maxBuffer: 64 * 1024 * 1024,
          shell: process.platform === "win32",
        });
        const timedOut = (run.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
        if (run.error && !timedOut)
          return { ran: false, reason: `npm could not be started: ${run.error.message}` };
        return outcome(run.status, `${run.stdout ?? ""}\n${run.stderr ?? ""}`, timedOut, timeoutMs);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
  };
}

export function dockerAvailable(): boolean {
  const run = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  return run.status === 0 && Boolean(run.stdout?.trim());
}

/** `auto` is docker when there is a Docker daemon, and no sandbox (tests not run) otherwise. */
export function chooseSandbox(kind: "auto" | "docker" | "none", image?: string): Sandbox | null {
  if (kind === "none") return localSandbox();
  if (kind === "docker") return dockerSandbox(image);
  return dockerAvailable() ? dockerSandbox(image) : null;
}

/** The sandbox as Agent Check's test runner: the checkout as it is on disk. */
export function asTestRunner(sandbox: Sandbox): TestRunner {
  return (dir, script, timeoutMs, modules) => sandbox.run(dir, null, script, timeoutMs, modules);
}
