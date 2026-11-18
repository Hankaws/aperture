/**
 * The welcome tour: three steps that get someone new from nothing to a bot of
 * their own, shown in Aperture Bot's chat. Each ticks itself off from what
 * the account says, so nothing is ticked by hand: a model key (their own, or
 * a custom endpoint), GitHub connected, and a first bot. Once all three are
 * done, or the person hides it, it goes. Pure, for tests.
 */
import { isPrivateAddress } from "../agent/custom-endpoint.ts";
import type { ActionId } from "./private-chat.ts";

export type TourFacts = { modelKey: boolean; github: boolean; bots: number };

export type TourStep = {
  /** The place its button opens: one of the chat's buttons (`ACTIONS`). */
  id: Extract<ActionId, "model-key" | "github" | "new-bot">;
  title: string;
  why: string;
  done: boolean;
};

/** Where "hidden" is kept, in this browser. */
export const TOUR_KEY = "aperture-tour-hidden";

/**
 * A model the bot can answer with: a saved key, or a custom endpoint with its
 * model and a key. An endpoint on the person's own machine (Ollama, LM Studio)
 * needs no key; one on the internet, such as OpenRouter, does: without it the
 * step stays open, since every answer would be refused.
 */
export function hasModel(account: {
  keyCount: number;
  custom: { base: string | null; model: string | null; keySet: boolean };
}): boolean {
  if (account.keyCount > 0) return true;
  const { base, model, keySet } = account.custom;
  if (!base || !model) return false;
  if (keySet) return true;
  try {
    return isPrivateAddress(new URL(base).hostname);
  } catch {
    return false;
  }
}

export function tourSteps(facts: TourFacts): TourStep[] {
  return [
    {
      id: "model-key",
      title: "Add a model key",
      why: "Every answer, here and from your bots, uses your own key.",
      done: facts.modelKey,
    },
    {
      id: "github",
      title: "Connect GitHub",
      why: "So a bot can read your repositories and open pull requests.",
      done: facts.github,
    },
    {
      id: "new-bot",
      title: "Make your first bot",
      why: "Give it a name and a repository; it gets a bubble of its own.",
      done: facts.bots > 0,
    },
  ];
}

/** Steps done, of how many; and the first not done, which gets the main button. */
export function tourProgress(steps: TourStep[]): {
  done: number;
  total: number;
  next: TourStep | null;
} {
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    next: steps.find((s) => !s.done) ?? null,
  };
}
