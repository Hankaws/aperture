/**
 * Editor layout preferences: which panels are shown, where the preview docks,
 * and which side the sidebars sit on. Pure and storage-free so it can be
 * tested without a browser; `ui-store.ts` owns reading and writing.
 */

/** Where the preview sits relative to the code. */
export type PreviewDock = "right" | "bottom" | "full";

export type LayoutPrefs = {
  /** Files sidebar visible (desktop). */
  sidebarOpen: boolean;
  /** Composer panel visible (desktop). */
  chatOpen: boolean;
  previewDock: PreviewDock;
  /** Files on the right and Composer on the left, instead of the reverse. */
  swapSides: boolean;
};

export const LAYOUT_PREFS_KEY = "aperture-layout-prefs";

/** Prefix for saved panel sizes; `resetLayout` clears every key under it. */
export const PANEL_SIZES_PREFIX = "aperture-panels:";

export const DEFAULT_LAYOUT_PREFS: LayoutPrefs = {
  sidebarOpen: true,
  chatOpen: true,
  previewDock: "right",
  swapSides: false,
};

const DOCKS: readonly PreviewDock[] = ["right", "bottom", "full"];

/** Saved prefs, field by field: anything missing or malformed falls back to the default. */
export function parseLayoutPrefs(raw: string | null): LayoutPrefs {
  if (!raw) return { ...DEFAULT_LAYOUT_PREFS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_LAYOUT_PREFS };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...DEFAULT_LAYOUT_PREFS };
  const row = parsed as Record<string, unknown>;
  const bool = (key: keyof LayoutPrefs) =>
    typeof row[key] === "boolean" ? (row[key] as boolean) : (DEFAULT_LAYOUT_PREFS[key] as boolean);
  return {
    sidebarOpen: bool("sidebarOpen"),
    chatOpen: bool("chatOpen"),
    swapSides: bool("swapSides"),
    previewDock: DOCKS.includes(row.previewDock as PreviewDock)
      ? (row.previewDock as PreviewDock)
      : DEFAULT_LAYOUT_PREFS.previewDock,
  };
}

/**
 * The dock actually used. Phones have no room for a split, so the preview
 * takes the whole editor; a maximized preview still shows the code below it
 * when something (a review jump, "Code" on mobile) asks to see it.
 */
export function effectiveDock(dock: PreviewDock, opts: { desktop: boolean; codePeek: boolean }): PreviewDock {
  const base = opts.desktop ? dock : "full";
  if (base === "full" && opts.codePeek) return "bottom";
  return base;
}

/** Storage key for one group's sizes; the panel set is part of it so layouts never cross-apply. */
export function panelSizesKey(group: string, ids: readonly string[]): string {
  return `${PANEL_SIZES_PREFIX}${group}:${ids.join(",")}`;
}

/**
 * A saved layout that is safe to hand back to the panel library: exactly the
 * expected panels, every size a positive finite percentage, summing to ~100.
 * Anything else (older layouts, hand edits, a panel added since) is ignored.
 */
export function restorableLayout(saved: unknown, ids: readonly string[]): Record<string, number> | null {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const row = saved as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== ids.length || !ids.every((id) => keys.includes(id))) return null;
  let total = 0;
  const layout: Record<string, number> = {};
  for (const id of ids) {
    const size = row[id];
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || size > 100) return null;
    layout[id] = size;
    total += size;
  }
  return Math.abs(total - 100) <= 1 ? layout : null;
}
