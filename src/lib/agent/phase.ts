import type { PlanEntry } from "@/lib/workspace/types";

export type AgentPhase = "plan" | "build" | "skip";

export function parseAgentPhase(value: unknown): AgentPhase | undefined {
  if (value === "plan" || value === "build" || value === "skip") return value;
  return undefined;
}

export function resolveAgentPhase(
  mode: "chat" | "composer" | "inline",
  phase?: AgentPhase | null,
): AgentPhase {
  if (mode === "inline") return "skip";
  if (phase === "build" || phase === "skip" || phase === "plan") return phase;
  return "plan";
}

export function toolKindFor(
  mode: "chat" | "composer" | "inline",
  phase: AgentPhase,
): "read" | "plan" | "edit" {
  if (mode === "chat") return "read";
  if (mode === "inline") return "edit";
  if (phase === "build" || phase === "skip") return "edit";
  return "plan";
}

/** After a plan exists, stop if this step did not keep researching. */
export function shouldAwaitBuild(phase: AgentPhase, hasPlan: boolean, toolNames: string[]): boolean {
  if (phase !== "plan" || !hasPlan) return false;
  return toolNames.every((name) => name === "set_plan" || name === "propose_edit");
}

export function planReadyText(content: string | undefined): string {
  const text = content?.trim();
  if (text) return text;
  return "Plan ready. Click Build it when you want the edits.";
}

const BUILD_INTENT = /^(build it|go ahead|do it|yes|lgtm|ship it|continue|apply( it)?)\.?!?$/i;

export function isBuildIntent(text: string): boolean {
  return BUILD_INTENT.test(text.trim());
}

type PhaseHint = {
  role: string;
  awaitingBuild?: boolean;
  plan?: PlanEntry[];
  edits?: { status: string }[];
};

/** Pick the next Composer phase from the last assistant turn. Explicit phase wins. */
export function nextComposerPhase(
  messages: PhaseHint[],
  instruction: string,
  explicit?: AgentPhase,
): { phase: AgentPhase; approvedPlan?: PlanEntry[] } {
  if (explicit) {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.plan && m.plan.length > 0);
    if (explicit === "build") {
      if (last?.plan?.length) return { phase: "build", approvedPlan: last.plan };
      return { phase: "skip" };
    }
    return { phase: explicit };
  }
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (last?.awaitingBuild && last.plan?.length) {
    if (isBuildIntent(instruction)) return { phase: "build", approvedPlan: last.plan };
    return { phase: "plan" };
  }
  if (last?.edits?.some((e) => e.status === "pending" || e.status === "applied")) {
    return { phase: "skip" };
  }
  return { phase: "plan" };
}
