//#region node_modules/.nitro/vite/services/ssr/assets/kinds-CCf1JBpH.js
var ACP_KINDS = [
	{
		id: "claude-code",
		label: "Claude Code",
		hint: "ACP session in Composer, or a claude CLI JSON-RPC bridge"
	},
	{
		id: "codex",
		label: "Codex",
		hint: "ACP session in Composer, or a Codex CLI JSON-RPC bridge"
	},
	{
		id: "opencode",
		label: "OpenCode",
		hint: "ACP session in Composer, or an opencode ACP server"
	},
	{
		id: "custom",
		label: "Custom",
		hint: "Any ACP JSON-RPC or aperture.acp.v1 endpoint"
	}
];
var BUILTIN_ACP = [
	{
		id: "builtin:claude-code",
		kind: "claude-code",
		name: "Claude Code"
	},
	{
		id: "builtin:codex",
		kind: "codex",
		name: "Codex"
	},
	{
		id: "builtin:opencode",
		kind: "opencode",
		name: "OpenCode"
	}
];
function isAcpKind(value) {
	return value === "claude-code" || value === "codex" || value === "opencode" || value === "custom";
}
function isBuiltinAgentId(id) {
	return BUILTIN_ACP.some((a) => a.id === id);
}
function builtinById(id) {
	return BUILTIN_ACP.find((a) => a.id === id) ?? null;
}
function isAgentRef(id) {
	if (isBuiltinAgentId(id)) return true;
	return /^ag_[a-zA-Z0-9_-]+$/.test(id) && id.length <= 80;
}
function acpSystemPreamble(kind) {
	if (kind === "claude-code") return "You are Claude Code, running inside Aperture over the Agent Client Protocol. Same diff UI as Composer. Call set_plan first, then Read/Grep/Edit.";
	if (kind === "codex") return "You are Codex, running inside Aperture over ACP. Keep the plan tight. Call set_plan, then make the edits. Diffs stage for the user.";
	if (kind === "opencode") return "You are OpenCode, running inside Aperture over ACP. Model-agnostic agent. Call set_plan, inspect, then propose_edit. The user applies diffs.";
	return "";
}
function acpTraceName(name, kind) {
	if (!kind || kind === "custom") return name;
	if (name === "read_file") return "Read";
	if (name === "grep") return "Grep";
	if (name === "semantic_search") return "Search";
	if (name === "list_dir") return "LS";
	if (name === "propose_edit") return "Edit";
	if (name === "set_plan") return "Plan";
	return name;
}
//#endregion
export { builtinById as a, isBuiltinAgentId as c, acpTraceName as i, BUILTIN_ACP as n, isAcpKind as o, acpSystemPreamble as r, isAgentRef as s, ACP_KINDS as t };
