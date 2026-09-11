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
