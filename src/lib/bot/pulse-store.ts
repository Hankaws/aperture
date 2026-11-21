import { create } from "zustand";
import type { Pulse } from "./board";

/** The last pulse, kept in this browser so the dot shows at once on every page. */
const KEY = "aperture-bots-pulse";

type PulseState = {
  pulse: Pulse | null;
  /** When it was read (ms); 0 when never. */
  at: number;
  set: (pulse: Pulse) => void;
  /** Reads this browser's copy, once the page is on screen (never while rendering, so it hydrates the same). */
  hydrate: () => void;
};

function read(): { pulse: Pulse | null; at: number } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as {
      pulse?: Pulse;
      at?: number;
    } | null;
    const p = raw?.pulse;
    if (
      p &&
      Number.isInteger(p.working) &&
      Number.isInteger(p.needs) &&
      typeof raw?.at === "number"
    )
      return { pulse: { working: p.working, needs: p.needs }, at: raw.at };
  } catch {
    // Storage blocked or garbled: none.
  }
  return { pulse: null, at: 0 };
}

/** What the team's bots are up to, for the dot on the sidebar's Bots (`board.ts`). */
export const usePulse = create<PulseState>((set, get) => ({
  pulse: null,
  at: 0,
  hydrate: () => {
    if (get().at === 0) set(read());
  },
  set: (pulse) => {
    const at = Date.now();
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ pulse, at }));
    } catch {
      // Storage blocked: for this page.
    }
    set({ pulse, at });
  },
}));
