import { pendingByPath } from "@/lib/workspace/edits";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { hunkAnchorLines, stepReview } from "./review-nav";

export function jumpReview(dir: 1 | -1, fileOnly = false) {
  const ws = useWorkspace.getState();
  const files = pendingByPath(ws.messages).map((edit) => ({ path: edit.path, lines: hunkAnchorLines(edit) }));
  const line = ws.selection && ws.selection.path === ws.activePath ? ws.selection.fromLine : 0;
  const next = stepReview(files, ws.activePath, line, dir, fileOnly);
  if (!next) return;
  ws.openFile(next.path);
  const ui = useIdeUi.getState();
  ui.setMobilePane("editor");
  if (ui.designOpen) ui.setCodePeek(true);
  ui.setReveal({ path: next.path, line: next.line });
}
