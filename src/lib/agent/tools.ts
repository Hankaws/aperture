import { grepFiles, semanticSearch, type SearchHit } from "@/lib/indexer/search";
import { applySearchReplace } from "./apply-edit";
import { checkLabel, previewNotesForEdit } from "@/lib/workspace/preview-check";
import { keepEdit, keepReviewNote, parseConfidence } from "@/lib/workspace/diff-notes";
import { safeRelPath } from "@/lib/security/redact";
import { moveTarget } from "@/lib/workspace/file-move";
import { isTsPath } from "@/lib/workspace/tsc-core";
import { LESSONS_PATH, upsertLesson } from "@/lib/workspace/lessons";
import { normalizePlan } from "@/lib/workspace/plan";
import type { ParseCheck } from "@/lib/workspace/ts-parse";
import type { ParseLoader } from "./parse-host";
import type { AnswerTo, CodeQuestion } from "./code-intel";
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
      name: "find_references",
      description:
        "Every place a TypeScript name (function, type, variable, export) is declared or used, from the TypeScript compiler: it follows imports under another name and skips comments, strings and unrelated names spelled the same, which grep cannot. Use it before changing what a name takes or returns.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "A file where the name appears." },
          name: { type: "string", description: "The name, e.g. listTasks." },
          line: { type: "number", description: "Optional 1-based line, when the file has more than one thing by that name." },
        },
        required: ["path", "name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_symbol",
      description:
        "Where a TypeScript name is declared, from the TypeScript compiler: functions, classes, types, interfaces, constants and methods whose names fit the query, with file, line and kind. Use it to find a definition by name when you do not know the file; unlike grep it skips comments, strings and calls. Then read_file at that line, or find_references for its uses.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The name or part of it, e.g. listTasks or TaskSt." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rename_symbol",
      description:
        "Rename a TypeScript name everywhere it is used, as the editor's F2 does, and stage one edit per file it changes. Safer than editing each use by hand: imports, re-exports and shorthand properties stay right. Comments and strings keep the old name. Same locks and confidence rule as propose_edit.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "A file where the name appears." },
          name: { type: "string", description: "The current name." },
          newName: { type: "string", description: "The new name." },
          line: { type: "number", description: "Optional 1-based line, when the file has more than one thing by that name." },
          confidence: { type: "number", description: "0 to 1. How sure this rename is right. Below 0.8 it is dropped." },
        },
        required: ["path", "name", "newName", "confidence"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "move_file",
      description:
        "Move or rename a file, as the editor's file tree does, and stage the move: the file under its new path and the old path removed. For TypeScript the compiler also updates every import of it and its own relative imports, so do not fix those by hand. Same locks and confidence rule as propose_edit.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "The file's path now." },
          to: { type: "string", description: "Its new path, file name included." },
          confidence: { type: "number", description: "0 to 1. How sure this move is right. Below 0.8 it is dropped." },
        },
        required: ["from", "to", "confidence"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_edit",
      description:
        "Propose a focused edit. `search` must uniquely identify the text to replace. Empty search replaces the whole file. Pass confidence from 0 to 1. Below 0.8 the edit is dropped and the turn stops. Do not apply edits yourself — the user will accept them in the UI. Locked in Plan mode until the user clicks Build it.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          search: { type: "string", description: "Exact existing text to replace. Empty = whole file." },
          replace: { type: "string", description: "Replacement text" },
          description: { type: "string", description: "One-line summary of the change" },
          confidence: { type: "number", description: "0 to 1. How sure this edit is right. Below 0.8 it is dropped." },
        },
        required: ["path", "replace", "confidence"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_script",
      description:
        "Run one of the project's own package.json scripts against your staged edits and read the real output. Use it to check work before handing it over — a failing test tells you more than re-reading the diff. Tests run in the user's browser when they can (the output then arrives as the next message), otherwise in a sandbox. Only declared scripts run; servers like dev and start cannot.",
      parameters: {
        type: "object",
        properties: {
          script: { type: "string", description: "A script name declared in package.json, e.g. test or typecheck." },
        },
        required: ["script"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mcp_call",
      description:
        "Call a tool on a connected MCP server. server is the name from Settings. arguments is a JSON object as a string. Read-only tools return immediately. Anything that changes state is staged until the user confirms.",
      parameters: {
        type: "object",
        properties: {
          server: { type: "string" },
          tool: { type: "string" },
          arguments: { type: "string", description: "JSON object. Use {} when the tool takes none." },
        },
        required: ["server", "tool"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "note_diff",
      description:
        "Typed review decision for one line. bug is true only for a real bug. confidence is 0 to 1. A note is kept only when bug is true and confidence is at least 0.8.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          excerpt: { type: "string" },
          type: { type: "string", enum: ["add", "del", "eq"] },
          text: { type: "string", description: "What is wrong, one sentence" },
          bug: { type: "boolean", description: "True only if this is a real bug, regression, or missing edge" },
          confidence: { type: "number", description: "0 to 1. How sure this is a bug" },
        },
        required: ["path", "text", "bug", "confidence"],
      },
    },
  },
];

