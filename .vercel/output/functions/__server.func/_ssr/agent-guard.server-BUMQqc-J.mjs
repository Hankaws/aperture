import { s as isAgentRef } from "./kinds-CCf1JBpH.mjs";
import { t as normalizePlan } from "./plan-C3-iIH1W.mjs";
import { i as safeRelPath, n as redactSecrets, t as isSecretPath } from "./redact-Ckw8E-v4.mjs";
import { r as parseAgentPhase } from "./phase-Dk9J4-qu.mjs";
import { r as isModelSource } from "./plans-CTIRB29R.mjs";
import { o as parseWorkerRole } from "./crew-D0crwclb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/agent-guard.server-BUMQqc-J.js
var MAX_AGENT_BODY = 28e5;
var MAX_INSTRUCTION = 8e3;
var MAX_HISTORY_CHARS = 4e3;
var MAX_FILE_CHARS = 2e5;
var MAX_TOTAL_CHARS = 25e5;
var hits = /* @__PURE__ */ new Map();
function rateLimit(id, max = 24, windowMs = 6e4) {
	const now = Date.now();
	const arr = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
	if (arr.length >= max) return false;
	arr.push(now);
	hits.set(id, arr);
	return true;
}
function sanitizeAgentInput(raw) {
	if (!raw || typeof raw !== "object") return { error: "Invalid request" };
	const input = raw;
	const mode = input.mode;
	if (mode !== "chat" && mode !== "composer" && mode !== "inline") return { error: "Unknown agent mode" };
	const instruction = typeof input.instruction === "string" ? input.instruction.slice(0, MAX_INSTRUCTION) : "";
	if (!instruction.trim()) return { error: "Empty instruction" };
	const historyIn = Array.isArray(input.history) ? input.history.slice(-8) : [];
	const history = [];
	for (const turn of historyIn) {
		if (!turn || typeof turn !== "object") continue;
		const row = turn;
		const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
		if (!role || typeof row.content !== "string") continue;
		history.push({
			role,
			content: redactSecrets(row.content.slice(0, MAX_HISTORY_CHARS))
		});
	}
	const filesIn = Array.isArray(input.files) ? input.files.slice(0, 120) : [];
	const files = [];
	let used = 0;
	for (const file of filesIn) {
		if (!file || typeof file !== "object") continue;
		const row = file;
		if (typeof row.path !== "string" || typeof row.content !== "string") continue;
		const path = safeRelPath(row.path);
		if (!path || isSecretPath(path)) continue;
		const room = MAX_TOTAL_CHARS - used;
		if (room <= 0) break;
		const content = redactSecrets(row.content.slice(0, Math.min(MAX_FILE_CHARS, room)));
		files.push({
			path,
			content
		});
		used += content.length;
	}
	let selection = null;
	const sel = input.selection;
	if (sel && typeof sel === "object") {
		const row = sel;
		const path = typeof row.path === "string" ? safeRelPath(row.path) : null;
		if (path && typeof row.text === "string") selection = {
			path,
			text: redactSecrets(row.text.slice(0, 12e3)),
			fromLine: Math.max(1, Number(row.fromLine) || 1),
			toLine: Math.max(1, Number(row.toLine) || 1)
		};
	}
	const activePath = typeof input.activePath === "string" ? safeRelPath(input.activePath) : input.activePath === null ? null : void 0;
	let source = void 0;
	if (input.source === null || input.source === void 0 || input.source === "") source = void 0;
	else if (typeof input.source === "string" && isModelSource(input.source)) source = input.source;
	else return { error: "Unknown model" };
	let agentId = null;
	if (input.agentId === null || input.agentId === void 0 || input.agentId === "") agentId = null;
	else if (typeof input.agentId === "string" && isAgentRef(input.agentId)) agentId = input.agentId;
	else if (typeof input.agentId === "string") return { error: "Unknown agent" };
	const phase = parseAgentPhase(input.phase);
	const approvedPlan = normalizePlan(input.approvedPlan);
	const known = new Set(files.map((f) => f.path));
	const workers = [];
	if (Array.isArray(input.workers)) for (const row of input.workers.slice(0, 3)) {
		if (!row || typeof row !== "object") continue;
		const rec = row;
		const paths = Array.isArray(rec.files) ? rec.files.filter((p) => typeof p === "string").map((p) => safeRelPath(p)).filter((p) => typeof p === "string" && known.has(p)).slice(0, 12) : [];
		if (paths.length === 0) continue;
		const wsource = typeof rec.source === "string" && isModelSource(rec.source) ? rec.source : void 0;
		const label = typeof rec.label === "string" ? rec.label.slice(0, 80) : paths[0];
		workers.push({
			files: paths,
			steps: normalizePlan(rec.steps),
			source: wsource,
			label,
			agentId: null,
			role: parseWorkerRole(rec.role)
		});
	}
	const pendingEdits = [];
	if (Array.isArray(input.pendingEdits)) for (const row of input.pendingEdits.slice(0, 8)) {
		if (!row || typeof row !== "object") continue;
		const rec = row;
		const path = typeof rec.path === "string" ? safeRelPath(rec.path) : null;
		if (!path || !known.has(path)) continue;
		if (typeof rec.oldText !== "string" || typeof rec.newText !== "string") continue;
		pendingEdits.push({
			id: typeof rec.id === "string" ? rec.id.slice(0, 80) : `pending_${pendingEdits.length}_${path}`,
			path,
			oldText: rec.oldText.slice(0, 2e4),
			newText: rec.newText.slice(0, 2e4),
			description: typeof rec.description === "string" ? rec.description.slice(0, 200) : path,
			status: "pending",
			notes: Array.isArray(rec.notes) ? rec.notes.slice(0, 12).flatMap((note) => {
				if (!note || typeof note !== "object") return [];
				const n = note;
				if (typeof n.text !== "string") return [];
				return [{
					id: typeof n.id === "string" ? n.id.slice(0, 80) : `n_${path}`,
					excerpt: typeof n.excerpt === "string" ? n.excerpt.slice(0, 80) : "",
					type: n.type === "del" ? "del" : n.type === "eq" ? "eq" : "add",
					text: n.text.slice(0, 400)
				}];
			}) : void 0
		});
	}
	const keepWorkers = workers.length >= 2 || workers.some((w) => w.role === "review");
	return {
		mode,
		instruction: redactSecrets(instruction),
		history,
		files,
		activePath,
		selection,
		source,
		agentId,
		phase,
		approvedPlan: approvedPlan.length > 0 ? approvedPlan : void 0,
		workers: keepWorkers ? workers : void 0,
		role: parseWorkerRole(input.role) === "review" ? "review" : void 0,
		pendingEdits: pendingEdits.length ? pendingEdits : void 0,
		debug: input.debug === true,
		compacted: typeof input.compacted === "number" && Number.isFinite(input.compacted) && input.compacted > 0 ? Math.min(200, Math.floor(input.compacted)) : void 0
	};
}
//#endregion
export { MAX_AGENT_BODY, rateLimit, sanitizeAgentInput };
