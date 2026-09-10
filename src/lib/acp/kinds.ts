export type AcpKind = "claude-code" | "codex" | "opencode" | "custom";

export const ACP_KINDS: Array<{ id: AcpKind; label: string; hint: string }> = [
  { id: "claude-code", label: "Claude Code", hint: "ACP session in Composer, or a claude CLI JSON-RPC bridge" },
  { id: "codex", label: "Codex", hint: "ACP session in Composer, or a Codex CLI JSON-RPC bridge" },
  { id: "opencode", label: "OpenCode", hint: "ACP session in Composer, or an opencode ACP server" },
  { id: "custom", label: "Custom", hint: "Any ACP JSON-RPC or aperture.acp.v1 endpoint" },
];

export const BUILTIN_ACP: Array<{ id: string; kind: Exclude<AcpKind, "custom">; name: string }> = [
  { id: "builtin:claude-code", kind: "claude-code", name: "Claude Code" },
  { id: "builtin:codex", kind: "codex", name: "Codex" },
  { id: "builtin:opencode", kind: "opencode", name: "OpenCode" },
];

export function isAcpKind(value: string): value is AcpKind {
  return value === "claude-code" || value === "codex" || value === "opencode" || value === "custom";
}

export function acpLabel(kind: string): string {
  return ACP_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

export function isBuiltinAgentId(id: string): boolean {
  return BUILTIN_ACP.some((a) => a.id === id);
}

export function builtinById(id: string) {
  return BUILTIN_ACP.find((a) => a.id === id) ?? null;
}

export function isAgentRef(id: string): boolean {
  if (isBuiltinAgentId(id)) return true;
  return /^ag_[a-zA-Z0-9_-]+$/.test(id) && id.length <= 80;
}

export function acpSystemPreamble(kind: Exclude<AcpKind, "custom"> | "aperture"): string {
  if (kind === "claude-code") {
    return "You are Claude Code, running inside Aperture over the Agent Client Protocol. Same diff UI as Composer. Call set_plan first, then Read/Grep/Edit.";
  }
  if (kind === "codex") {
    return "You are Codex, running inside Aperture over ACP. Keep the plan tight. Call set_plan, then make the edits. Diffs stage for the user.";
  }
  if (kind === "opencode") {
    return "You are OpenCode, running inside Aperture over ACP. Model-agnostic agent. Call set_plan, inspect, then propose_edit. The user applies diffs.";
  }
  return "";
}

export function acpTraceName(name: string, kind?: string | null): string {
  if (!kind || kind === "custom") return name;
  if (name === "read_file") return "Read";
  if (name === "grep") return "Grep";
  if (name === "semantic_search") return "Search";
  if (name === "list_dir") return "LS";
  if (name === "propose_edit") return "Edit";
  if (name === "set_plan") return "Plan";
  return name;
}
