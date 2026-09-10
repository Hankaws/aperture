import type { PlanEntry, PlanPriority, PlanStatus } from "./types";

const STATUSES: PlanStatus[] = ["pending", "in_progress", "completed"];
const PRIORITIES: PlanPriority[] = ["high", "medium", "low"];

function asStatus(value: unknown): PlanStatus {
  return STATUSES.includes(value as PlanStatus) ? (value as PlanStatus) : "pending";
}

function asPriority(value: unknown): PlanPriority {
  return PRIORITIES.includes(value as PlanPriority) ? (value as PlanPriority) : "medium";
}

/** Normalize a model or ACP plan payload into at most 12 UI rows. */
export function normalizePlan(raw: unknown): PlanEntry[] {
  if (!raw) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    if (Array.isArray(row.entries)) list = row.entries;
    else if (Array.isArray(row.steps)) list = row.steps;
  }

  const out: PlanEntry[] = [];
  for (let i = 0; i < list.length && out.length < 12; i += 1) {
    const item = list[i];
    if (typeof item === "string") {
      const content = item.trim().slice(0, 160);
      if (!content) continue;
      out.push({ id: `p${out.length + 1}`, content, status: "pending", priority: "medium" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const content = typeof row.content === "string" ? row.content.trim().slice(0, 160) : "";
    if (!content) continue;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 40) : `p${out.length + 1}`;
    out.push({
      id,
      content,
      status: asStatus(row.status),
      priority: asPriority(row.priority),
    });
  }
  return out;
}

export function mergePlan(prev: PlanEntry[] | undefined, next: PlanEntry[]): PlanEntry[] {
  if (!prev || prev.length === 0) return next;
  if (next.length === 0) return prev;
  const byId = new Map(prev.map((e) => [e.id, e]));
  const byContent = new Map(prev.map((e) => [e.content, e]));
  return next.map((entry, i) => {
    const old = byId.get(entry.id) ?? byContent.get(entry.content) ?? prev[i];
    if (!old) return entry;
    return {
      ...old,
      ...entry,
      id: old.id,
    };
  });
}
