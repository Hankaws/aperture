export type NextKind = "wait" | "build" | "workers" | "notes" | "reviewer" | "review" | "apply" | "fix" | "crew" | "compose";

export type NextAction = {
  kind: NextKind;
  title: string;
  detail: string;
  cta: string;
  /** A second choice, when the main one is not the only sensible move. */
  altKind?: NextKind;
  altCta?: string;
};

export function nextAction(input: {
  running: boolean;
  awaiting: boolean;
  pending: number;
  workerCount: number;
  crewModels: number;
  keyReady: number;
  messages: number;
  noteCount?: number;
  reviewerLabel?: string;
  /** Settled check results for the staged change. Absent while nothing is staged. */
  checks?: "running" | "clear" | "failed";
  /** How many composer copies still have unapplied edits. */
  copies?: number;
  /** Every staged edit has already had its review pass. */
  reviewed?: boolean;
}): NextAction {
  if (input.running) {
    return { kind: "wait", title: "Composer is working", detail: "Steer in the box if you want to add a follow-up.", cta: "Wait" };
  }
  if (input.awaiting && input.workerCount >= 2) {
    return {
      kind: "workers",
      title: `Run ${input.workerCount} workers on this plan`,
      detail: "Each owns a file group. Nothing starts until you confirm.",
      cta: `Confirm ${input.workerCount}`,
    };
  }
  if (input.awaiting) {
    return { kind: "build", title: "Build this plan", detail: "One builder. Diffs still wait for Apply.", cta: "Build it" };
  }
  if (input.pending > 0 && (input.noteCount ?? 0) > 0) {
    const n = input.noteCount ?? 0;
    return {
      kind: "notes",
      title: `Send ${n} ${n === 1 ? "note" : "notes"} to Composer`,
      detail: "Apply is blocked until you send or dismiss the notes.",
      cta: "Send notes",
    };
  }
  if (input.pending > 0 && input.checks === "failed") {
    return {
      kind: "fix",
      title: "A check failed — send it back, or remember it",
      detail: "Send it back to Composer, or apply and remember the failure.",
      cta: "Send back",
      altKind: "apply",
      altCta: "Apply anyway",
    };
  }
  if (input.pending > 0 && input.checks === "clear" && !input.reviewed) {
    return {
      kind: "reviewer",
      title: "Review the diff before you keep it",
      detail: "One pass. A comment only where something is wrong. Dismiss it and it will not come back.",
      cta: "Review",
      altKind: "apply",
      altCta: (input.copies ?? 0) > 1 ? "Keep anyway" : "Apply anyway",
    };
  }
  if (input.pending > 0 && input.checks === "clear") {
    if ((input.copies ?? 0) > 1) {
      return {
        kind: "apply",
        title: `Keep this copy · ${input.pending} ${input.pending === 1 ? "file" : "files"}`,
        detail: "The other run is dropped. Checks are in.",
        cta: "Keep this",
      };
    }
    return {
      kind: "apply",
      title: `Apply ${input.pending} staged ${input.pending === 1 ? "file" : "files"}`,
      detail: "Checks are in. Amber means that failure was already there.",
      cta: "Apply",
    };
  }
  if (input.pending > 0 && input.crewModels >= 2 && (input.noteCount ?? 0) === 0) {
    return {
      kind: "reviewer",
      title: `${input.reviewerLabel ?? "Crew"} reviews these diffs`,
      detail: "Notes only. Diffs stay staged until you Apply.",
      cta: "Confirm review",
    };
  }
  if (input.pending > 0) {
    return {
      kind: "review",
      title: `Review ${input.pending} staged ${input.pending === 1 ? "file" : "files"}`,
      detail: "Enter keeps a hunk, Backspace drops it. F8 jumps. Apply when notes are clear.",
      cta: "Open review",
    };
  }
  if (input.keyReady >= 2 && input.crewModels < 2) {
    return {
      kind: "crew",
      title: "Put Claude and GPT on this project",
      detail: "Toggle seats in Crew. Plan with one, confirm workers to split the build.",
      cta: "Show crew",
    };
  }
  if (input.messages === 0) {
    return { kind: "compose", title: "Describe the change", detail: "Composer plans first. Use @ or Auto-context.", cta: "Focus" };
  }
  return { kind: "compose", title: "Iterate or ask", detail: "/review staged work, or describe the next change.", cta: "Focus" };
}
