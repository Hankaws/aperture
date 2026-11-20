/**
 * Your bot, taking over a change in the editor: it hands the job to
 * Composer and follows it in its own panel, from the edit to the checks to
 * your Apply. Pure, for tests: the editor reports Composer's state
 * (`summon-bridge.ts`) and the bot's panel shows it (`private-chat.tsx`).
 */

/** What Composer is doing, as the editor reports it. */
export type ComposerStatus = {
  running: boolean;
  /** How many replies Composer's thread has: a hand-off follows those after its own count. */
  replies: number;
  /** The files its change touches, waiting for Apply. */
  staged: string[];
  /** Staged files Composer left a note on, to read before Apply. */
  notes: number;
  /** The checks on the staged change; null before they start. */
  checks: "running" | "clear" | "failed" | null;
  /** What failed, when a check did. */
  detail: string | null;
  /** The first line of Composer's newest reply. */
  latest: string | null;
  /** Why the hand-off could not run: no model key, signed out, the plan. */
  blocked: string | null;
};

export const IDLE_COMPOSER: ComposerStatus = {
  running: false,
  replies: 0,
  staged: [],
  notes: 0,
  checks: null,
  detail: null,
  latest: null,
  blocked: null,
};

export type HandoffStage =
  | "sent"
  | "working"
  | "checking"
  | "ready"
  | "failed"
  | "notes"
  | "answered"
  | "blocked"
  | "applied"
  | "discarded";

export type StepState = "done" | "active" | "todo" | "failed";

export type HandoffView = {
  stage: HandoffStage;
  /** One line on where it stands. */
  title: string;
  steps: Array<{ label: string; state: StepState }>;
};

const files = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;

/**
 * Where a hand-off stands: from Composer's state, how many replies its
 * thread had when the job was handed over (`since`), and what the person
 * did with it.
 */
export function handoffView(
  s: ComposerStatus,
  since: number,
  ended: "applied" | "discarded" | null = null,
): HandoffView {
  const stage: HandoffStage = ended
    ? ended
    : s.blocked
      ? "blocked"
      : s.running
        ? "working"
        : s.staged.length > 0
          ? s.checks === "failed"
            ? "failed"
            : s.checks === "clear"
              ? s.notes > 0
                ? "notes"
                : "ready"
              : "checking"
          : s.replies > since
            ? "answered"
            : "sent";
  const n = s.staged.length;
  const title: Record<HandoffStage, string> = {
    sent: "Handing it to Composer…",
    working: "Composer is making the change…",
    checking: `Checking the change to ${files(n)}…`,
    // As Composer's own verdict: safe to apply, which is not every check green (one may have failed before).
    ready: `Ready: ${files(n)} changed and checked, safe to apply.`,
    failed: `A check failed on the change${s.detail ? `: ${s.detail}` : "."}`,
    notes: `Ready, with ${s.notes === 1 ? "a note" : `${s.notes} notes`} from Composer to read first.`,
    answered: s.latest
      ? `Composer answered: ${s.latest}`
      : "Composer finished without changing a file.",
    blocked: s.blocked ?? "Composer cannot run yet.",
    applied: "Applied to your files. Undo is in Composer's history.",
    discarded: "Discarded. Your files are as they were.",
  };
  // Handed over, made, checked, applied: how far each stage got.
  const table: Record<HandoffStage, [StepState, StepState, StepState, StepState]> = {
    sent: ["done", "active", "todo", "todo"],
    working: ["done", "active", "todo", "todo"],
    checking: ["done", "done", "active", "todo"],
    ready: ["done", "done", "done", "active"],
    notes: ["done", "done", "done", "active"],
    failed: ["done", "done", "failed", "todo"],
    answered: ["done", "done", "todo", "todo"],
    blocked: ["failed", "todo", "todo", "todo"],
    applied: ["done", "done", "done", "done"],
    discarded: ["done", "done", "done", "todo"],
  };
  const labels = [
    stage === "blocked" ? "Composer could not start" : "Handed to Composer",
    "Make the change",
    "Check it: parses, imports, types, preview, tests",
    "Your Apply",
  ];
  const steps = labels.map((label, i) => ({ label, state: table[stage][i]! }));
  return { stage, title: title[stage], steps };
}
