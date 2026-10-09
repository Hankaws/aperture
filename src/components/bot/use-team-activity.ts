import { useCallback, useEffect, useState } from "react";
import { botActivity } from "@/lib/github/bot";
import type { Activity } from "@/lib/bot/activity";

/**
 * What happened on the team's repositories, for the roster's faces and lines:
 * every 15 seconds while something is queued or working, every minute
 * otherwise, never in a hidden tab. `repoKey` is the repositories joined by
 * commas, so a new list with the same names does not reload.
 */
export function useTeamActivity(repoKey: string) {
  const [items, setItems] = useState<Activity[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!repoKey) return;
    try {
      const out = await botActivity({ data: { repos: repoKey.split(",") } });
      if (out.ok) setItems(out.activity);
    } catch {
      // The roster just keeps its last faces; the feed itself says what failed.
    } finally {
      setNow(Date.now());
    }
  }, [repoKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // Moving: some repository's newest news is an ask or a run in progress.
  const seen = new Set<string>();
  let moving = false;
  for (const a of items) {
    if (seen.has(a.repo)) continue;
    seen.add(a.repo);
    if (a.kind === "asked" || a.kind === "working") moving = true;
  }
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") void load();
      },
      moving ? 15_000 : 60_000,
    );
    return () => window.clearInterval(timer);
  }, [moving, load]);

  return { items, now, reload: load };
}
