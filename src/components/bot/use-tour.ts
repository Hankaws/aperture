import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAccount } from "@/lib/billing/api";
import { BUBBLE_EVENT } from "@/lib/bot/bubbles";
import { listBots } from "@/lib/bot/team.api";
import { hasModel, TOUR_KEY, tourProgress, tourSteps, type TourFacts } from "@/lib/bot/tour";
import { githubStatus } from "@/lib/github/api";

/** Sent when the tour is hidden, so the bubble's count and the chat's card go together. */
const HIDDEN_EVENT = "aperture:tour-hidden";

/**
 * The welcome tour's state (`tour.ts`): its steps, ticked from what the
 * account says, read again on each page, when the tab comes back, and when a
 * bot is made, so a step done elsewhere ticks itself. `show` while a step is
 * left and the person has not hidden it in this browser.
 */
export function useTour() {
  const { user } = useCurrentUserState();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [facts, setFacts] = useState<TourFacts | null>(null);
  /** Hidden until this browser says otherwise, so it never flashes for someone who hid it. */
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(TOUR_KEY) === "1");
    } catch {
      setHidden(false);
    }
    const onHidden = () => setHidden(true);
    window.addEventListener(HIDDEN_EVENT, onHidden);
    return () => window.removeEventListener(HIDDEN_EVENT, onHidden);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const [account, github, bots] = await Promise.all([
      getAccount().catch(() => null),
      githubStatus().catch(() => null),
      listBots().catch(() => null),
    ]);
    // Nothing could be read: keep what was there rather than untick everything.
    if (!account && !github && !bots) return;
    setFacts((was) => ({
      modelKey: account ? hasModel(account) : (was?.modelKey ?? false),
      github: github ? github.connected : (was?.github ?? false),
      bots: bots ? bots.length : (was?.bots ?? 0),
    }));
  }, [user]);

  useEffect(() => {
    if (!hidden) void load();
  }, [load, hidden, path]);

  useEffect(() => {
    if (hidden) return;
    const again = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", again);
    window.addEventListener(BUBBLE_EVENT, again);
    return () => {
      window.removeEventListener("focus", again);
      window.removeEventListener(BUBBLE_EVENT, again);
    };
  }, [hidden, load]);

  const hide = useCallback(() => {
    setHidden(true);
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // Blocked storage: hidden until the page reloads.
    }
    window.dispatchEvent(new Event(HIDDEN_EVENT));
  }, []);

  const steps = facts ? tourSteps(facts) : null;
  const progress = steps ? tourProgress(steps) : null;
  return {
    steps: steps ?? [],
    progress,
    show: Boolean(!hidden && progress && progress.done < progress.total),
    hide,
  };
}
