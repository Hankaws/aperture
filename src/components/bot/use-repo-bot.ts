import { useCallback, useEffect, useRef, useState } from "react";
import { botSetup, botTasks, type BotSetup } from "@/lib/github/bot";
import { isSettled, type BotTask } from "@/lib/bot/tasks";

export type Setup = { ok: true } & BotSetup;

/**
 * A repository as the Bot page sees it: whether the bot is set up there, and
 * its tasks, kept fresh (every 10 seconds while one is moving or one was just
 * asked, every minute otherwise, never in a hidden tab).
 */
export function useRepoBot(fullName: string) {
  const [owner = "", name = ""] = fullName.split("/");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BotTask[] | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Until this time, poll fast: a task was just asked and has no answer yet. */
  const eager = useRef(0);

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

  const loadTasks = useCallback(async () => {
    setRefreshing(true);
    try {
      const out = await botTasks({ data: { owner, repo: name } });
      if (out.ok) {
        setTasks(out.tasks);
        setTasksError(null);
      } else setTasksError(out.error);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Could not read the tasks.");
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  }, [owner, name]);

  useEffect(() => {
    void loadSetup();
    void loadTasks();
  }, [loadSetup, loadTasks]);

  const active = (tasks ?? []).some((t) => !isSettled(t.state));
  useEffect(() => {
    const every = active || Date.now() < eager.current ? 10_000 : 60_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadTasks();
    }, every);
    return () => window.clearInterval(timer);
  }, [active, loadTasks, tasks]);

  const asked = useCallback(() => {
    eager.current = Date.now() + 5 * 60_000;
    void loadTasks();
  }, [loadTasks]);

  return {
    owner,
    name,
    setup,
    setupError,
    tasks,
    tasksError,
    refreshing,
    now,
    active,
    loadSetup,
    loadTasks,
    asked,
  };
}
