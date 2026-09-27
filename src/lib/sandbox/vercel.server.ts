/**
 * Vercel Sandbox adapter, on the official `@vercel/sandbox` SDK.
 *
 * Dark unless a deployment opts in, in one of two ways:
 *
 * - `APERTURE_SANDBOX=vercel-oidc` on a Vercel deployment: the SDK signs in
 *   with the deployment's own short-lived OIDC identity (from the request), so
 *   no token is stored anywhere. Opt-in rather than automatic because the
 *   identity is whichever Vercel project serves the app: a host that merely
 *   runs on Vercel must never start sandboxes on its own account by accident.
 * - `VERCEL_SANDBOX_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`: an access
 *   token, for hosts outside Vercel.
 *
 * Without either, `isConfigured()` is false and the agent is simply told that
 * running is unavailable, so a missing setup degrades rather than breaks.
 */
import { env } from "../env.server.ts";
import { clipOutput, type RunOutcome, type RunRequest, type SandboxRunner, type StepResult } from "./runner.ts";

/**
 * Package registries only. Installs work; the code under test (which the agent
 * may have written) cannot reach anything else. The sandbox holds no secrets
 * either (see `sandboxEnv`), so this narrows exfiltration and abuse, not a
 * last line of defence.
 */
export const SANDBOX_ALLOWED_DOMAINS = [
  "registry.npmjs.org",
  "*.npmjs.org",
  "registry.yarnpkg.com",
  "codeload.github.com",
];

/** Extra time for the sandbox itself (boot, writing files) beyond the run's own budget. */
const SETUP_MS = 60_000;

export type SandboxCredentials = { token: string; teamId: string; projectId: string };

export type SandboxMode = { kind: "oidc" } | { kind: "token"; credentials: SandboxCredentials } | null;

export function sandboxMode(): SandboxMode {
  const token = env("VERCEL_SANDBOX_TOKEN");
  const teamId = env("VERCEL_TEAM_ID");
  const projectId = env("VERCEL_PROJECT_ID");
  if (token && teamId && projectId) return { kind: "token", credentials: { token, teamId, projectId } };
  if (env("APERTURE_SANDBOX") === "vercel-oidc" && env("VERCEL")) return { kind: "oidc" };
  return null;
}

export function isConfigured(): boolean {
  return sandboxMode() !== null;
}

/** The slice of the SDK's sandbox this adapter uses, so tests can stand in a fake. */
export type SandboxHandle = {
  writeFiles(files: { path: string; content: string }[], opts?: { signal?: AbortSignal }): Promise<void>;
  /** Runs in the sandbox's working directory, where `writeFiles` puts relative paths. */
  runCommand(params: {
    cmd: string;
    args?: string[];
    env?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<{ exitCode: number; output(stream?: "both"): Promise<string> }>;
  stop(): Promise<unknown>;
};

export type CreateSandbox = (params: {
  timeoutMs: number;
  env: Record<string, string>;
  signal?: AbortSignal;
}) => Promise<SandboxHandle>;

/** The real thing: a one-shot sandbox that keeps no snapshot and reaches only package registries. */
async function createVercelSandbox(params: {
  timeoutMs: number;
  env: Record<string, string>;
  signal?: AbortSignal;
}): Promise<SandboxHandle> {
  const mode = sandboxMode();
  if (!mode) throw new Error("No sandbox is configured for this deployment.");
  const { Sandbox } = await import("@vercel/sandbox");
  const sandbox = await Sandbox.create({
    ...(mode.kind === "token" ? mode.credentials : {}),
    timeout: params.timeoutMs,
    resources: { vcpus: 2 },
    // A verify run is thrown away afterwards; a snapshot would only bill storage.
    persistent: false,
    networkPolicy: { allow: SANDBOX_ALLOWED_DOMAINS },
    env: params.env,
    tags: { app: "aperture", purpose: "verify" },
    signal: params.signal,
  });
  return {
    writeFiles: (files, opts) => sandbox.writeFiles(files, opts),
    runCommand: async (run) => {
      // The working directory comes from the sandbox, not a constant: the SDK
      // docs say /vercel/sandbox, but the default image uses another path, and
      // writeFiles resolves relative paths against this one.
      const finished = await sandbox.runCommand({ ...run, cwd: sandbox.cwd });
      return { exitCode: finished.exitCode, output: () => finished.output("both") };
    },
    stop: () => sandbox.stop(),
  };
}

/** Workspace files as the SDK writes them: relative to the sandbox's working directory. */
export function toSandboxFiles(files: Record<string, string>): { path: string; content: string }[] {
  return Object.entries(files)
    .filter(([path]) => !path.startsWith("/") && !path.split("/").includes(".."))
    .map(([path, content]) => ({ path, content }));
}

export class VercelSandboxRunner implements SandboxRunner {
  readonly name = "vercel";
  readonly #create: CreateSandbox;

  constructor(create: CreateSandbox = createVercelSandbox) {
    this.#create = create;
  }

  async run(request: RunRequest): Promise<RunOutcome> {
    // Starting a sandbox bills even if it is stopped at once.
    if (request.signal?.aborted) return { ok: false, error: "Run cancelled." };
    const started = Date.now();
    let sandbox: SandboxHandle | null = null;
    try {
      sandbox = await this.#create({
        timeoutMs: request.timeoutMs + SETUP_MS,
        env: request.env,
        signal: request.signal,
      });
      await sandbox.writeFiles(toSandboxFiles(request.files), { signal: request.signal });

      const steps: StepResult[] = [];
      for (const step of request.steps) {
        if (request.signal?.aborted) return { ok: false, error: "Run cancelled." };
        const remaining = request.timeoutMs - (Date.now() - started);
        if (remaining <= 0) {
          steps.push({ label: step.label, exitCode: 124, output: "Timed out before this step ran.", durationMs: 0 });
          break;
        }
        const stepStarted = Date.now();
        const finished = await sandbox.runCommand({
          cmd: step.command,
          args: step.args,
          env: request.env,
          signal: request.signal,
          timeoutMs: remaining,
        });
        const output = clipOutput(await finished.output("both"));
        steps.push({ label: step.label, exitCode: finished.exitCode, output, durationMs: Date.now() - stepStarted });
        // A failed install makes every later step meaningless noise.
        if (finished.exitCode !== 0) break;
      }
      return { ok: true, steps, passed: steps.length === request.steps.length && steps.every((s) => s.exitCode === 0) };
    } catch (error) {
      if (request.signal?.aborted) return { ok: false, error: "Run cancelled." };
      // SDK errors can echo request details; keep only the message's first line.
      const message = error instanceof Error ? error.message.split("\n")[0] : "";
      return { ok: false, error: message ? `The sandbox failed: ${message}` : "The sandbox failed." };
    } finally {
      // Best effort: a sandbox left running bills until its timeout.
      if (sandbox) await sandbox.stop().catch(() => undefined);
    }
  }
}
