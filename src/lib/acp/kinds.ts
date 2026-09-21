export type AcpKind = "claude-code" | "codex" | "opencode" | "grok-build" | "custom";

/**
 * The agents Composer can run over ACP.
 *
 * This list is the single source of truth: the model picker, the crew seats,
 * the settings form and the system preamble all read from it, so adding a
 * seat is one entry here rather than a hunt for the places that enumerate
 * kinds by hand.
 */
export const ACP_KINDS: Array<{ id: AcpKind; label: string; hint: string; preamble: string }> = [
  {
    id: "claude-code",
    label: "Claude Code",
    hint: "ACP session in Composer, or a claude CLI JSON-RPC bridge",
    preamble:
      "You are Claude Code, running inside Aperture over the Agent Client Protocol. Same diff UI as Composer. Call set_plan first, then Read/Grep/Edit.",
  },
  {
    id: "codex",
    label: "Codex",
    hint: "ACP session in Composer, or a Codex CLI JSON-RPC bridge",
    preamble:
      "You are Codex, running inside Aperture over ACP. Keep the plan tight. Call set_plan, then make the edits. Diffs stage for the user.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    hint: "ACP session in Composer, or an opencode ACP server",
    preamble:
      "You are OpenCode, running inside Aperture over ACP. Model-agnostic agent. Call set_plan, inspect, then propose_edit. The user applies diffs.",
  },
  {
    id: "grok-build",
    label: "Grok Build",
    hint: "ACP session in Composer, or a grok-build CLI JSON-RPC bridge",
    preamble:
      "You are Grok Build, running inside Aperture over ACP. Call set_plan, inspect with search and read, then propose_edit. Diffs stage for the user to apply.",
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Any ACP JSON-RPC or aperture.acp.v1 endpoint",
    preamble: "",
  },
];

export const BUILTIN_ACP: Array<{ id: string; kind: Exclude<AcpKind, "custom">; name: string }> = [
  { id: "builtin:claude-code", kind: "claude-code", name: "Claude Code" },
  { id: "builtin:codex", kind: "codex", name: "Codex" },
  { id: "builtin:opencode", kind: "opencode", name: "OpenCode" },
  { id: "builtin:grok-build", kind: "grok-build", name: "Grok Build" },
];

/**
 * The built-in agents, named for prose: "Claude Code, Codex, OpenCode and Grok Build".
 *
 * Copy across the settings page, the landing page, the pricing features and the
 * upgrade errors all names these agents. Deriving the sentence from the list
 * keeps them in step when a seat is added.
 */
export function acpAgentNames(conjunction: "and" | "or" | "," = ","): string {
  const names = BUILTIN_ACP.map((agent) => agent.name);
  if (conjunction === "," || names.length < 2) return names.join(", ");
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}

export function isAcpKind(value: string): value is AcpKind {
  return ACP_KINDS.some((kind) => kind.id === value);
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

/** Empty for a kind that has no preamble of its own, and for anything unknown. */
export function acpSystemPreamble(kind: string): string {
  return ACP_KINDS.find((entry) => entry.id === kind)?.preamble ?? "";
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
