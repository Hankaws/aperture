import type { AgentInput } from "@/lib/agent/types";
import type { WorkerSpec } from "@/lib/agent/crew";
import { parseWorkerRole } from "@/lib/agent/crew";
import { parseAgentPhase } from "@/lib/agent/phase";
import { isAgentRef } from "@/lib/acp/kinds";
import { isModelSource } from "@/lib/billing/plans";
import { redactSecrets, safeRelPath, isSecretPath } from "./redact";
import { normalizePlan } from "@/lib/workspace/plan";

export const MAX_AGENT_BODY = 2_800_000;
export const MAX_INSTRUCTION = 8_000;
export const MAX_HISTORY = 8;
export const MAX_HISTORY_CHARS = 4_000;
export const MAX_FILES = 120;
export const MAX_FILE_CHARS = 200_000;
export const MAX_TOTAL_CHARS = 2_500_000;

const hits = new Map<string, number[]>();

export function rateLimit(id: string, max = 24, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(id, arr);
  return true;
}

export function sanitizeAgentInput(raw: unknown): AgentInput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid request" };
  const input = raw as Record<string, unknown>;
  const mode = input.mode;
  if (mode !== "chat" && mode !== "composer" && mode !== "inline") {
    return { error: "Unknown agent mode" };
  }
  const instruction = typeof input.instruction === "string" ? input.instruction.slice(0, MAX_INSTRUCTION) : "";
  if (!instruction.trim()) return { error: "Empty instruction" };

  const historyIn = Array.isArray(input.history) ? input.history.slice(-MAX_HISTORY) : [];
  const history: AgentInput["history"] = [];
  for (const turn of historyIn) {
    if (!turn || typeof turn !== "object") continue;
    const row = turn as Record<string, unknown>;
    const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
    if (!role || typeof row.content !== "string") continue;
    history.push({ role, content: redactSecrets(row.content.slice(0, MAX_HISTORY_CHARS)) });
  }

  const filesIn = Array.isArray(input.files) ? input.files.slice(0, MAX_FILES) : [];
  const files: AgentInput["files"] = [];
  let used = 0;
  for (const file of filesIn) {
    if (!file || typeof file !== "object") continue;
    const row = file as Record<string, unknown>;
    if (typeof row.path !== "string" || typeof row.content !== "string") continue;
    const path = safeRelPath(row.path);
    if (!path || isSecretPath(path)) continue;
    const room = MAX_TOTAL_CHARS - used;
    if (room <= 0) break;
    const content = redactSecrets(row.content.slice(0, Math.min(MAX_FILE_CHARS, room)));
    files.push({ path, content });
    used += content.length;
  }

  let selection: AgentInput["selection"] = null;
  const sel = input.selection;
  if (sel && typeof sel === "object") {
    const row = sel as Record<string, unknown>;
    const path = typeof row.path === "string" ? safeRelPath(row.path) : null;
    if (path && typeof row.text === "string") {
      selection = {
        path,
        text: redactSecrets(row.text.slice(0, 12_000)),
        fromLine: Math.max(1, Number(row.fromLine) || 1),
        toLine: Math.max(1, Number(row.toLine) || 1),
      };
    }
  }

  const activePath =
    typeof input.activePath === "string" ? safeRelPath(input.activePath) : input.activePath === null ? null : undefined;

  let source: AgentInput["source"] = undefined;
  if (input.source === null || input.source === undefined || input.source === "") {
    source = undefined;
  } else if (typeof input.source === "string" && isModelSource(input.source)) {
    source = input.source;
  } else {
    return { error: "Unknown model" };
  }

  let agentId: AgentInput["agentId"] = null;
  if (input.agentId === null || input.agentId === undefined || input.agentId === "") {
    agentId = null;
  } else if (typeof input.agentId === "string" && isAgentRef(input.agentId)) {
    agentId = input.agentId;
  } else if (typeof input.agentId === "string") {
    return { error: "Unknown agent" };
  }

  const phase = parseAgentPhase(input.phase);
  const approvedPlan = normalizePlan(input.approvedPlan);
  const known = new Set(files.map((f) => f.path));
  const workers: WorkerSpec[] = [];
  if (Array.isArray(input.workers)) {
    for (const row of input.workers.slice(0, 3)) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const paths = Array.isArray(rec.files)
        ? rec.files
            .filter((p): p is string => typeof p === "string")
            .map((p) => safeRelPath(p))
            .filter((p): p is string => typeof p === "string" && known.has(p))
            .slice(0, 12)
        : [];
      if (paths.length === 0) continue;
      const wsource =
        typeof rec.source === "string" && isModelSource(rec.source) ? rec.source : undefined;
      const label = typeof rec.label === "string" ? rec.label.slice(0, 80) : paths[0]!;
      workers.push({
        files: paths,
        steps: normalizePlan(rec.steps),
        source: wsource,
        label,
        agentId: null,
        role: parseWorkerRole(rec.role),
      });
    }
  }

  const pendingEdits: AgentInput["pendingEdits"] = [];
  if (Array.isArray(input.pendingEdits)) {
    for (const row of input.pendingEdits.slice(0, 8)) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const path = typeof rec.path === "string" ? safeRelPath(rec.path) : null;
      if (!path || !known.has(path)) continue;
      if (typeof rec.oldText !== "string" || typeof rec.newText !== "string") continue;
      pendingEdits.push({
        id: typeof rec.id === "string" ? rec.id.slice(0, 80) : `pending_${pendingEdits.length}_${path}`,
        path,
        oldText: rec.oldText.slice(0, 20_000),
        newText: rec.newText.slice(0, 20_000),
        description: typeof rec.description === "string" ? rec.description.slice(0, 200) : path,
        status: "pending",
        notes: Array.isArray(rec.notes)
          ? rec.notes.slice(0, 12).flatMap((note) => {
              if (!note || typeof note !== "object") return [];
              const n = note as Record<string, unknown>;
              if (typeof n.text !== "string") return [];
              return [
                {
                  id: typeof n.id === "string" ? n.id.slice(0, 80) : `n_${path}`,
                  excerpt: typeof n.excerpt === "string" ? n.excerpt.slice(0, 80) : "",
                  type: n.type === "del" ? "del" : n.type === "eq" ? "eq" : "add",
                  text: n.text.slice(0, 400),
                },
              ];
            })
          : undefined,
      });
    }
  }

  const keepWorkers = workers.length >= 2 || workers.some((w) => w.role === "review");

  return {
    mode,
    instruction: redactSecrets(instruction),
    history,
    files,
    activePath,
    selection,
    source,
    agentId,
    phase,
    approvedPlan: approvedPlan.length > 0 ? approvedPlan : undefined,
    workers: keepWorkers ? workers : undefined,
    role: parseWorkerRole(input.role) === "review" ? "review" : undefined,
    pendingEdits: pendingEdits.length ? pendingEdits : undefined,
    debug: input.debug === true,
    compacted:
      typeof input.compacted === "number" && Number.isFinite(input.compacted) && input.compacted > 0
        ? Math.min(200, Math.floor(input.compacted))
        : undefined,
    browserRuns: parseBrowserRuns(input.browserRuns),
  };
}

function parseBrowserRuns(raw: unknown): AgentInput["browserRuns"] {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const used = typeof rec.used === "number" && Number.isFinite(rec.used) ? Math.max(0, Math.floor(rec.used)) : 0;
  const unsupported = Array.isArray(rec.unsupported)
    ? rec.unsupported.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 80)).slice(0, 8)
    : [];
  return { used: Math.min(used, 100), unsupported };
}
