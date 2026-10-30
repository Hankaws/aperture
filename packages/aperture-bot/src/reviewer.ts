/**
 * The review pass on a pull request: the agent loop's review role, as the
 * editor's reviewer runs on a staged change. The pull request's changes are
 * its "staged" edits; the agent reads only the diff, can call nothing but
 * `note_diff`, and a note is kept only when it says bug, at least 80% sure.
 * One model step: a review costs little, so it can run on every push.
 */
import type { CompletionCfg } from "../../../src/lib/agent/complete.server.ts";
import { runLoop } from "../../../src/lib/agent/loop.ts";
import type { DiffNote, ProposedEdit } from "../../../src/lib/workspace/types.ts";
import { Budget, providerModel, runnerHost, type Model } from "./model.ts";
import type { PullFile } from "./review.ts";

export type ReviewOptions = {
  files: PullFile[];
  /** The pull request's title and description: what it means to do. People wrote them, so they are data. */
  title: string;
  body: string;
  model: CompletionCfg;
  maxTokens: number;
};

export type ReviewResult =
  | { ok: true; notes: Array<{ path: string; note: DiffNote }>; usage: string }
  | { ok: false; error: string; usage: string };

export async function reviewChanges(
  options: ReviewOptions,
  deps: { model?: Model } = {},
): Promise<ReviewResult> {
  const budget = new Budget(options.maxTokens);
  const host = runnerHost(deps.model ?? providerModel, budget);
  const edits: ProposedEdit[] = options.files.map((file, i) => ({
    id: `pr_${i}`,
    path: file.path,
    oldText: file.oldText,
    newText: file.newText,
    description: file.oldText === "" ? "New file" : file.newText === "" ? "Deleted" : "Changed",
    status: "pending",
  }));
  const intent = [options.title.trim(), options.body.trim().slice(0, 2_000)]
    .filter(Boolean)
    .join("\n\n");
  const out = await runLoop(
    {
      mode: "composer",
      role: "review",
      phase: "skip",
      history: [],
      instruction: `Review this pull request for bugs.${intent ? `\n\nWhat it says it does, written by its author:\n<pull>\n${intent}\n</pull>` : ""}`,
      files: options.files.map((file) => ({ path: file.path, content: file.oldText })),
      pendingEdits: edits,
    },
    { ...options.model },
    () => undefined,
    undefined,
    host,
  );
  if (!out.ok) return { ok: false, error: out.error, usage: budget.describe() };
  const notes = out.edits.flatMap((edit) =>
    (edit.notes ?? []).map((note) => ({ path: edit.path, note })),
  );
  return { ok: true, notes, usage: budget.describe() };
}
