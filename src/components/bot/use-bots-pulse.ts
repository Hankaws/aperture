import { useEffect } from "react";
import { pulseOf } from "@/lib/bot/board";
import { usePulse } from "@/lib/bot/pulse-store";
import { listBots } from "@/lib/bot/team.api";
import { botActivity } from "@/lib/github/bot";

/** How old the dot may get before the app's frame reads the bots again. */
const STALE_MS = 5 * 60_000;

/**
 * Keeps the dot on the sidebar's Bots current from any page: at most every
 * few minutes, the team's activity, read as the Bot page reads it. Nothing
 * for someone with no bots, or no GitHub. The Bot page keeps it fresher.
 */
export function useBotsPulse(on: boolean) {
  useEffect(() => {
    usePulse.getState().hydrate();
    if (!on || Date.now() - usePulse.getState().at < STALE_MS) return;
    let cancel = false;
    void (async () => {
      const bots = await listBots().catch(() => []);
      if (cancel) return;
      if (bots.length === 0) {
        usePulse.getState().set({ working: 0, needs: 0 });
        return;
      }
      const repos = [...new Set(bots.map((b) => b.repo))].slice(0, 15);
      const out = await botActivity({ data: { repos } }).catch(() => null);
      if (cancel || !out?.ok) return;
      usePulse.getState().set(pulseOf(out.activity, out.pulls, Date.now()));
    })();
    return () => {
      cancel = true;
    };
  }, [on]);
}
