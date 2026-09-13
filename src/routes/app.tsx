import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IdeShell } from "@/components/ide/ide-shell";
import { useWorkspace } from "@/lib/workspace/store";

export const Route = createFileRoute("/app")({
  component: AppEditor,
  // Compile-time hint for the TanStack splitter — not a runtime option.
  codeSplitGroupings: [],
});

function AppEditor() {
  const hydrate = useWorkspace((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <IdeShell />;
}
