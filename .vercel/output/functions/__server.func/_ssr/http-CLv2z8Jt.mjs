import { i as safeRelPath } from "./redact-Ckw8E-v4.mjs";
import { t as parseUnifiedDiff } from "./patch-BCE3WVGP.mjs";
import { t as normalizePlan } from "./plan-C3-iIH1W.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/http-CLv2z8Jt.js
function isRecord(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function parseJsonRpc(raw) {
	if (!isRecord(raw) || raw.jsonrpc !== "2.0") return null;
	if (typeof raw.method === "string") return {
		jsonrpc: "2.0",
		id: raw.id,
		method: raw.method,
		params: raw.params
	};
	return {
		jsonrpc: "2.0",
		id: raw.id,
		result: raw.result,
		error: isRecord(raw.error) ? {
			code: Number(raw.error.code) || 0,
			message: String(raw.error.message ?? "Error")
		} : void 0
	};
}
function sessionUpdateFrom(raw) {
	if (!isRecord(raw)) return null;
	const nested = isRecord(raw.update) ? raw.update : raw;
	const kind = nested.sessionUpdate;
	if (typeof kind !== "string") return null;
	if (kind === "agent_message_chunk" || kind === "agent_thought_chunk" || kind === "plan" || kind === "tool_call" || kind === "tool_call_update") return nested;
	return null;
}
function collectSessionUpdates(raw) {
	const out = [];
	const visit = (value) => {
		if (!value) return;
		if (Array.isArray(value)) {
			for (const item of value) visit(item);
			return;
		}
		const msg = parseJsonRpc(value);
		if (msg && "method" in msg && msg.method === "session/update") {
			const upd = sessionUpdateFrom(msg.params);
			if (upd) out.push(upd);
			return;
		}
		const upd = sessionUpdateFrom(value);
		if (upd) {
			out.push(upd);
			return;
		}
		if (isRecord(value)) {
			if (Array.isArray(value.updates)) visit(value.updates);
			if (Array.isArray(value.notifications)) visit(value.notifications);
			if (value.result) visit(value.result);
		}
	};
	visit(raw);
	return out;
}
function textOf(block) {
	if (!block) return "";
	if (block.type === "text" && typeof block.text === "string") return block.text;
	if (typeof block.text === "string") return block.text;
	return "";
}
function diffsOf(blocks, files) {
	if (!blocks) return [];
	const edits = [];
	for (const block of blocks) {
		if (block.type !== "diff") continue;
		const path = safeRelPath(String(block.path ?? ""));
		if (!path) continue;
		const newText = typeof block.newText === "string" ? block.newText : "";
		const oldText = typeof block.oldText === "string" ? block.oldText : files[path] ?? "";
		if (oldText === newText) continue;
		edits.push({
			id: `acp_${edits.length + 1}_${path}`,
			path,
			oldText,
			newText,
			description: `Edit ${path}`,
			status: "pending"
		});
	}
	return edits;
}
function isTool(update) {
	return update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update";
}
/** Fold ACP session/update notifications into Composer stream events + staged diffs. */
function mapAcpUpdates(updates, files, seed) {
	let text = seed?.text ?? "";
	let plan = seed?.plan ?? [];
	const traces = [...seed?.traces ?? []];
	const edits = [...seed?.edits ?? []];
	const events = [];
	const seenTrace = new Set(traces.map((t) => t.id));
	for (const update of updates) {
		if (update.sessionUpdate === "agent_message_chunk") {
			const delta = textOf(update.content);
			if (!delta) continue;
			text += delta;
			events.push({
				type: "text",
				delta
			});
			continue;
		}
		if (update.sessionUpdate === "agent_thought_chunk") {
			const thought = textOf(update.content).trim();
			if (thought) events.push({
				type: "status",
				text: thought.slice(0, 80)
			});
			continue;
		}
		if (update.sessionUpdate === "plan") {
			plan = normalizePlan(update.entries);
			events.push({
				type: "plan",
				entries: plan
			});
			continue;
		}
		if (!isTool(update)) continue;
		const title = update.title || update.kind || "tool";
		const path = update.locations?.[0]?.path;
		if (update.sessionUpdate === "tool_call" && !seenTrace.has(update.toolCallId)) {
			seenTrace.add(update.toolCallId);
			const trace = {
				id: update.toolCallId,
				name: title,
				args: path ? { path } : {},
				resultPreview: update.status === "completed" ? "ok" : update.status ?? "running",
				ms: 0
			};
			traces.push(trace);
			events.push({
				type: "trace",
				trace
			});
			events.push({
				type: "status",
				text: `${title}…`
			});
		}
		const next = diffsOf(update.content, files);
		if (next.length > 0) {
			for (const edit of next) {
				const i = edits.findIndex((e) => e.path === edit.path);
				if (i >= 0) edits[i] = {
					...edit,
					id: edits[i].id,
					oldText: edits[i].oldText
				};
				else edits.push(edit);
			}
			events.push({
				type: "edits",
				edits: [...edits]
			});
		}
	}
	return {
		events,
		text,
		plan,
		traces,
		edits
	};
}
function legacyEdits(raw) {
	if (!Array.isArray(raw)) return [];
	return raw.filter((e) => e && typeof e.path === "string" && typeof e.newText === "string").slice(0, 40).map((e, i) => ({
		id: `acp_${i}_${e.path}`,
		path: e.path,
		oldText: typeof e.oldText === "string" ? e.oldText : "",
		newText: e.newText,
		description: typeof e.description === "string" ? e.description : `Edit ${e.path}`,
		status: "pending"
	}));
}
async function post(endpoint, token, payload, signal) {
	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, application/x-ndjson, text/event-stream",
			...token ? { Authorization: `Bearer ${token}` } : {}
		},
		body: JSON.stringify(payload),
		signal
	});
	const contentType = res.headers.get("content-type") ?? "";
	const raw = await res.text();
	if (!res.ok) return {
		ok: false,
		status: res.status,
		error: raw.slice(0, 240) || `HTTP ${res.status}`
	};
	if (contentType.includes("text/event-stream") || contentType.includes("ndjson")) {
		const messages = [];
		for (const line of raw.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
			if (!data || data === "[DONE]") continue;
			try {
				messages.push(JSON.parse(data));
			} catch {}
		}
		return {
			ok: true,
			status: res.status,
			contentType,
			body: messages,
			raw
		};
	}
	try {
		return {
			ok: true,
			status: res.status,
			contentType,
			body: JSON.parse(raw),
			raw
		};
	} catch {
		return {
			ok: true,
			status: res.status,
			contentType,
			body: { text: raw },
			raw
		};
	}
}
function rpcCall(method, params, id) {
	return {
		jsonrpc: "2.0",
		id,
		method,
		params
	};
}
function filesPayload(input) {
	return input.files.slice(0, 80).map((f) => ({
		path: f.path,
		content: f.content.slice(0, 8e4)
	}));
}
function asRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
async function runRemoteAcp(endpoint, token, name, input, emit, signal) {
	const files = Object.fromEntries(input.files.map((f) => [f.path, f.content]));
	emit({
		type: "status",
		text: `ACP initialize · ${name}`
	});
	const init = await post(endpoint, token, rpcCall("initialize", {
		protocolVersion: 1,
		clientInfo: {
			name: "Aperture",
			version: "1.0"
		},
		clientCapabilities: { fs: {
			readTextFile: true,
			writeTextFile: false
		} }
	}, 1), signal);
	const initRpc = init.ok ? parseJsonRpc(init.body) : null;
	const looksRpc = Boolean(initRpc && ("result" in initRpc || "method" in initRpc && initRpc.method));
	if (init.ok && looksRpc) {
		const neu = await post(endpoint, token, rpcCall("session/new", {
			cwd: "/",
			mcpServers: []
		}, 2), signal);
		let sessionId = "aperture";
		if (neu.ok) {
			const parsed = parseJsonRpc(neu.body);
			const result = parsed && "result" in parsed ? asRecord(parsed.result) : asRecord(neu.body);
			if (typeof result?.sessionId === "string") sessionId = result.sessionId;
		}
		emit({
			type: "status",
			text: "session/prompt…"
		});
		const prompt = await post(endpoint, token, rpcCall("session/prompt", {
			sessionId,
			prompt: [{
				type: "text",
				text: input.instruction
			}],
			files: filesPayload(input),
			mode: input.mode,
			activePath: input.activePath ?? null
		}, 3), signal);
		if (prompt.ok) {
			const mapped = consumeBody(prompt.body, files);
			if (mapped.edits.length > 0 || mapped.plan.length > 0 || mapped.text.trim().length > 0 || mapped.traces.length > 0) {
				for (const event of mapped.events) emit(event);
				if (mapped.edits.length > 0) emit({
					type: "edits",
					edits: mapped.edits
				});
				if (mapped.plan.length > 0) emit({
					type: "plan",
					entries: mapped.plan
				});
				const text = mapped.text.trim() || `${name} finished.`;
				emit({
					type: "done",
					text,
					traces: mapped.traces,
					edits: mapped.edits,
					plan: mapped.plan
				});
				return {
					ok: true,
					text,
					traces: mapped.traces,
					edits: mapped.edits,
					plan: mapped.plan
				};
			}
		}
	}
	return runLegacy(endpoint, token, name, input, files, emit, signal);
}
function consumeBody(body, files) {
	const mapped = mapAcpUpdates(collectSessionUpdates(body), files);
	const rec = asRecord(Array.isArray(body) ? void 0 : body);
	if (typeof rec?.text === "string" && !mapped.text) mapped.text = rec.text;
	if (Array.isArray(rec?.edits) && mapped.edits.length === 0) mapped.edits = legacyEdits(rec.edits);
	if (typeof rec?.diff === "string" && mapped.edits.length === 0) {
		const parsed = parseUnifiedDiff(rec.diff, files);
		if (!("error" in parsed)) mapped.edits = parsed;
	}
	return mapped;
}
async function runLegacy(endpoint, token, name, input, files, emit, signal) {
	emit({
		type: "status",
		text: `${name} · aperture.acp.v1`
	});
	const res = await post(endpoint, token, {
		protocol: "aperture.acp.v1",
		instruction: input.instruction,
		mode: input.mode,
		files: filesPayload(input),
		activePath: input.activePath ?? null
	}, signal);
	if (!res.ok) return {
		ok: false,
		error: `${name} refused the run (${res.status}).`
	};
	const rec = asRecord(res.body) ?? {};
	const mapped = mapAcpUpdates(collectSessionUpdates(res.body), files);
	const edits = mapped.edits.length > 0 ? mapped.edits : legacyEdits(rec.edits);
	const text = mapped.text.trim() || (typeof rec.text === "string" ? rec.text : `${name} finished.`);
	if (mapped.plan.length) emit({
		type: "plan",
		entries: mapped.plan
	});
	for (const event of mapped.events) emit(event);
	if (edits.length) emit({
		type: "edits",
		edits
	});
	emit({
		type: "done",
		text,
		traces: mapped.traces,
		edits,
		plan: mapped.plan
	});
	return {
		ok: true,
		text,
		traces: mapped.traces,
		edits,
		plan: mapped.plan
	};
}
//#endregion
export { runRemoteAcp };
