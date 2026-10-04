import { useEffect } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import type { BackgroundRun } from "./background";
import { hydrateBackgroundRuns, runsFor, useBackgroundRuns } from "./background-runner";

/** Background runs for the workspace on screen, newest first. */
export function useVisibleBackgroundRuns(): BackgroundRun[] {
  const runs = useBackgroundRuns((s) => s.runs);
  const name = useWorkspace((s) => s.name);
  useEffect(() => hydrateBackgroundRuns(), []);
  return runsFor(runs, name);
}
