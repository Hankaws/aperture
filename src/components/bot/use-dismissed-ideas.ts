import { useEffect, useState } from "react";

const DISMISSED_KEY = "aperture-bot-dismissed-ideas";
/** Kept to the newest few hundred: an idea dismissed long ago is out of the inbox's two weeks anyway. */
const MAX_DISMISSED = 400;

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function keepDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-MAX_DISMISSED)));
  } catch {
    // Private windows: dismissing lasts until the page reloads.
  }
}

/**
 * The ideas dismissed in this browser, kept as it changes; the roster's badge
 * and the inbox share it, so a dismissal shows in both at once.
 */
export function useDismissedIdeas(): [string[], (ids: string[]) => void] {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => setDismissed(readDismissed()), []);
  const set = (ids: string[]) => {
    setDismissed(ids);
    keepDismissed(ids);
  };
  return [dismissed, set];
}
