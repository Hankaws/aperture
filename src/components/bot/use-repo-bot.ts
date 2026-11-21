import { useCallback, useEffect, useRef, useState } from "react";
import { botSetup, botTasks, type BotPulls, type BotSetup, type BotTasks } from "@/lib/github/bot";
import { isSettled, type BotTask } from "@/lib/bot/tasks";
import { sharedLoad, type LoadCache } from "@/lib/bot/shared-load";
import { isOverLimit } from "@/lib/security/rate-limit";

export type Setup = { ok: true } & BotSetup;

/**
 * Every reader of a repository's tasks shares one call: the Bot page and that
 * bot's bubble poll the same answer, and each refresh counts against the
 * person's Bot limit (30 a minute, `rate-limit.ts`). Under the fast poll, so
 * two polls a few seconds apart share it.
 */
const TASKS: LoadCache<BotTasks> = new Map();
const SHARED_MS = 8_000;

/**
 * A repository as the Bot page sees it: whether the bot is set up there, and
 * its tasks, kept fresh (every 10 seconds while one is moving or one was just
 * asked, every minute otherwise, never in a hidden tab). `quiet`: nobody is
 * looking (a minimized bubble), so every minute whatever is moving.
 */
export function useRepoBot(fullName: string, { quiet = false }: { quiet?: boolean } = {}) {
  const [owner = "", name = ""] = fullName.split("/");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BotTask[] | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  /** Whether each pull request the tasks opened merged, for the bot's Usage. */
  const [pulls, setPulls] = useState<BotPulls>({});
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Until this time, poll fast: a task was just asked and has no answer yet. */
  const eager = useRef(0);
  const hasTasks = useRef(false);
  hasTasks.current = tasks !== null;

  const loadSetup = useCallback(async () => {
    setSetupError(null);
    try {
      const out = await botSetup({ data: { owner, repo: name } });
      if (out.ok) setSetup(out);
      else setSetupError(out.error);
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Could not read the repo.");
    }
  }, [owner, name]);

  // `force`: someone asked (a new task, Refresh), so a call another reader made a moment ago is not enough.
  const loadTasks = useCallback(
    async (force = false) => {
      setRefreshing(true);
      try {
        const out = await sharedLoad(
          TASKS,
          `${owner}/${name}`,
          () => botTasks({ data: { owner, repo: name } }),
          { freshMs: SHARED_MS, force },
        );
        if (out.ok) {
          setTasks(out.tasks);
          setPulls(out.pulls);
          setTasksError(null);
        } else if (isOverLimit(out.error) && hasTasks.current) {
          // A refresh over the limit is not news: keep the tasks shown, and the next poll tries again.
        } else setTasksError(out.error);
      } catch (err) {
        setTasksError(err instanceof Error ? err.message : "Could not read the tasks.");
      } finally {
        setRefreshing(false);
        setNow(Date.now());
      }
    },
    [owner, name],
  );

  useEffect(() => {
    void loadSetup();
    void loadTasks();
  }, [loadSetup, loadTasks]);

  const active = (tasks ?? []).some((t) => !isSettled(t.state));
  useEffect(() => {
    const every = !quiet && (active || Date.now() < eager.current) ? 10_000 : 60_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadTasks();
    }, every);
    return () => window.clearInterval(timer);
  }, [active, quiet, loadTasks, tasks]);

  // Opened again after a minute of checking in slowly: catch up now, sharing a call made a moment ago.
  useEffect(() => {
    if (!quiet) void loadTasks();
  }, [quiet, loadTasks]);

  const asked = useCallback(() => {
    eager.current = Date.now() + 5 * 60_000;
    void loadTasks(true);
  }, [loadTasks]);

  return {
    owner,
    name,
    setup,
    setupError,
    tasks,
    tasksError,
    pulls,
    refreshing,
    now,
    active,
    loadSetup,
    loadTasks,
    asked,
  };
}
