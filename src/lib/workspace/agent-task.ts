import type { ChatMessage, PlanEntry } from "./types";

export type AgentTaskKind = "ready" | "indexing" | "running" | "awaiting" | "preview";

export type AgentTask = {
  kind: AgentTaskKind;
  label: string;
  detail: string;
  done: number;
  total: number;
};

export function latestAssistantPlan(messages: ChatMessage[]): {
  plan: PlanEntry[];
  awaiting: boolean;
  current: PlanEntry | undefined;
  tool: string | null;
} {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role !== "assistant") continue;
    const plan = message.plan ?? [];
    const current =
      plan.find((e) => e.status === "in_progress") ?? plan.find((e) => e.status === "pending");
    const tool = message.traces?.at(-1)?.name ?? null;
    if (plan.length > 0 || message.awaitingBuild || tool) {
      return { plan, awaiting: Boolean(message.awaitingBuild), current, tool };
    }
  }
  return { plan: [], awaiting: false, current: undefined, tool: null };
}

export function resolveAgentTask(input: {
  running: boolean;
  indexing: boolean;
  preview: boolean;
  messages: ChatMessage[];
}): AgentTask {
  const { plan, awaiting, current, tool } = latestAssistantPlan(input.messages);
  const done = plan.filter((e) => e.status === "completed").length;
  const total = plan.length;

  if (input.running) {
    const last = [...input.messages].reverse().find((m) => m.role === "assistant");
    const status = last?.status ?? "";
    const label = /Build/i.test(status)
      ? "Building"
      : /Writ|Iterat|Verif/i.test(status)
        ? "Iterating"
        : /Analyz|Ask/i.test(status)
          ? "Asking"
          : "Planning";
    return {
      kind: "running",
      label,
      detail: current?.content || tool || "Composer",
      done,
      total,
    };
  }
  if (awaiting) {
    return {
      kind: "awaiting",
      label: "Needs you",
      detail: current?.content || "Build the plan",
      done,
      total,
    };
  }
  if (input.indexing) {
    return { kind: "indexing", label: "Indexing", detail: "", done, total };
  }
  if (input.preview) {
    return { kind: "preview", label: "Design Mode", detail: total ? `${done}/${total}` : "", done, total };
  }
  if (total > 0 && done < total) {
    return {
      kind: "ready",
      label: "Plan",
      detail: current?.content || `${done}/${total}`,
      done,
      total,
    };
  }
  return { kind: "ready", label: "Ready", detail: "", done, total };
}
