/**
 * Save hooks: what Ctrl/Cmd+S runs from `.aperture/hooks.json`, and the last
 * run, for the status bar (hooks-badge.tsx).
 */
import { toast } from "sonner";
import { create } from "zustand";
import { useWorkspace } from "@/lib/workspace/store";
import {
  HOOKS_PATH,
  HOOKS_TEMPLATE,
  hooksFor,
  parseHooks,
  type HookRun,
} from "@/lib/workspace/hooks";
import { runHooks } from "@/lib/workspace/hook-runner";

type SaveHooks = {
  /** The file that was saved. */
  path: string | null;
  runs: HookRun[];
};

export const useSaveHooks = create<SaveHooks>(() => ({ path: null, runs: [] }));

let current: AbortController | null = null;

/**
 * Runs the save hooks for `path` against the files as they are. A save while
 * an earlier run is still going replaces it. `manual`: asked for from the
 * command palette, so say when there is nothing to run.
 */
export async function runSaveHooks(
  path: string | null,
  opts: { manual?: boolean } = {},
): Promise<void> {
  const files = useWorkspace.getState().files;
  const config = parseHooks(files[HOOKS_PATH]);
  if (config.error && (opts.manual || path === HOOKS_PATH)) toast.error(config.error);
  const hooks = path ? hooksFor(config.hooks, "save", [path]) : [];
  if (hooks.length === 0) {
    if (opts.manual) {
      toast.message(
        config.hooks.length === 0
          ? `No hooks yet. Add one in ${HOOKS_PATH}.`
          : `No save hook is for ${path ?? "this file"}.`,
      );
    }
    return;
  }
  current?.abort();
  const controller = new AbortController();
  current = controller;
  useSaveHooks.setState({ path, runs: hooks.map((hook) => ({ hook, state: "running" })) });
  try {
    const runs = await runHooks(hooks, files, {
      signal: controller.signal,
      onRun: (run) =>
        useSaveHooks.setState((state) => ({
          runs: state.runs.map((item) => (item.hook.id === run.hook.id ? run : item)),
        })),
    });
    const failed = runs.find((run) => run.state === "done" && !run.passed);
    if (failed && failed.state === "done") {
      toast.error(`${failed.hook.name} failed on save`, {
        id: "save-hooks",
        description: failed.detail,
      });
    }
  } catch {
    // Replaced by a newer save.
  } finally {
    if (current === controller) current = null;
  }
}

/** Starts `.aperture/hooks.json` from a template, or opens it. */
export function openHooksFile() {
  const ws = useWorkspace.getState();
  if (ws.files[HOOKS_PATH] === undefined) ws.createFile(HOOKS_PATH, HOOKS_TEMPLATE);
  else ws.openFile(HOOKS_PATH);
}
