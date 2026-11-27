import { submitAgent } from "@/lib/agent/run";
import type { ModelSource } from "@/lib/billing/plans";
import { useIdeUi } from "@/lib/ui-store";
import { takeAttempt } from "@/lib/workspace/attempt";
import { useWorkspace } from "@/lib/workspace/store";
import type { ProposedEdit } from "@/lib/workspace/types";

/**
 * Send back: the held change goes back to Composer with the failing check's
 * evidence. One action, shared by the verdict above the diff and Composer's
 * own bar (which the phone shows), so both do exactly the same thing.
 */
export function sendBack(source: ModelSource | null | undefined, pendingEdits: ProposedEdit[]) {
  const hint = useIdeUi.getState().checkHint;
  const detail = hint?.detail ?? "A check failed.";
  const path = hint?.path;
  const snap = takeAttempt();
  if (snap && !useIdeUi.getState().failedAttempt) useIdeUi.getState().setFailedAttempt(snap);
  if (path) useWorkspace.getState().openFile(path);
  useIdeUi.getState().setMobilePane("editor");
  void submitAgent("Fix the failing checks", "composer", source, {
    phase: "skip",
    apiInstruction:
      hint?.prompt ??
      `${detail}\nFix only this with propose_edit. Pass confidence from 0 to 1. Below 0.8 the edit is dropped and the turn stops.`,
    pendingEdits,
    copyId: useWorkspace.getState().activeCopyId ?? undefined,
  });
}
