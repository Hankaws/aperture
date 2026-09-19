export type NextKind = "wait" | "build" | "workers" | "notes" | "reviewer" | "review" | "apply" | "crew" | "compose";

export type NextAction = {
  kind: NextKind;
  title: string;
  detail: string;
  cta: string;
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
