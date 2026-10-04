/**
 * Hooks: project scripts that run by themselves, from `.aperture/hooks.json`.
 *
 *   {
 *     "hooks": [
 *       { "run": "test:unit", "files": ["src/**\/*.ts"], "on": ["save", "stage"] }
 *     ]
 *   }
 *
 * `save`: when you press Ctrl/Cmd+S on a matching file, against the files as
 * they are. The status bar shows how it went.
 *
 * `stage`: when Composer stages a change to a matching file, against the
 * change. It is one more row in the check strip, and red holds Apply like any
 * other check.
 *
 * Scripts run in the browser's test runner, so the same limits apply: Node
 * scripts, tsx, Vitest and Jest. A script that needs a real Node says so and
 * is not run; it never shows as a pass.
 */
import { globMatches } from "./scoped-rules.ts";

export const HOOKS_PATH = ".aperture/hooks.json";
export const HOOK_LIMIT = 6;

export type HookEvent = "save" | "stage";

export type Hook = {
  /** Stable for a config: the script and where it sits. */
  id: string;
  /** The package.json script, as in `npm run <script>`. */
  script: string;
  /** What the check strip and the status bar call it. */
  name: string;
  /** Empty: every file. */
  files: string[];
  on: HookEvent[];
};

export type HookConfig = { hooks: Hook[]; error: string | null };

export const HOOKS_TEMPLATE = `{
  "hooks": [
    {
      "run": "test",
      "files": ["src/**"],
      "on": ["save"]
    }
  ]
}
`;

const SCRIPT_NAME = /^[\w:.@/-]{1,64}$/;

function asList(value: unknown): string[] {
  if (typeof value === "string")
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  if (Array.isArray(value))
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
}

/** The hooks in the file, and the first thing wrong with it. A broken entry is left out, not guessed at. */
export function parseHooks(raw: string | undefined): HookConfig {
  if (raw === undefined || !raw.trim()) return { hooks: [], error: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { hooks: [], error: `${HOOKS_PATH} is not valid JSON.` };
  }
  const entries = Array.isArray(data) ? data : (data as { hooks?: unknown })?.hooks;
  if (!Array.isArray(entries)) return { hooks: [], error: `${HOOKS_PATH} needs a "hooks" list.` };
  const hooks: Hook[] = [];
  let error: string | null = null;
  entries.forEach((entry: unknown, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const run = typeof item.run === "string" ? item.run.trim().replace(/^npm run\s+/, "") : "";
    if (!SCRIPT_NAME.test(run)) {
      error ??= `Hook ${index + 1}: "run" must name a package.json script, like "test:unit".`;
      return;
    }
    const on = asList(item.on ?? ["save", "stage"]).filter(
      (event): event is HookEvent => event === "save" || event === "stage",
    );
    if (on.length === 0) {
      error ??= `Hook ${index + 1}: "on" must be "save", "stage" or both.`;
      return;
    }
    if (hooks.length >= HOOK_LIMIT) {
      error ??= `Only the first ${HOOK_LIMIT} hooks run.`;
      return;
    }
    const name =
      typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 40) : run;
    hooks.push({
      id: `${index}:${run}`,
      script: run,
      name,
      files: asList(item.files),
      on: [...new Set(on)],
    });
  });
  return { hooks, error };
}

export function hookMatches(hook: Hook, path: string): boolean {
  return hook.files.length === 0 || hook.files.some((glob) => globMatches(glob, path));
}

/**
 * The hooks to run for this event and these files. A staged change already
 * runs `npm run test` as the Tests row, so a stage hook for `test` would only
 * run it twice.
 */
export function hooksFor(hooks: Hook[], event: HookEvent, paths: string[]): Hook[] {
  return hooks.filter(
    (hook) =>
      hook.on.includes(event) &&
      !(event === "stage" && hook.script === "test") &&
      paths.some((path) => hookMatches(hook, path)),
  );
}

/** One hook's run, as the strip and the status bar show it. */
export type HookRun =
  | { hook: Hook; state: "running" }
  | { hook: Hook; state: "unsupported"; reason: string }
  | {
      hook: Hook;
      state: "done";
      passed: boolean;
      /** What failed, one line. */
      detail: string;
      /** Failing the same way before this change. Stage hooks only. */
      preexisting?: boolean;
      output?: string;
    };
