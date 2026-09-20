import { a as builtinById, i as acpTraceName, r as acpSystemPreamble } from "./kinds-CCf1JBpH.mjs";
import { a as sanitizeFileMap, n as redactSecrets } from "./redact-Ckw8E-v4.mjs";
import { a as resolveAgentPhase, i as planReadyText, o as shouldAwaitBuild, s as toolKindFor } from "./phase-Dk9J4-qu.mjs";
import { A as mentionQuery, L as semanticSearch, M as nearestUiFiles, N as parseMentions, O as lineDiff, P as previewIssues, T as isUiTask, _ as formatAutoContext, b as formatUiGraph, c as autoContextPaths, g as findRules, o as applySearchReplace, p as expandMentions, s as applyStackMemory, u as compactLoopMessages, w as indexFiles, y as formatStackContext } from "./stack-BS70QEOJ.mjs";
import { a as toolsForStep, n as completeStreaming, r as executeTool, t as complete } from "./complete.server-BqR87f6u.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/loop.server-_iEdKLEZ.js
function isReadTool(name) {
	return name === "semantic_search" || name === "grep" || name === "read_file" || name === "list_dir";
}
function parseCall(call) {
	let args = {};
	try {
		args = JSON.parse(call.function.arguments || "{}");
	} catch {
		args = {};
	}
	return {
		id: call.id,
		name: call.function.name,
		args
	};
}
/** Consecutive read-only tools share a batch; mutating tools stay ordered. */
function partitionCalls(calls) {
	const batches = [];
	for (const call of calls) {
		const last = batches[batches.length - 1];
		if (last && last.every((c) => isReadTool(c.name)) && isReadTool(call.name)) {
			last.push(call);
			continue;
		}
		batches.push([call]);
	}
	return batches;
}
var DECL = /(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z_][\w]*)/;
function declarations(text) {
	return text.split("\n").flatMap((row, i) => {
		const match = DECL.exec(row);
		return match?.[1] ? [{
			name: match[1],
			line: i + 1
		}] : [];
	});
}
function addedLines(oldText, newText) {
	const lines = [];
	let n = 1;
	for (const row of lineDiff(oldText, newText)) {
		if (row.type === "add") lines.push(n);
		if (row.type !== "del") n += 1;
	}
	return lines;
}
function symbolsFromEdit(edit) {
	const decls = declarations(edit.newText);
	const added = addedLines(edit.oldText, edit.newText);
	const names = /* @__PURE__ */ new Set();
	for (const line of added) {
		const onLine = decls.filter((d) => d.line === line);
		if (onLine.length) {
			onLine.forEach((d) => names.add(d.name));
			continue;
		}
		const enclosing = [...decls].reverse().find((d) => d.line <= line);
		if (enclosing) names.add(enclosing.name);
	}
	for (const row of lineDiff(edit.oldText, edit.newText)) {
		if (row.type !== "add" && row.type !== "del") continue;
		const match = DECL.exec(row.text);
		if (match?.[1]) names.add(match[1]);
	}
	return [...names].filter((n) => n.length > 1 && n.length < 48).slice(0, 8);
}
function filesMentioning(files, symbol, skip) {
	const needle = symbol.toLowerCase();
	const out = [];
	for (const [path, content] of Object.entries(files)) {
		if (skip.has(path)) continue;
		if (content.toLowerCase().includes(needle)) out.push(path);
		if (out.length >= 3) break;
	}
	return out;
}
/** Three-line recap: what changed, what still references it, what the plan left open. */
function verifyRecap(edits, files, plan = []) {
	if (edits.length === 0) return "";
	const paths = [...new Set(edits.map((e) => e.path))];
	const skip = new Set(paths);
	const line1 = `Changed: ${paths.map((path) => {
		const names = [...new Set(edits.filter((e) => e.path === path).flatMap(symbolsFromEdit))];
		return names.length ? `${path} (${names.slice(0, 3).join(", ")})` : path;
	}).slice(0, 4).join("; ")}`;
	const leftover = [];
	for (const symbol of [...new Set(edits.flatMap(symbolsFromEdit))].slice(0, 5)) {
		const hits = filesMentioning(files, symbol, skip);
		if (hits.length) leftover.push(`${symbol} still in ${hits.slice(0, 2).join(", ")}`);
	}
	const line2 = leftover.length ? `Didn't: ${leftover.slice(0, 2).join("; ")}` : "Didn't: no other files mention the changed names.";
	const open = plan.filter((e) => e.status !== "completed").map((e) => e.content);
	const line3 = open.length ? `Left: ${open.slice(0, 2).join("; ")}` : "Left: nothing on the plan.";
	const preview = previewIssues(files, edits);
	return [
		line1,
		line2,
		line3,
		preview.length ? `Preview: ${preview.map((row) => `${row.path} ${row.issues[0]}`).slice(0, 2).join("; ")}` : ""
	].filter(Boolean).join("\n");
}
function appendVerify(text, edits, files, plan = []) {
	if (edits.length === 0 || text.includes("Changed:")) return text;
	const recap = verifyRecap(edits, files, plan);
	if (!recap) return text;
	return `${text.trim()}\n\n${recap}`;
}
var MAX_PLAN_STEPS = 8;
var MAX_BUILD_STEPS = 12;
var MAX_FILES = 120;
var MAX_CHARS = 22e4;
function flavorOf(input) {
	const id = input.agentId;
	if (!id) return null;
	return builtinById(id);
}
function systemPrompt(mode, rules, flavorName, phase, role) {
	const base = [
		flavorName ? acpSystemPreamble(flavorName) : "You are Aperture, an AI coding agent inside a web IDE.",
		"You operate on a virtual workspace snapshot. Tools see the live snapshot, including staged edits.",
		"Always inspect code with semantic_search, grep, or read_file before editing.",
		"You may call several search and read tools in one step; they run in parallel.",
		"Prefer the smallest unique search/replace. Never invent files that do not exist.",
		"Cite paths as path:line when answering questions.",
		role === "review" ? "When you find an issue, call note_diff. Do not dump entire files into chat unless asked." : "When the user wants a change, call propose_edit. Do not dump entire files into chat unless asked.",
		"The user may attach files with @path, @codebase (indexed search), or @repo-map. Treat those as the primary context.",
		"Never repeat API keys, tokens, passwords, private keys, or secret-looking strings. If one appears, write [redacted].",
		"For UI work, reuse tokens and classes from the UI context. Do not invent a palette.",
		"The ## Stack section in project rules is auto-maintained. Reuse that runtime, layout, and tokens.",
		mode === "inline" ? "Inline mode: return one focused replacement for the selection." : mode === "composer" ? role === "review" ? "Review mode: inspect staged diffs. Call note_diff for each real issue. Do not call propose_edit. Do not rewrite files." : phase === "plan" ? "Plan mode: inspect the repo with search and read. Call set_plan with 3–7 short steps. Then write a brief approach (files, method, risks, out of scope). Do not edit. Stop and wait — the user clicks Build it." : phase === "build" ? "Build mode: the user approved the plan. Execute it. Update set_plan statuses as you complete steps. Call propose_edit for each change. Do not expand scope. Do not restart the plan." : "Composer mode: call set_plan with 3–7 short steps before any propose_edit. Keep the plan visible. Update statuses as you complete steps, then edit." : "Ask mode: answer questions. You may search and read. Do not call set_plan or propose_edit. Nothing is written."
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
function buildContextMessage(input, files, chunks) {
	const mentioned = parseMentions(input.instruction, files);
	const extra = expandMentions(mentioned, files);
	const auto = (input.focusPaths?.length ? input.focusPaths : autoContextPaths({
		activePath: input.activePath ?? null,
		openTabs: input.openTabs ?? [],
		recentPaths: input.recentPaths ?? [],
		mentioned
	})).filter((path) => files[path] !== void 0 && !mentioned.includes(path));
	const parts = [
		`Workspace files:\n${fileTree(files)}`,
		input.activePath ? `Active file: ${input.activePath}` : "",
		input.selection ? `Selection in ${input.selection.path} L${input.selection.fromLine}-L${input.selection.toLine}:\n${input.selection.text}` : ""
	];
	if (mentioned.includes("repo-map")) parts.push("Attached @repo-map: use the workspace file tree above as the map of this repo.");
	if (mentioned.includes("codebase")) {
		const query = mentionQuery(input.instruction) || input.instruction;
		const hits = semanticSearch(chunks, query, 6);
		parts.push(hits.length === 0 ? "Attached @codebase: no matching chunks." : "Attached @codebase:\n" + hits.map((h) => {
			const c = h.chunk;
			return `# ${c.path}  ${c.name}  L${c.startLine}-${c.endLine}\n${c.text.split("\n").slice(0, 18).join("\n")}`;
		}).join("\n\n---\n\n"));
	}
	if (extra.length > 0) parts.push("Attached with @:\n" + extra.map((file) => `### ${file.path}\n${file.content}`).join("\n\n"));
	const autoBlock = formatAutoContext(auto, files);
	if (autoBlock) parts.push(autoBlock);
	const graph = formatUiGraph(files, input.instruction, input.activePath ?? null);
	if (graph) parts.push(graph);
	if (!findRules(files)) parts.push(formatStackContext(files));
	return parts.filter(Boolean).join("\n\n");
}
async function runAgentLoop(input, cfg) {
	return runAgentLoopStreaming(input, cfg, () => void 0);
}
async function runAgentLoopStreaming(input, cfg, emit, signal) {
	const flavor = flavorOf(input);
	const fileMap = applyStackMemory(sanitizeFileMap(Object.fromEntries(input.files.map((f) => [f.path, f.content]))));
	const mentioned = parseMentions(input.instruction, fileMap);
	const auto = input.focusPaths?.length ? input.focusPaths : autoContextPaths({
		activePath: input.activePath ?? null,
		openTabs: input.openTabs ?? [],
		recentPaths: input.recentPaths ?? [],
		mentioned,
		extra: isUiTask(input.instruction) ? nearestUiFiles(fileMap, input.instruction, input.activePath ?? null, 3) : []
	});
	const files = capFiles(Object.entries(fileMap).map(([path, content]) => ({
		path,
		content
	})), [...mentioned, ...auto]);
	const chunks = indexFiles(files);
	const phase = resolveAgentPhase(input.mode, input.phase);
	const requirePlan = (input.mode === "composer" || Boolean(flavor)) && phase !== "skip";
	const approved = input.approvedPlan?.length ? input.approvedPlan : [];
	const ctx = {
		files,
		chunks,
		edits: (input.pendingEdits ?? []).map((edit) => ({
			...edit,
			notes: [...edit.notes ?? []]
		})),
		plan: approved,
		requirePlan,
		phase,
		mode: input.mode,
		role: input.role
	};
	const traces = [];
	const rules = findRules(fileMap)?.text ?? null;
	if (input.mode === "inline") return runInline(cfg, input, files, signal);
	if (flavor) emit({
		type: "status",
		text: `ACP session/new · ${flavor.name}`
	});
	const sys = systemPrompt(input.mode, rules, flavor?.kind ?? null, phase, input.role);
	const userCtx = buildContextMessage(input, files, chunks);
	let messages = [{
		role: "system",
		content: sys
	}, {
		role: "user",
		content: userCtx
	}];
	for (const turn of input.history) messages.push({
		role: turn.role,
		content: turn.content
	});
	messages.push({
		role: "user",
		content: input.instruction
	});
	let planNudged = false;
	const maxSteps = phase === "build" ? MAX_BUILD_STEPS : MAX_PLAN_STEPS;
	const userBlob = `${userCtx}\n\n${input.instruction}`;
	const succeed = (body, steps) => {
		const edits = body.edits;
		const text = body.awaitingBuild || phase === "plan" ? body.text : appendVerify(body.text, edits, ctx.files, body.plan ?? ctx.plan);
		if (text !== body.text) emit({
			type: "status",
			text: "Verifying…"
		});
		const debug = packDebug(input, cfg.provider, sys, userBlob, text, steps);
		emit({
			type: "done",
			...body,
			text,
			...debug ? { debug } : {}
		});
		return {
			ok: true,
			...body,
			text,
			...debug ? { debug } : {}
		};
	};
	try {
		for (let step = 0; step < maxSteps; step++) {
			if (signal?.aborted) return {
				ok: false,
				error: "Stopped."
			};
			const hasPlan = ctx.plan.length > 0;
			const kind = input.role === "review" ? "review" : toolKindFor(input.mode, phase);
			emit({
				type: "status",
				text: (step === 0 ? phase === "plan" && input.mode === "composer" ? "Planning…" : phase === "build" ? "Building…" : "Reading the index…" : "Continuing…") + (step === 0 && input.compacted ? ` · thread memory (${input.compacted})` : "")
			});
			messages = compactLoopMessages(messages);
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
			const parsed = calls.map(parseCall);
			for (const batch of partitionCalls(parsed)) {
				if (signal?.aborted) return {
					ok: false,
					error: "Stopped."
				};
				const parallel = batch.length > 1 && batch.every((c) => isReadTool(c.name));
				if (parallel) emit({
					type: "status",
					text: `Reading ${batch.length} files…`
				});
				const runOne = (call) => {
					const started = Date.now();
					return {
						call,
						result: executeTool(call.name, call.args, ctx),
						ms: Date.now() - started
					};
				};
				const outcomes = parallel ? await Promise.all(batch.map(async (c) => runOne(c))) : batch.map(runOne);
				for (const outcome of outcomes) {
					const display = acpTraceName(outcome.call.name, flavor?.kind);
					if (!parallel) emit({
						type: "status",
						text: `${display}…`
					});
					const trace = {
						id: outcome.call.id,
						name: display,
						args: toPlainArgs(outcome.call.args),
						resultPreview: outcome.result.slice(0, 400),
						ms: outcome.ms
					};
					traces.push(trace);
					emit({
						type: "trace",
						trace
					});
					if (outcome.call.name === "set_plan") emit({
						type: "plan",
						entries: ctx.plan
					});
					if (outcome.call.name === "propose_edit" || outcome.call.name === "note_diff") emit({
						type: "edits",
						edits: mergeEdits(ctx.edits)
					});
					messages.push({
						role: "tool",
						tool_call_id: outcome.call.id,
						content: outcome.result
					});
				}
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
		}, maxSteps);
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
