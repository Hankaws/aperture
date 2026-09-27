import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { GroupImperativeHandle, Layout, LayoutChangedMeta } from "react-resizable-panels";
import { panelSizesKey, restorableLayout } from "@/lib/layout-prefs";
import { useIdeUi } from "@/lib/ui-store";

/** Grab area around each 1px separator: easy to hit with a mouse, easier with a finger. */
export const RESIZE_TARGET = { fine: 9, coarse: 24 } as const;

/**
 * Remembers a resizable group's sizes in this browser.
 *
 * `defaults` maps each panel id to its default percentage (summing to 100);
 * pass `size(id)` as each Panel's `defaultSize` and `defaultLayout` to the
 * Group. The Group must only mount in the browser (after hydration): the saved
 * layout is read from storage when it mounts, so it starts at the saved sizes
 * with no flash. Only sizes the user dragged are saved, so window resizes and
 * panel toggles never overwrite a layout someone chose. "Reset layout" puts
 * the defaults back in place without remounting what the panels hold.
 */
export function usePanelLayout(group: string, defaults: Readonly<Record<string, number>>) {
  const groupRef = useRef<GroupImperativeHandle | null>(null);
  const ids = Object.keys(defaults);
  const idsKey = ids.join(",");
  const key = panelSizesKey(group, ids);
  const epoch = useIdeUi((s) => s.layoutEpoch);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const seenEpoch = useRef(epoch);

  // The Group reads this only when it mounts, and that happens in the browser.
  const defaultLayout = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
      return restorableLayout(saved, idsKey.split(",")) ?? undefined;
    } catch {
      return undefined;
    }
  }, [key, idsKey]);

  useLayoutEffect(() => {
    if (seenEpoch.current === epoch) return;
    seenEpoch.current = epoch;
    groupRef.current?.setLayout({ ...defaultsRef.current });
  }, [epoch]);

  const onLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(layout));
      } catch {
        // quota: the layout still applies for this session
      }
    },
    [key],
  );

  const size = useCallback((id: string) => `${defaultsRef.current[id]}%`, []);

  return { groupRef, defaultLayout, onLayoutChanged, size };
}