export type AgentToolDef = (typeof AGENT_TOOLS)[number];

export function toolsForStep(kind: "read" | "plan" | "edit" | "review"): AgentToolDef[] {
  if (kind === "read") {
    return AGENT_TOOLS.filter(
      (t) =>
        t.function.name !== "propose_edit" &&
        t.function.name !== "rename_symbol" &&
        t.function.name !== "move_file" &&
        t.function.name !== "set_plan" &&
        t.function.name !== "note_diff" &&
        t.function.name !== "run_script" &&
        t.function.name !== "mcp_call",
    );
  }
  if (kind === "plan") {
    return AGENT_TOOLS.filter(
      (t) =>
        t.function.name !== "propose_edit" &&
        t.function.name !== "rename_symbol" &&
        t.function.name !== "move_file" &&
        t.function.name !== "note_diff",
    );
  }
  if (kind === "review") {
    return AGENT_TOOLS.filter((t) => t.function.name === "note_diff");
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
  /** Counts review decisions so the turn can say what it kept and what it dropped. */
  reviewTally?: { kept: number; dropped: number };
  /** Set when this request may run code; absent leaves `run_script` answering that it cannot. */
  runScript?: (script: string) => Promise<{ text: string; passed: boolean; ran: boolean }>;
  /**
   * Set when the tab can run scripts in its browser: returns the tool's answer
   * when `script` is handed to the tab at the end of this turn, or null when
   * the browser cannot run it and `runScript` should.
   */
  handOff?: (script: string) => string | null;
  /** Set when this account has MCP servers. Returns the tool text. */
  mcpCall?: (server: string, tool: string, args: string) => Promise<string>;
  /** When set, an edit with an empty search on a path that does not exist creates the file. */
  newFiles?: boolean;
  /** TypeScript's parser, once loaded: it overrules a parse error Lezer gets wrong. */
  parse?: ParseCheck;
  /** Loads `parse`, where the host can; only asked once an edit looks like it does not parse. */
  loadParse?: ParseLoader;
  /**
   * TypeScript's answer about the whole project as staged so far, and the
   * files it saw, where the host has the compiler; a string says why not.
   */
  intel?: <Q extends CodeQuestion>(
    question: Q,
  ) => Promise<{ answer: AnswerTo<Q>; files: Record<string, string> } | string>;
};

function countReview(ctx: ToolContext, kind: "kept" | "dropped") {
  if (!ctx.reviewTally) return;
  ctx.reviewTally[kind] += 1;
}

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

/** Why this turn may not stage an edit, or null when it may. */
function editLock(ctx: ToolContext): string | null {
  if (ctx.mode === "chat") return "Ask mode does not edit. The user can switch to Agent.";
  if (ctx.role === "review") return "Review mode: call note_diff with bug and confidence. Do not propose_edit.";
  if (ctx.phase === "plan") return "Edits are locked until the user clicks Build it.";
  if (ctx.requirePlan && ctx.plan.length === 0 && ctx.phase !== "skip") {
    return "Edits are locked until you call set_plan with 3–7 steps.";
  }
  return null;
}

function lineArg(value: unknown): number | undefined {
  const line = Number(value);
  return Number.isInteger(line) && line > 0 ? line : undefined;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
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

  if (name === "find_references") {
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const symbol = String(args.name ?? "").trim();
    if (!path || !symbol) return "find_references needs path and name.";
    const found = ctx.intel
      ? await ctx.intel({ kind: "references", path, name: symbol, line: lineArg(args.line) })
      : "TypeScript is not available here.";
    if (typeof found === "string") return `${found} Use grep instead.`;
    return found.answer;
  }

  if (name === "find_symbol") {
    const query = String(args.query ?? "").trim();
    if (!query) return "find_symbol needs query.";
    const found = ctx.intel ? await ctx.intel({ kind: "symbols", query }) : "TypeScript is not available here.";
    if (typeof found === "string") return `${found} Use grep instead.`;
    return found.answer;
  }

  if (name === "rename_symbol") {
    const locked = editLock(ctx);
    if (locked) return locked;
    if (!keepEdit(parseConfidence(args.confidence))) {
      return "Edit dropped. Confidence is below 0.8, so nothing was staged.";
    }
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const symbol = String(args.name ?? "").trim();
    const next = String(args.newName ?? "").trim();
    if (!path || !symbol) return "rename_symbol needs path, name and newName.";
    const found = ctx.intel
      ? await ctx.intel({ kind: "rename", path, name: symbol, next, line: lineArg(args.line) })
      : "TypeScript is not available here.";
    if (typeof found === "string") return `${found} Rename with propose_edit in each file instead.`;
    const plan = found.answer;
    if (!plan.ok) return `Rename not staged: ${plan.reason}`;
    const paths = Object.keys(plan.changed).sort();
    for (const changed of paths) {
      const newText = plan.changed[changed]!;
      ctx.edits.push({
        id: `edit_${ctx.edits.length + 1}_${changed}`,
        path: changed,
        oldText: found.files[changed]!,
        newText,
        description: `Rename ${symbol} to ${next}`,
        status: "pending",
      });
      ctx.files[changed] = newText;
    }
    const files = paths.length === 1 ? "1 file" : `${paths.length} files`;
    return `Edit staged for ${files}: ${symbol} renamed to ${next} in ${plan.places} ${plan.places === 1 ? "place" : "places"} (${paths.slice(0, 6).join(", ")}${paths.length > 6 ? ", …" : ""}). Comments and strings keep the old name; grep for it if they should change too.`;
  }

  if (name === "move_file") {
    const locked = editLock(ctx);
    if (locked) return locked;
    if (!keepEdit(parseConfidence(args.confidence))) {
      return "Edit dropped. Confidence is below 0.8, so nothing was staged.";
    }
    const from = safeRelPath(String(args.from ?? "")) ?? "";
    const typed = String(args.to ?? "");
    if (!from || !typed.trim()) return "move_file needs from and to.";
    const target = moveTarget(ctx.files, from, typed);
    if (!target) return `${from} is already at that path.`;
    if ("error" in target) return `Move not staged: ${target.error}`;
    const { to } = target;
    if (from === LESSONS_PATH || to === LESSONS_PATH) return "The lessons file stays where it is.";
    let basis = ctx.files;
    let changed: Record<string, string> = { [to]: ctx.files[from]! };
    let unchecked = "";
    if (isTsPath(from)) {
      const found = ctx.intel ? await ctx.intel({ kind: "move", from, to }) : "TypeScript is not available here.";
      if (typeof found === "string") unchecked = found;
      else if (!found.answer.ok) return `Move not staged: ${found.answer.reason}`;
      else {
        basis = found.files;
        changed = found.answer.changed;
      }
    }
    const description = `Move ${from} to ${to}`;
    const stage = (edit: Omit<ProposedEdit, "id" | "description" | "status">) =>
      ctx.edits.push({ id: `edit_${ctx.edits.length + 1}_${edit.path}`, description, status: "pending", ...edit });
    stage({ path: from, oldText: basis[from]!, newText: "", deleted: true });
    for (const path of Object.keys(changed).sort()) {
      stage({ path, oldText: path === to ? "" : basis[path]!, newText: changed[path]! });
    }
    delete ctx.files[from];
    Object.assign(ctx.files, changed);
    const importers = Object.keys(changed).filter((path) => path !== to);
    const fixed = importers.length
      ? ` Imports updated in ${importers.length} ${importers.length === 1 ? "file" : "files"} (${importers.slice(0, 6).join(", ")}${importers.length > 6 ? ", …" : ""}).`
      : "";
    const note = unchecked
      ? ` Imports were not updated: ${unchecked} grep for ${from} and fix them with propose_edit.`
      : isTsPath(from)
        ? fixed || " Nothing imported it."
        : ` Not a TypeScript file, so nothing was updated to point at it: grep for ${from} if something refers to it.`;
    return `Edit staged: ${from} moved to ${to}.${note}`;
  }

  if (name === "propose_edit") {
    const locked = editLock(ctx);
    if (locked) return locked;
    if (!keepEdit(parseConfidence(args.confidence))) {
      return "Edit dropped. Confidence is below 0.8, so nothing was staged.";
    }
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const search = String(args.search ?? "");
    const replace = String(args.replace ?? "");
    const description = String(args.description ?? "Update file");
    const current = ctx.files[path];
    if (current === undefined && ctx.newFiles && path && path !== LESSONS_PATH && !search) {
      ctx.files[path] = replace;
      ctx.edits.push({
        id: `edit_${ctx.edits.length + 1}_${path}`,
        path,
        oldText: "",
        newText: replace,
        description,
        status: "pending",
      });
      return `Edit staged for ${path}: a new file.`;
    }
    if (current === undefined) {
      if (path !== LESSONS_PATH || search.trim()) return `File not found: ${path}`;
      const line = replace.replace(/^- /, "").trim();
      if (!line) return "A new lessons file needs one bullet.";
      const next = upsertLesson("", `grow_${ctx.edits.length + 1}`, "down", line);
      ctx.files[path] = next;
      ctx.edits.push({
        id: `edit_${ctx.edits.length + 1}_${path}`,
        path,
        oldText: "",
        newText: next,
        description,
        status: "pending",
      });
      return `Edit staged for ${path}. The user must accept it in the UI.`;
    }
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
    let notes = previewNotesForEdit(edit, ctx.files, ctx.parse);
    if (notes.length && ctx.loadParse) {
      // A second opinion on the text this edit stages, before its notes hold Apply.
      const parse = await ctx.loadParse(path, edit.newText);
      if (parse) {
        ctx.parse = parse;
        notes = previewNotesForEdit(edit, ctx.files, parse);
      }
    }
    if (notes.length) edit.notes = notes;
    ctx.edits.push(edit);
    if (notes.length) {
      // Notes arrive label-prefixed ("Syntax check: …") for the diff card; the
      // agent already knows which file it edited, so report just the problem.
      const problems = notes.map((n) => n.text.replace(/^[^:]+ check: /, "")).join("; ");
      return `Edit staged for ${path}, but ${checkLabel(path).toLowerCase()} failed: ${problems}. Fix before the user can Apply.`;
    }
    return `Edit staged for ${path}. The user must accept it in the UI.`;
  }

  if (name === "run_script") {
    const script = String(args.script ?? "").trim();
    if (!script) return "run_script needs a script name.";
    const handed = ctx.handOff?.(script);
    if (handed) return handed;
    if (!ctx.runScript) {
      return "Running is not available for this request. Verify by reading the code instead.";
    }
    const result = await ctx.runScript(script);
    return result.text;
  }

  if (name === "note_diff") {
    const path = safeRelPath(String(args.path ?? "")) ?? "";
    const text = String(args.text ?? "").trim().slice(0, 400);
    if (!path || !text) return "Pass path and text.";
    const excerpt = String(args.excerpt ?? "").slice(0, 80);
    const kind = args.type === "del" ? "del" : args.type === "eq" ? "eq" : "add";
    const bug = args.bug === true || args.bug === "true";
    const confidence = parseConfidence(args.confidence);
    if (!bug) {
      countReview(ctx, "dropped");
      return "Not a bug. No note added.";
    }
    if (confidence === null) {
      countReview(ctx, "dropped");
      return "Pass confidence from 0 to 1.";
    }
    if (!keepReviewNote(true, confidence)) {
      countReview(ctx, "dropped");
      return "Dropped. Confidence is below 0.8, so this stays off the diff.";
    }
    const edit = [...ctx.edits].reverse().find((row) => row.path === path && row.status === "pending");
    if (!edit) return `No pending edit for ${path}. Review staged diffs only.`;
    edit.notes = [
      ...(edit.notes ?? []),
      { id: `n_${(edit.notes?.length ?? 0) + 1}_${path}`, excerpt, type: kind, text, confidence },
    ];
    countReview(ctx, "kept");
    return `Note added on ${path}.`;
  }

  if (name === "mcp_call") {
    if (!ctx.mcpCall) return "No MCP servers are connected. Add one in Settings → Agents.";
    const server = String(args.server ?? "").trim();
    const tool = String(args.tool ?? "").trim();
    const raw = typeof args.arguments === "string" ? args.arguments : JSON.stringify(args.arguments ?? {});
    if (!server || !tool) return "mcp_call needs server and tool.";
    return ctx.mcpCall(server, tool, raw || "{}");
  }

  return `Unknown tool: ${name}`;
}
