import type { AgentInput } from "@/lib/agent/types";
import type { WorkerSpec } from "@/lib/agent/crew";
import { parseWorkerRole } from "@/lib/agent/crew";
import { parseAgentPhase } from "@/lib/agent/phase";
import { isAgentRef } from "@/lib/acp/kinds";
import { isModelSource } from "@/lib/billing/plans";
import { redactSecrets, safeRelPath } from "./redact";
import { cleanPaths, pickAgentFileSet } from "./agent-files";
import { normalizePlan } from "@/lib/workspace/plan";

// Under Vercel's 4.5 MB request limit, with room for JSON escaping of 2.5 MB of files.
export const MAX_AGENT_BODY = 4_000_000;
export const MAX_INSTRUCTION = 8_000;
export const MAX_HISTORY = 8;
export const MAX_HISTORY_CHARS = 4_000;
export const MAX_SELECTION_CHARS = 12_000;

export { rateLimit } from "./rate-limit";

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

  let selection: AgentInput["selection"] = null;
  const sel = input.selection;
  if (sel && typeof sel === "object") {
    const row = sel as Record<string, unknown>;
    const path = typeof row.path === "string" ? safeRelPath(row.path) : null;
    if (path && typeof row.text === "string") {
      // Inline swaps the selected text for its rewrite: a cut selection would leave the rest behind it.
      if (mode === "inline" && row.text.length > MAX_SELECTION_CHARS) {
        return {
          error: `That selection is too long for an inline edit (over ${MAX_SELECTION_CHARS.toLocaleString("en-US")} characters). Select less, or ask in Composer.`,
        };
      }
      selection = {
        path,
        text: redactSecrets(row.text.slice(0, MAX_SELECTION_CHARS), path),
        fromLine: Math.max(1, Number(row.fromLine) || 1),
        toLine: Math.max(1, Number(row.toLine) || 1),
      };
    }
  }

  const activePath =
    typeof input.activePath === "string" ? safeRelPath(input.activePath) : input.activePath === null ? null : undefined;

  const focusPaths = cleanPaths(input.focusPaths);
  const openTabs = cleanPaths(input.openTabs);
  const recentPaths = cleanPaths(input.recentPaths);
  // What the person is working on goes first, so a large project never loses it.
  const { files, left } = pickAgentFileSet(
    input.files,
    [activePath ?? "", selection?.path ?? "", ...focusPaths, ...openTabs, ...recentPaths].filter(Boolean),
  );

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
      if (!path || typeof rec.oldText !== "string" || typeof rec.newText !== "string") continue;
      // A file the run created (a move's new path) is not in the project yet.
      if (!known.has(path) && rec.oldText !== "") continue;
      pendingEdits.push({
        id: typeof rec.id === "string" ? rec.id.slice(0, 80) : `pending_${pendingEdits.length}_${path}`,
        path,
        oldText: rec.oldText.slice(0, 20_000),
        newText: rec.newText.slice(0, 20_000),
        description: typeof rec.description === "string" ? rec.description.slice(0, 200) : path,
        status: "pending",
        ...(rec.deleted === true ? { deleted: true } : {}),
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
    focusPaths: focusPaths.length ? focusPaths : undefined,
    openTabs: openTabs.length ? openTabs : undefined,
    recentPaths: recentPaths.length ? recentPaths : undefined,
    leftOut: left.length ? left.slice(0, 50) : undefined,
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
    standing: parseStanding(input.standing),
    refusals: parseStanding(input.refusals),
    spot: parseSpot(input.spot),
    userMove: parseUserMove(input.userMove),
  };
}

function parseStanding(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const lines: string[] = [];
  for (const row of raw) {
    if (typeof row !== "string") continue;
    const line = row.replace(/\s+/g, " ").trim().slice(0, 240);
    if (line.length < 8) continue;
    if (lines.some((kept) => kept.toLowerCase() === line.toLowerCase())) continue;
    lines.push(line);
    if (lines.length >= 8) break;
  }
  return lines.length ? lines : undefined;
}

function parseUserMove(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim().slice(0, 2000);
  return text.startsWith("What the user just did:") ? text : undefined;
}

function parseSpot(raw: unknown): AgentInput["spot"] {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const file = typeof rec.file === "string" ? rec.file.replace(/\s+/g, " ").trim().slice(0, 180) : "";
  const line = typeof rec.line === "number" && Number.isFinite(rec.line) ? Math.max(0, Math.floor(rec.line)) : 0;
  const check = typeof rec.check === "string" ? rec.check.replace(/\s+/g, " ").trim().slice(0, 180) : "";
  const element = typeof rec.element === "string" ? rec.element.replace(/\s+/g, " ").trim().slice(0, 180) : "";
  if (!file && !line && !check && !element) return undefined;
  return { file: file || null, line: line || null, check: check || null, element: element || null };
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
