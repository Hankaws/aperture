//#region node_modules/.nitro/vite/services/ssr/assets/phase-Dk9J4-qu.js
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
var BUILD_INTENT = /^(build it|go ahead|do it|yes|lgtm|ship it|continue|apply( it)?)\.?!?$/i;
function isBuildIntent(text) {
	return BUILD_INTENT.test(text.trim());
}
/** Pick the next Composer phase from the last assistant turn. Explicit phase wins. */
function nextComposerPhase(messages, instruction, explicit) {
	if (explicit) {
		const last = [...messages].reverse().find((m) => m.role === "assistant" && m.plan && m.plan.length > 0);
		if (explicit === "build") {
			if (last?.plan?.length) return {
				phase: "build",
				approvedPlan: last.plan
			};
			return { phase: "skip" };
		}
		return { phase: explicit };
	}
	const last = [...messages].reverse().find((m) => m.role === "assistant");
	if (last?.awaitingBuild && last.plan?.length) {
		if (isBuildIntent(instruction)) return {
			phase: "build",
			approvedPlan: last.plan
		};
		return { phase: "plan" };
	}
	if (last?.edits?.some((e) => e.status === "pending" || e.status === "applied")) return { phase: "skip" };
	return { phase: "plan" };
}
//#endregion
export { resolveAgentPhase as a, planReadyText as i, nextComposerPhase as n, shouldAwaitBuild as o, parseAgentPhase as r, toolKindFor as s, isBuildIntent as t };
