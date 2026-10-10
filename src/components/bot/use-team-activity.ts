import { useCallback, useEffect, useState } from "react";
import { botActivity } from "@/lib/github/bot";
import type { Activity } from "@/lib/bot/activity";

/**
 * What happened on the team's repositories, for the roster's faces and lines
 * and the Activity view: every minute while something is queued or working,
 * every three minutes otherwise, never in a hidden tab. Each repository costs
 * GitHub a request or two, from the person's own hourly allowance, so this
 * stays slow; an open room polls its own repository faster. `repoKey` is the
 * repositories joined by commas, so a new list with the same names does not
 * reload.
 */
export function useTeamActivity(repoKey: string) {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!repoKey) return;
    setBusy(true);
    try {
      const out = await botActivity({ data: { repos: repoKey.split(",") } });
      if (out.ok) {
        setItems(out.activity);
        setError(null);
      } else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the activity.");
    } finally {
      setBusy(false);
      setNow(Date.now());
    }
  }, [repoKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // Moving: some repository's newest news is an ask or a run in progress.
  const seen = new Set<string>();
  let moving = false;
  for (const a of items ?? []) {
    if (seen.has(a.repo)) continue;
    seen.add(a.repo);
    if (a.kind === "asked" || a.kind === "working") moving = true;
  }
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") void load();
      },
      moving ? 60_000 : 180_000,
    );
    return () => window.clearInterval(timer);
  }, [moving, load]);

  return { items: items ?? [], loaded: items !== null, error, busy, now, reload: load };
}
