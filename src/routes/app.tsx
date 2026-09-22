import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IdeShell } from "@/components/ide/ide-shell";
import { useWorkspace } from "@/lib/workspace/store";
import { startWorkspaceSync } from "@/lib/workspace/sync-controller";

export const Route = createFileRoute("/app")({
  component: AppEditor,
  // Compile-time hint for the TanStack splitter — not a runtime option.
  codeSplitGroupings: [],
});

function AppEditor() {
  const hydrate = useWorkspace((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // Reconcile with the saved copy after the local one is in place, so the
    // decision sees what this browser actually holds.
    return startWorkspaceSync();
  }, [hydrate]);

  return <IdeShell />;
}
