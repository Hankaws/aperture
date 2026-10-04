import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IdeShell } from "@/components/ide/ide-shell";
import { authEnabled } from "@/lib/auth/client";
import { ensureVisitor } from "@/lib/auth/visitor.api";
import { flushWorkspacePersist, useWorkspace } from "@/lib/workspace/store";
import { startWorkspaceSync } from "@/lib/workspace/sync-controller";

/** Per tab: once the cookie is set, later navigations have nothing to ask for. */
let visitorReady = false;

export const Route = createFileRoute("/app")({
  // With sign-in off, settle this browser's visitor id before the editor's
  // first parallel requests, so they all land on the same anonymous user.
  beforeLoad: async () => {
    if (authEnabled) return;
    if (typeof window !== "undefined") {
      if (visitorReady) return;
      visitorReady = true;
    }
    await ensureVisitor();
  },
  // Code-split like every other route: the editor is most of the client
  // code, and the landing page must not download it.
  component: AppEditor,
});

function AppEditor() {
  const hydrate = useWorkspace((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    const flush = () => flushWorkspacePersist();
    window.addEventListener("pagehide", flush);
    const stop = startWorkspaceSync();
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      stop();
    };
  }, [hydrate]);

  return <IdeShell />;
}
