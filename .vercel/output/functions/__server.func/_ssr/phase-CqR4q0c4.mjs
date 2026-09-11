//#region node_modules/.nitro/vite/services/ssr/assets/phase-CqR4q0c4.js
function parseAgentPhase(value) {
	if (value === "plan" || value === "build" || value === "skip") return value;
}
function resolveAgentPhase(mode, phase) {
	if (mode === "inline") return "skip";
	if (phase === "build" || phase === "skip" || phase === "plan") return phase;
	return "plan";
}
function toolKindFor(mode, phase) {
	if (mode === "chat") return "read";
	if (mode === "inline") return "edit";
	if (phase === "build" || phase === "skip") return "edit";
	return "plan";
}
/** After a plan exists, stop if this step did not keep researching. */
function shouldAwaitBuild(phase, hasPlan, toolNames) {
	if (phase !== "plan" || !hasPlan) return false;
	return toolNames.every((name) => name === "set_plan" || name === "propose_edit");
}
function planReadyText(content) {
	const text = content?.trim();
	if (text) return text;
	return "Plan ready. Click Build it when you want the edits.";
}
//#endregion
export { toolKindFor as a, shouldAwaitBuild as i, planReadyText as n, resolveAgentPhase as r, parseAgentPhase as t };
