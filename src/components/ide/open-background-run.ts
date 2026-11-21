import { toast } from "sonner";
import { useIdeUi } from "@/lib/ui-store";
import type { BackgroundRun } from "@/lib/agent/background";
import { openBackgroundRun } from "@/lib/agent/background-runner";

/** Brings a finished background run (or one attempt of a Best of 3) into Composer for review. */
export function openRun(run: BackgroundRun) {
  const outcome = openBackgroundRun(run.id);
  if (!outcome.ok) {
    toast.error(outcome.error);
    return;
  }
  useIdeUi.getState().setBoardOpen(false);
  useIdeUi.setState({ chatOpen: true, mobilePane: "editor" });
  toast.success(
    outcome.merged.length > 0
      ? `Opened, carried onto your newer ${outcome.merged.join(", ")}`
      : "Opened for review",
  );
}
