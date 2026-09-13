import { a as builtinById, i as acpTraceName, r as acpSystemPreamble } from "./kinds-CCf1JBpH.mjs";
import { a as sanitizeFileMap, n as redactSecrets } from "./redact-Ckw8E-v4.mjs";
import { a as toolKindFor, i as shouldAwaitBuild, n as planReadyText, r as resolveAgentPhase } from "./phase-CqR4q0c4.mjs";
import { a as indexFiles, t as applySearchReplace } from "./apply-edit-BQE-oS-F.mjs";
import { a as findRules, r as expandMentions, s as parseMentions } from "./mentions-9PH6SrSM.mjs";
import { a as toolsForStep, n as completeStreaming, r as executeTool, t as complete } from "./complete.server-CD2QvcD3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/loop.server-EhEaAxg5.js
var MAX_STEPS = 8;
var MAX_FILES = 120;
var MAX_CHARS = 22e4;
function flavorOf(input) {
	const id = input.agentId;
	if (!id) return null;
	return builtinById(id);
}
function systemPrompt(mode, rules, flavorName, phase) {
	const base = [
		flavorName ? acpSystemPreamble(flavorName) : "You are Aperture, an AI coding agent inside a web IDE.",
		"You operate on a virtual workspace snapshot. Tools see the live snapshot, including staged edits.",
		"Always inspect code with semantic_search, grep, or read_file before editing.",
		"Prefer the smallest unique search/replace. Never invent files that do not exist.",
		"Cite paths as path:line when answering questions.",
		"When the user wants a change, call propose_edit. Do not dump entire files into chat unless asked.",
		"The user may attach files with @path. Treat those as the primary context.",
		"Never repeat API keys, tokens, passwords, private keys, or secret-looking strings. If one appears, write [redacted].",
		mode === "inline" ? "Inline mode: return one focused replacement for the selection." : mode === "composer" ? phase === "plan" ? "Plan mode: inspect the repo with search and read. Call set_plan with 3–7 short steps. Then write a brief approach (files, method, risks, out of scope). Do not edit. Stop and wait — the user clicks Build it." : phase === "build" ? "Build mode: the user approved the plan. Execute it. Update set_plan statuses as you complete steps. Call propose_edit for each change. Do not expand scope. Do not restart the plan." : "Composer mode: call set_plan with 3–7 short steps before any propose_edit. Keep the plan visible. Update statuses as you complete steps, then edit." : "Ask mode: answer questions. You may search and read. Do not call set_plan or propose_edit. Nothing is written."
	].join(" ");
	if (!rules) return base;
	return `${base}\n\nProject rules (follow these):\n${rules.slice(0, 6e3)}`;
}
function capFiles(files, mentioned) {
	const map = {};
	let used = 0;
	const mentionSet = new Set(mentioned);
	const ordered = [...files.filter((f) => mentionSet.has(f.path)), ...files.filter((f) => !mentionSet.has(f.path))];
	for (const file of ordered.slice(0, MAX_FILES)) {
		const room = MAX_CHARS - used;
		if (room <= 0) break;
		const content = file.content.length > room ? file.content.slice(0, room) : file.content;
		map[file.path] = content;
		used += content.length;
	}
	return map;
}
function fileTree(files) {
	return Object.keys(files).sort().map((p) => `- ${p} (${files[p].split("\n").length} lines)`).join("\n");
}
function packDebug(input, provider, system, user, response, steps) {
	if (!input.debug) return void 0;
	return {
		model: provider,
		steps,
		system: redactSecrets(system).slice(0, 6e3),
		user: redactSecrets(user).slice(0, 6e3),
		response: redactSecrets(response).slice(0, 6e3)
	};
}
function toPlainArgs(args) {
	const out = {};
	for (const [key, value] of Object.entries(args)) if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
	else if (value === void 0) continue;
	else out[key] = JSON.stringify(value);
	return out;
}
function mergeEdits(edits) {
	const byPath = /* @__PURE__ */ new Map();
	for (const edit of edits) {
		const prev = byPath.get(edit.path);
		if (!prev) {
			byPath.set(edit.path, { ...edit });
			continue;
		}
		byPath.set(edit.path, {
			...edit,
			oldText: prev.oldText,
			newText: edit.newText,
			description: `${prev.description}; ${edit.description}`
		});
	}
	return [...byPath.values()];
}
function buildContextMessage(input, files) {
	const mentioned = parseMentions(input.instruction, files);
	const extra = expandMentions(mentioned, files);
	const parts = [
		`Workspace files:\n${fileTree(files)}`,
		input.activePath ? `Active file: ${input.activePath}` : "",
		input.selection ? `Selection in ${input.selection.path} L${input.selection.fromLine}-L${input.selection.toLine}:\n${input.selection.text}` : ""
	];
	if (extra.length > 0) parts.push("Attached with @:\n" + extra.map((file) => `### ${file.path}\n${file.content}`).join("\n\n"));
	return parts.filter(Boolean).join("\n\n");
}
async function runAgentLoop(input, cfg) {
	return runAgentLoopStreaming(input, cfg, () => void 0);
}
async function runAgentLoopStreaming(input, cfg, emit, signal) {
	const flavor = flavorOf(input);
	const fileMap = sanitizeFileMap(Object.fromEntries(input.files.map((f) => [f.path, f.content])));
	const mentioned = parseMentions(input.instruction, fileMap);
	const files = capFiles(Object.entries(fileMap).map(([path, content]) => ({
		path,
		content
	})), mentioned);
	const chunks = indexFiles(files);
	const phase = resolveAgentPhase(input.mode, input.phase);
	const requirePlan = input.mode === "composer" || Boolean(flavor);
	const ctx = {
		files,
		chunks,
		edits: [],
		plan: input.approvedPlan?.length ? input.approvedPlan : [],
		requirePlan,
		phase,
		mode: input.mode
	};
	const traces = [];
	const rules = findRules(fileMap)?.text ?? null;
	if (input.mode === "inline") return runInline(cfg, input, files, signal);
	if (flavor) emit({
		type: "status",
		text: `ACP session/new · ${flavor.name}`
	});
	const sys = systemPrompt(input.mode, rules, flavor?.kind ?? null, phase);
	const userCtx = buildContextMessage(input, files);
	const messages = [{
		role: "system",
		content: sys
	}, {
		role: "user",
		content: userCtx
	}];
	for (const turn of input.history.slice(-8)) messages.push({
		role: turn.role,
		content: turn.content
	});
	messages.push({
		role: "user",
		content: input.instruction
	});
	let planNudged = false;
	const userBlob = `${userCtx}\n\n${input.instruction}`;
	const succeed = (body, steps) => {
		const debug = packDebug(input, cfg.provider, sys, userBlob, body.text, steps);
		emit({
			type: "done",
			...body,
			...debug ? { debug } : {}
		});
		return {
			ok: true,
			...body,
			...debug ? { debug } : {}
		};
	};
	try {
		for (let step = 0; step < MAX_STEPS; step++) {
			if (signal?.aborted) return {
				ok: false,
				error: "Stopped."
			};
			const hasPlan = ctx.plan.length > 0;
			const kind = toolKindFor(input.mode, phase);
			emit({
				type: "status",
				text: step === 0 ? phase === "plan" && input.mode === "composer" ? "Planning…" : phase === "build" ? "Building…" : "Reading the index…" : "Continuing…"
			});
			const completion = await completeStreaming(cfg, messages, true, (delta) => emit({
				type: "text",
				delta
			}), signal, toolsForStep(kind));
			const calls = completion.tool_calls ?? [];
			const callNames = calls.map((c) => c.function.name);
			if (calls.length === 0) {
				if (phase === "plan" && requirePlan && !hasPlan && !planNudged) {
					planNudged = true;
					messages.push({
						role: "assistant",
						content: completion.content ?? ""
					});
					messages.push({
						role: "user",
						content: "Before you finish, call set_plan with the steps you will take. Then stop and wait for Build it."
					});
					continue;
				}
				if (shouldAwaitBuild(phase, hasPlan, [])) return succeed({
					text: planReadyText(completion.content),
					traces,
					edits: [],
					plan: ctx.plan,
					awaitingBuild: true
				}, step + 1);
				return succeed({
					text: completion.content.trim() || "Done.",
					traces,
					edits: mergeEdits(ctx.edits),
					plan: ctx.plan
				}, step + 1);
			}
			messages.push({
				role: "assistant",
				content: completion.content ?? "",
				tool_calls: calls
			});
			for (const call of calls) {
				if (signal?.aborted) return {
					ok: false,
					error: "Stopped."
				};
				let args = {};
				try {
					args = JSON.parse(call.function.arguments || "{}");
				} catch {
					args = {};
				}
				const display = acpTraceName(call.function.name, flavor?.kind);
				emit({
					type: "status",
					text: `${display}…`
				});
				const started = Date.now();
				const result = executeTool(call.function.name, args, ctx);
				const trace = {
					id: call.id,
					name: display,
					args: toPlainArgs(args),
					resultPreview: result.slice(0, 400),
					ms: Date.now() - started
				};
				traces.push(trace);
				emit({
					type: "trace",
					trace
				});
				if (call.function.name === "set_plan") emit({
					type: "plan",
					entries: ctx.plan
				});
				if (call.function.name === "propose_edit") emit({
					type: "edits",
					edits: mergeEdits(ctx.edits)
				});
				messages.push({
					role: "tool",
					tool_call_id: call.id,
					content: result
				});
			}
			if (shouldAwaitBuild(phase, ctx.plan.length > 0, callNames)) return succeed({
				text: planReadyText(completion.content),
				traces,
				edits: [],
				plan: ctx.plan,
				awaitingBuild: true
			}, step + 1);
		}
		const text = phase === "plan" && ctx.plan.length > 0 ? planReadyText(void 0) : "Stopped after the tool-call limit. Review the staged edits.";
		const awaitingBuild = phase === "plan" && ctx.plan.length > 0;
		return succeed({
			text,
			traces,
			edits: awaitingBuild ? [] : mergeEdits(ctx.edits),
			plan: ctx.plan,
			awaitingBuild
		}, MAX_STEPS);
	} catch (error) {
		if (signal?.aborted) return {
			ok: false,
			error: "Stopped."
		};
		const message = error instanceof Error ? error.message : "Agent failed";
		emit({
			type: "error",
			error: message
		});
		return {
			ok: false,
			error: message
		};
	}
}
async function runInline(cfg, input, files, signal) {
	const sel = input.selection;
	if (!sel) return {
		ok: false,
		error: "Select code first."
	};
	const file = files[sel.path];
	if (file === void 0) return {
		ok: false,
		error: `Missing file ${sel.path}`
	};
	const messages = [{
		role: "system",
		content: "You rewrite a selected span of code. Return ONLY the replacement code. No markdown fences, no commentary."
	}, {
		role: "user",
		content: [
			`File: ${sel.path} L${sel.fromLine}-L${sel.toLine}`,
			`Instruction: ${input.instruction}`,
			"Selected code:",
			sel.text,
			"Surrounding file (for context, do not repeat it):",
			file.slice(0, 6e3)
		].join("\n\n")
	}];
	try {
		let text = (await complete(cfg, messages, false, signal)).content.trim();
		if (text.startsWith("```")) text = text.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```$/, "").trim();
		if (!text) return {
			ok: false,
			error: "Empty replacement"
		};
		const applied = applySearchReplace(file, sel.text, text);
		if (!applied.ok) return {
			ok: false,
			error: applied.error
		};
		const edit = {
			id: `inline_${sel.path}`,
			path: sel.path,
			oldText: file,
			newText: applied.next,
			description: input.instruction,
			status: "pending"
		};
		const debug = packDebug(input, cfg.provider, "You rewrite a selected span of code. Return ONLY the replacement code. No markdown fences, no commentary.", `File: ${sel.path} L${sel.fromLine}-L${sel.toLine}\nInstruction: ${input.instruction}\n\n${sel.text}`, text, 1);
		return {
			ok: true,
			text: "Inline replacement ready.",
			traces: [],
			edits: [edit],
			...debug ? { debug } : {}
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Inline edit failed"
		};
	}
}
//#endregion
export { runAgentLoop, runAgentLoopStreaming };
