/**
 * What the agent may run, and how often.
 *
 * The allowlist is the project's own `package.json` scripts plus a dependency
 * install. That covers the verification loop — install, typecheck, test, build
 * — with a surface small enough to reason about, and a cost per run that is
 * predictable rather than open-ended.
 *
 * One escalation path is deliberate and must stay understood: the agent can
 * propose an edit to `package.json`, and a run executes the snapshot including
 * staged edits, because verifying a staged edit is the entire point. So the
 * allowlist constrains *which* script names run, never what those scripts do.
 * The sandbox is the boundary, which is why `sandboxEnv` exists: nothing that
 * is a secret to this app may ever be handed to it.
 */

export type ScriptName = string;

export type RunPlan =
  | { ok: true; steps: Array<{ command: string; args: string[]; label: string }> }
  | { ok: false; error: string };

/** Script names that are never worth a sandbox run, whatever the project calls them. */
const DENY = new Set(["dev", "start", "preview", "serve", "watch"]);

/** Ceiling on a single run, independent of plan. A sandbox is billed by the second. */
export const MAX_RUN_MS = 300_000;
export const DEFAULT_RUN_MS = 120_000;

export function declaredScripts(files: Record<string, string>): ScriptName[] {
  const raw = files["package.json"];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Object.keys(parsed.scripts ?? {});
  } catch {
    return [];
  }
}

/**
 * Scripts worth offering the agent: declared, and not a long-running server.
 *
 * `dev`/`start` never terminate, so a run against them can only ever end in the
 * timeout — burning the full budget to learn nothing.
 */
export function runnableScripts(files: Record<string, string>): ScriptName[] {
  return declaredScripts(files)
    .filter((name) => !DENY.has(name))
    .sort();
}

export function isRunnable(files: Record<string, string>, script: string): boolean {
  return runnableScripts(files).includes(script);
}

/** Whether a lockfile lets the install be reproducible (`ci`) rather than resolved (`install`). */
export function installCommand(files: Record<string, string>): { command: string; args: string[] } {
  const hasLock = files["package-lock.json"] !== undefined;
  return { command: "npm", args: hasLock ? ["ci", "--no-audit", "--no-fund"] : ["install", "--no-audit", "--no-fund"] };
}

export function planRun(files: Record<string, string>, script: string): RunPlan {
  if (files["package.json"] === undefined) {
    return { ok: false, error: "This project has no package.json, so there is nothing to run." };
  }
  if (declaredScripts(files).length === 0) {
    return { ok: false, error: "package.json declares no scripts." };
  }
  if (DENY.has(script)) {
    return { ok: false, error: `"${script}" starts a server that never exits — it cannot be verified by a run.` };
  }
  if (!isRunnable(files, script)) {
    const available = runnableScripts(files);
    return {
      ok: false,
      error: available.length
        ? `No script named "${script}". This project declares: ${available.join(", ")}.`
        : `No script named "${script}".`,
    };
  }
  const install = installCommand(files);
  return {
    ok: true,
    steps: [
      { ...install, label: "install" },
      { command: "npm", args: ["run", script], label: script },
    ],
  };
}

/**
 * The environment a sandbox is given.
 *
 * Deliberately closed: the agent can author a `package.json` script and have it
 * run, so anything readable in there is effectively public to whatever the
 * agent writes. No API keys, no database URL, no session token — ever.
 */
export function sandboxEnv(): Record<string, string> {
  return { CI: "1", NODE_ENV: "test", NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" };
}

export function clampTimeout(requested: number | undefined): number {
  if (!requested || !Number.isFinite(requested)) return DEFAULT_RUN_MS;
  return Math.max(10_000, Math.min(MAX_RUN_MS, Math.floor(requested)));
}
