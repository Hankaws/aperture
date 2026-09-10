import { useCallback, useEffect, useState } from "react";
import { listJobs } from "./api";
import type { JobRecord } from "./types";

export function useJobs(enabled: boolean) {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setJobs([]);
      return [];
    }
    setLoading(true);
    try {
      const next = await listJobs();
      setJobs(next);
      return next;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const live = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!enabled || !live) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 2200);
    return () => window.clearInterval(id);
  }, [enabled, live, refresh]);

  return { jobs, setJobs, loading, refresh, liveCount: jobs.filter((j) => j.status === "queued" || j.status === "running").length };
}
