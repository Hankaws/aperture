import { grepFiles, semanticSearch, type SearchHit } from "@/lib/indexer/search";
import { applySearchReplace } from "./apply-edit";
import { safeRelPath } from "@/lib/security/redact";
import { normalizePlan } from "@/lib/workspace/plan";
import type { IndexedChunk, PlanEntry, ProposedEdit } from "@/lib/workspace/types";
import type { AgentPhase } from "./phase";

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "set_plan",
      description:
        "Post or update the visible todo list. In Plan mode, call this then stop — the user clicks Build it. In Build mode, update statuses as you complete steps.",
      parameters: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["content"],
            },
          },
        },
        required: ["entries"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "semantic_search",
      description:
        "Search the indexed workspace by meaning. Use this first when you do not know which file holds the answer.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural-language or keyword query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "grep",
      description: "Exact or regex search across every file. Returns matching lines.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read a file. Optionally clip to a line range (1-based, inclusive).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          startLine: { type: "number" },
          endLine: { type: "number" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_dir",
      description: "List workspace files, optionally under a folder prefix.",
      parameters: {
        type: "object",
        properties: {
          prefix: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_edit",
      description:
        "Propose a focused edit. `search` must uniquely identify the text to replace. Empty search replaces the whole file. Do not apply edits yourself — the user will accept them in the UI. Locked in Plan mode until the user clicks Build it.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          search: { type: "string", description: "Exact existing text to replace. Empty = whole file." },
          replace: { type: "string", description: "Replacement text" },
          description: { type: "string", description: "One-line summary of the change" },
        },
        required: ["path", "replace"],
      },
    },
  },
];

export type AgentToolDef = (typeof AGENT_TOOLS)[number];

export function toolsForStep(kind: "read" | "plan" | "edit"): AgentToolDef[] {
  if (kind === "read") {
    return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit" && t.function.name !== "set_plan");
  }
  if (kind === "plan") {
    return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit");
  }
  return AGENT_TOOLS;
}

export type ToolContext = {
  files: Record<string, string>;
  chunks: IndexedChunk[];
  edits: ProposedEdit[];
  plan: PlanEntry[];
  requirePlan: boolean;
  phase: AgentPhase;
  mode: "chat" | "composer" | "inline";
};

function clip(text: string, max = 8000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… truncated`;
}

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): string {
  if (name === "set_plan") {
    if (ctx.mode === "chat") return "Ask mode does not plan. Switch to Agent.";
    ctx.plan = normalizePlan(args.entries ?? args);
    if (ctx.plan.length === 0) return "Plan was empty. Pass entries: [{ content, status }].";
    if (ctx.phase === "plan") {
      return `Plan set (${ctx.plan.length} steps). Stop. The user will click Build it.`;
    }
    return `Plan set (${ctx.plan.length} steps). Update statuses as you go, then edit.`;
  }

  if (name === "semantic_search") {
    const query = String(args.query ?? "");
    const hits: SearchHit[] = semanticSearch(ctx.chunks, query, 8);
    if (hits.length === 0) return "No matching chunks.";
    return hits
      .map((h) => {
        const c = h.chunk;
        return [
          `# ${c.path}  ${c.name}  L${c.startLine}-L${c.endLine}  score=${h.score.toFixed(3)}`,
          c.text.split("\n").slice(0, 28).join("\n"),
        ].join("\n");
      })
      .join("\n\n---\n\n");
  }

  if (name === "grep") {
    const pattern = String(args.pattern ?? "");
    const hits = grepFiles(ctx.files, pattern, 40);
    if (hits.length === 0) return "No matches.";
    return hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n");
  }

  if (name === "read_file") {
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const content = ctx.files[path];
    if (content === undefined) {
      const keys = Object.keys(ctx.files);
      return `File not found: ${path}. Known files:\n${keys.join("\n")}`;
    }
    const lines = content.split("\n");
    const start = Math.max(1, Number(args.startLine ?? 1));
    const end = Math.min(lines.length, Number(args.endLine ?? lines.length));
    const body = lines
      .slice(start - 1, end)
      .map((line, i) => `${String(start + i).padStart(4, " ")} ${line}`)
      .join("\n");
    return clip(body);
  }

  if (name === "list_dir") {
    const prefix = String(args.prefix ?? "");
    const paths = Object.keys(ctx.files)
      .filter((p) => (prefix ? p === prefix || p.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) : true))
      .sort();
    return paths.map((p) => `${p}  (${ctx.files[p]!.split("\n").length} lines)`).join("\n") || "(empty)";
  }

  if (name === "propose_edit") {
    if (ctx.mode === "chat") {
      return "Ask mode does not edit. The user can switch to Agent.";
    }
    if (ctx.phase === "plan") {
      return "Edits are locked until the user clicks Build it.";
    }
    if (ctx.requirePlan && ctx.plan.length === 0) {
      return "Edits are locked until you call set_plan with 3–7 steps.";
    }
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const search = String(args.search ?? "");
    const replace = String(args.replace ?? "");
    const description = String(args.description ?? "Update file");
    const current = ctx.files[path];
    if (current === undefined) return `File not found: ${path}`;
    const applied = applySearchReplace(current, search, replace);
    if (!applied.ok) return `Edit rejected: ${applied.error}`;
    ctx.files[path] = applied.next;
    ctx.edits.push({
      id: `edit_${ctx.edits.length + 1}_${path}`,
      path,
      oldText: current,
      newText: applied.next,
      description,
      status: "pending",
    });
    return `Edit staged for ${path}. The user must accept it in the UI.`;
  }

  return `Unknown tool: ${name}`;
}
