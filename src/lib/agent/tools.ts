import { grepFiles, semanticSearch, type SearchHit } from "@/lib/indexer/search";
import { applySearchReplace } from "./apply-edit";
import { previewNotesForEdit } from "@/lib/workspace/preview-check";
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
          path: { type: "string", description: "Optional file or folder to limit the search." },
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
  {
    type: "function" as const,
    function: {
      name: "note_diff",
      description:
        "Attach a review note to a staged diff. Use this instead of propose_edit when reviewing. excerpt is the line you are commenting on.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          excerpt: { type: "string" },
          type: { type: "string", enum: ["add", "del", "eq"] },
          text: { type: "string", description: "What should change and why" },
        },
        required: ["path", "text"],
      },
    },
  },
];

export type AgentToolDef = (typeof AGENT_TOOLS)[number];

export function toolsForStep(kind: "read" | "plan" | "edit" | "review"): AgentToolDef[] {
  if (kind === "read") {
    return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit" && t.function.name !== "set_plan" && t.function.name !== "note_diff");
  }
  if (kind === "plan") {
    return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit" && t.function.name !== "note_diff");
  }
  if (kind === "review") {
    return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit" && t.function.name !== "set_plan");
  }
  return AGENT_TOOLS.filter((t) => t.function.name !== "note_diff");
}

export type ToolContext = {
  files: Record<string, string>;
  chunks: IndexedChunk[];
  edits: ProposedEdit[];
  plan: PlanEntry[];
  requirePlan: boolean;
  phase: AgentPhase;
  mode: "chat" | "composer" | "inline";
  role?: "build" | "review";
};

function clip(text: string, max = 8000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… truncated`;
}

function nearbySnippet(content: string, search: string): string {
  const needle = search.trim().split("\n")[0]?.slice(0, 48) ?? "";
  const lines = content.split("\n");
  if (!needle) return `File is ${lines.length} lines.`;
  let idx = lines.findIndex((line) => line.includes(needle));
  if (idx < 0 && needle.length > 12) {
    const short = needle.slice(0, 12);
    idx = lines.findIndex((line) => line.includes(short));
  }
  if (idx < 0) return `No similar line. File is ${lines.length} lines.`;
  const from = Math.max(0, idx - 2);
  return lines
    .slice(from, idx + 3)
    .map((line, i) => `${from + i + 1}| ${line}`)
    .join("\n");
}

function similarPaths(path: string, keys: string[]): string[] {
  const base = path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
  if (!base) return [];
  return keys.filter((key) => key.toLowerCase() === path.toLowerCase() || key.toLowerCase().endsWith(`/${base}`) || key.toLowerCase().includes(base)).slice(0, 8);
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
    const hits = grepFiles(ctx.files, pattern, 40, typeof args.path === "string" ? args.path : undefined);
    if (hits.length === 0) return "No matches.";
    return hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n");
  }

  if (name === "read_file") {
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const content = ctx.files[path];
    if (content === undefined) {
      const keys = Object.keys(ctx.files);
      const close = similarPaths(path, keys);
      const hint = close.length > 0 ? `Did you mean:\n${close.join("\n")}` : `Known files:\n${keys.join("\n")}`;
      return `File not found: ${path}. ${hint}`;
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
    if (ctx.role === "review") return "Review mode: call note_diff. Do not propose_edit.";
    if (ctx.phase === "plan") {
      return "Edits are locked until the user clicks Build it.";
    }
    if (ctx.requirePlan && ctx.plan.length === 0 && ctx.phase !== "skip") {
      return "Edits are locked until you call set_plan with 3–7 steps.";
    }
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const search = String(args.search ?? "");
    const replace = String(args.replace ?? "");
    const description = String(args.description ?? "Update file");
    const current = ctx.files[path];
    if (current === undefined) return `File not found: ${path}`;
    const applied = applySearchReplace(current, search, replace);
    if (!applied.ok) {
      return `Edit rejected: ${applied.error}\nNearby:\n${nearbySnippet(current, search)}`;
    }
    ctx.files[path] = applied.next;
    const edit: ProposedEdit = {
      id: `edit_${ctx.edits.length + 1}_${path}`,
      path,
      oldText: current,
      newText: applied.next,
      description,
      status: "pending",
    };
    const notes = previewNotesForEdit(edit, ctx.files);
    if (notes.length) edit.notes = notes;
    ctx.edits.push(edit);
    if (notes.length) {
      return `Edit staged for ${path}, but preview check failed: ${notes.map((n) => n.text.replace("Preview check: ", "")).join("; ")}. Fix before the user can Apply.`;
    }
    return `Edit staged for ${path}. The user must accept it in the UI.`;
  }

  if (name === "note_diff") {
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const text = String(args.text ?? "").trim().slice(0, 400);
    if (!path || !text) return "Pass path and text.";
    const excerpt = String(args.excerpt ?? "").slice(0, 80);
    const kind = args.type === "del" ? "del" : args.type === "eq" ? "eq" : "add";
    const edit = [...ctx.edits].reverse().find((row) => row.path === path && row.status === "pending");
    if (!edit) return `No pending edit for ${path}. Review staged diffs only.`;
    edit.notes = [...(edit.notes ?? []), { id: `n_${(edit.notes?.length ?? 0) + 1}_${path}`, excerpt, type: kind, text }];
    return `Note added on ${path}.`;
  }

  return `Unknown tool: ${name}`;
}
