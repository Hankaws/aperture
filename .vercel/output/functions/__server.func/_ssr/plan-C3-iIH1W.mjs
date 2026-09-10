//#region node_modules/.nitro/vite/services/ssr/assets/plan-C3-iIH1W.js
var STATUSES = [
	"pending",
	"in_progress",
	"completed"
];
var PRIORITIES = [
	"high",
	"medium",
	"low"
];
function asStatus(value) {
	return STATUSES.includes(value) ? value : "pending";
}
function asPriority(value) {
	return PRIORITIES.includes(value) ? value : "medium";
}
/** Normalize a model or ACP plan payload into at most 12 UI rows. */
function normalizePlan(raw) {
	if (!raw) return [];
	let list = [];
	if (Array.isArray(raw)) list = raw;
	else if (raw && typeof raw === "object") {
		const row = raw;
		if (Array.isArray(row.entries)) list = row.entries;
		else if (Array.isArray(row.steps)) list = row.steps;
	}
	const out = [];
	for (let i = 0; i < list.length && out.length < 12; i += 1) {
		const item = list[i];
		if (typeof item === "string") {
			const content = item.trim().slice(0, 160);
			if (!content) continue;
			out.push({
				id: `p${out.length + 1}`,
				content,
				status: "pending",
				priority: "medium"
			});
			continue;
		}
		if (!item || typeof item !== "object") continue;
		const row = item;
		const content = typeof row.content === "string" ? row.content.trim().slice(0, 160) : "";
		if (!content) continue;
		const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 40) : `p${out.length + 1}`;
		out.push({
			id,
			content,
			status: asStatus(row.status),
			priority: asPriority(row.priority)
		});
	}
	return out;
}
//#endregion
export { normalizePlan as t };
