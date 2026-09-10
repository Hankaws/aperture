import { a as builtinById, i as acpTraceName, r as acpSystemPreamble } from "./kinds-CCf1JBpH.mjs";
import { a as sanitizeFileMap, i as safeRelPath } from "./redact-Ckw8E-v4.mjs";
import { c as indexFiles, f as parseMentions, i as expandMentions, o as findRules, p as semanticSearch, r as applySearchReplace, s as grepFiles } from "./mentions-CHeUauxU.mjs";
import { t as normalizePlan } from "./plan-C3-iIH1W.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/loop.server-BKAQEU3S.js
var AGENT_TOOLS = [
	{
		type: "function",
		function: {
			name: "set_plan",
			description: "Post or update the visible todo list. Composer and ACP sessions must call this before propose_edit. Update statuses as you complete steps.",
			parameters: {
				type: "object",
				properties: { entries: {
					type: "array",
					items: {
						type: "object",
						properties: {
							content: { type: "string" },
							status: {
								type: "string",
								enum: [
									"pending",
									"in_progress",
									"completed"
								]
							},
							priority: {
								type: "string",
								enum: [
									"high",
									"medium",
									"low"
								]
							}
						},
						required: ["content"]
					}
				} },
				required: ["entries"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "semantic_search",
			description: "Search the indexed workspace by meaning. Use this first when you do not know which file holds the answer.",
			parameters: {
				type: "object",
				properties: { query: {
					type: "string",
					description: "Natural-language or keyword query"
				} },
				required: ["query"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "grep",
			description: "Exact or regex search across every file. Returns matching lines.",
			parameters: {
				type: "object",
				properties: { pattern: { type: "string" } },
				required: ["pattern"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "read_file",
			description: "Read a file. Optionally clip to a line range (1-based, inclusive).",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string" },
					startLine: { type: "number" },
					endLine: { type: "number" }
				},
				required: ["path"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "list_dir",
			description: "List workspace files, optionally under a folder prefix.",
			parameters: {
				type: "object",
				properties: { prefix: { type: "string" } }
			}
		}
	},
	{
		type: "function",
		function: {
			name: "propose_edit",
			description: "Propose a focused edit. `search` must uniquely identify the text to replace. Empty search replaces the whole file. Do not apply edits yourself — the user will accept them in the UI. Locked until set_plan has run in Composer.",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string" },
					search: {
						type: "string",
						description: "Exact existing text to replace. Empty = whole file."
					},
					replace: {
						type: "string",
						description: "Replacement text"
					},
					description: {
						type: "string",
						description: "One-line summary of the change"
					}
				},
				required: ["path", "replace"]
			}
		}
	}
];
function toolsForStep(allowEdit) {
	if (allowEdit) return AGENT_TOOLS;
	return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit");
}
function clip(text, max = 8e3) {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n… truncated`;
}
function executeTool(name, args, ctx) {
	if (name === "set_plan") {
		ctx.plan = normalizePlan(args.entries ?? args);
		if (ctx.plan.length === 0) return "Plan was empty. Pass entries: [{ content, status }].";
		return `Plan set (${ctx.plan.length} steps). Update statuses as you go, then edit.`;
	}
	if (name === "semantic_search") {
		const query = String(args.query ?? "");
		const hits = semanticSearch(ctx.chunks, query, 8);
		if (hits.length === 0) return "No matching chunks.";
		return hits.map((h) => {
			const c = h.chunk;
			return [`# ${c.path}  ${c.name}  L${c.startLine}-L${c.endLine}  score=${h.score.toFixed(3)}`, c.text.split("\n").slice(0, 28).join("\n")].join("\n");
		}).join("\n\n---\n\n");
	}
	if (name === "grep") {
		const pattern = String(args.pattern ?? "");
		const hits = grepFiles(ctx.files, pattern, 40);
		if (hits.length === 0) return "No matches.";
		return hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n");
	}
	if (name === "read_file") {
		const path = safeRelPath(String(args.path ?? "")) ?? "";
		const content = ctx.files[path];
		if (content === void 0) return `File not found: ${path}. Known files:\n${Object.keys(ctx.files).join("\n")}`;
		const lines = content.split("\n");
		const start = Math.max(1, Number(args.startLine ?? 1));
		const end = Math.min(lines.length, Number(args.endLine ?? lines.length));
		return clip(lines.slice(start - 1, end).map((line, i) => `${String(start + i).padStart(4, " ")} ${line}`).join("\n"));
	}
	if (name === "list_dir") {
		const prefix = String(args.prefix ?? "");
		return Object.keys(ctx.files).filter((p) => prefix ? p === prefix || p.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) : true).sort().map((p) => `${p}  (${ctx.files[p].split("\n").length} lines)`).join("\n") || "(empty)";
	}
	if (name === "propose_edit") {
		if (ctx.requirePlan && ctx.plan.length === 0) return "Edits are locked until you call set_plan with 3–7 steps.";
		const path = safeRelPath(String(args.path ?? "")) ?? "";
		const search = String(args.search ?? "");
		const replace = String(args.replace ?? "");
		const description = String(args.description ?? "Update file");
		const current = ctx.files[path];
		if (current === void 0) return `File not found: ${path}`;
		const applied = applySearchReplace(current, search, replace);
		if (!applied.ok) return `Edit rejected: ${applied.error}`;
		ctx.files[path] = applied.next;
		ctx.edits.push({
			id: `edit_${ctx.edits.length + 1}_${path}`,
			path,
			oldText: current,
			newText: applied.next,
			description,
			status: "pending"
		});
		return `Edit staged for ${path}. The user must accept it in the UI.`;
	}
	return `Unknown tool: ${name}`;
}
function modelOf(provider) {
	if (provider === "openai") return "gpt-4o";
	if (provider === "anthropic") return "claude-sonnet-4-5";
	return "grok-4.5";
}
function baseOf(provider) {
	return provider === "openai" ? "https://api.openai.com/v1" : "https://api.x.ai/v1";
}
function asAnthropicTools(tools) {
	return tools.map((t) => ({
		name: t.function.name,
		description: t.function.description,
		input_schema: t.function.parameters
	}));
}
async function complete(cfg, messages, useTools, signal, tools = AGENT_TOOLS) {
	if (cfg.provider === "anthropic") return completeAnthropic(cfg.apiKey, messages, useTools, signal, tools);
	const body = {
		model: modelOf(cfg.provider),
		messages,
		temperature: .2,
		max_tokens: 1800
	};
	if (useTools) {
		body.tools = tools;
		body.tool_choice = "auto";
	}
	const res = await fetch(`${baseOf(cfg.provider)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${cfg.apiKey}`
		},
		body: JSON.stringify(body),
		signal
	});
	if (!res.ok) throw new Error(`${cfg.provider} refused the request (${res.status}).`);
	const message = (await res.json()).choices[0]?.message;
	return {
		content: message?.content ?? "",
		tool_calls: message?.tool_calls
	};
}
async function completeStreaming(cfg, messages, useTools, onText, signal, tools = AGENT_TOOLS) {
	if (cfg.provider === "anthropic") return streamAnthropic(cfg.apiKey, messages, useTools, onText, signal, tools);
	const body = {
		model: modelOf(cfg.provider),
		messages,
		temperature: .2,
		max_tokens: 1800,
		stream: true
	};
	if (useTools) {
		body.tools = tools;
		body.tool_choice = "auto";
	}
	const res = await fetch(`${baseOf(cfg.provider)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${cfg.apiKey}`
		},
		body: JSON.stringify(body),
		signal
	});
	if (!res.ok) throw new Error(`${cfg.provider} refused the request (${res.status}).`);
	const acc = {
		content: "",
		tool_calls: []
	};
	const calls = [];
	for await (const payload of iterateSseData(res)) {
		let json;
		try {
			json = JSON.parse(payload);
		} catch {
			continue;
		}
		const delta = json.choices?.[0]?.delta;
		if (!delta) continue;
		if (delta.content) {
			acc.content += delta.content;
			onText(delta.content);
		}
		if (delta.tool_calls) for (const part of delta.tool_calls) {
			const index = part.index ?? 0;
			if (!calls[index]) calls[index] = {
				id: part.id ?? `call_${index}`,
				type: "function",
				function: {
					name: "",
					arguments: ""
				}
			};
			const slot = calls[index];
			if (part.id) slot.id = part.id;
			if (part.function?.name) slot.function.name += part.function.name;
			if (part.function?.arguments) slot.function.arguments += part.function.arguments;
		}
	}
	const tool_calls = calls.filter(Boolean);
	if (tool_calls.length > 0) acc.tool_calls = tool_calls;
	else delete acc.tool_calls;
	return acc;
}
async function completeAnthropic(apiKey, messages, useTools, signal, tools = AGENT_TOOLS) {
	const { system, converted } = toAnthropic(messages);
	const body = {
		model: "claude-sonnet-4-5",
		max_tokens: 1800,
		system,
		messages: converted
	};
	if (useTools) body.tools = asAnthropicTools(tools);
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01"
		},
		body: JSON.stringify(body),
		signal
	});
	if (!res.ok) throw new Error(`anthropic refused the request (${res.status}).`);
	const data = await res.json();
	const text = data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
	const tool_calls = data.content.filter((b) => b.type === "tool_use").map((b) => ({
		id: b.id ?? "call",
		type: "function",
		function: {
			name: b.name ?? "",
			arguments: JSON.stringify(b.input ?? {})
		}
	}));
	return {
		content: text,
		tool_calls: tool_calls.length ? tool_calls : void 0
	};
}
async function streamAnthropic(apiKey, messages, useTools, onText, signal, tools = AGENT_TOOLS) {
	const { system, converted } = toAnthropic(messages);
	const body = {
		model: "claude-sonnet-4-5",
		max_tokens: 1800,
		system,
		messages: converted,
		stream: true
	};
	if (useTools) body.tools = asAnthropicTools(tools);
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01"
		},
		body: JSON.stringify(body),
		signal
	});
	if (!res.ok) throw new Error(`anthropic refused the request (${res.status}).`);
	const acc = { content: "" };
	const calls = [];
	const jsonByIndex = /* @__PURE__ */ new Map();
	for await (const payload of iterateSseData(res)) {
		let event;
		try {
			event = JSON.parse(payload);
		} catch {
			continue;
		}
		if (event.type === "content_block_start") {
			const block = event.content_block;
			if (block?.type === "tool_use") {
				const index = event.index ?? calls.length;
				calls[index] = {
					id: block.id ?? `call_${index}`,
					type: "function",
					function: {
						name: block.name ?? "",
						arguments: ""
					}
				};
				jsonByIndex.set(index, "");
			}
		} else if (event.type === "content_block_delta") {
			if (event.delta?.type === "text_delta" && event.delta.text) {
				acc.content += event.delta.text;
				onText(event.delta.text);
			} else if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
				const index = event.index ?? 0;
				jsonByIndex.set(index, (jsonByIndex.get(index) ?? "") + event.delta.partial_json);
			}
		}
	}
	for (const [index, json] of jsonByIndex) {
		const slot = calls[index];
		if (slot) slot.function.arguments = json;
	}
	const tool_calls = calls.filter(Boolean);
	if (tool_calls.length > 0) acc.tool_calls = tool_calls;
	return acc;
}
function toAnthropic(messages) {
	const system = messages.filter((m) => m.role === "system").map((m) => m.content ?? "").join("\n");
	const converted = [];
	for (const m of messages) {
		if (m.role === "system") continue;
		if (m.role === "tool") {
			converted.push({
				role: "user",
				content: [{
					type: "tool_result",
					tool_use_id: m.tool_call_id,
					content: m.content ?? ""
				}]
			});
			continue;
		}
		if (m.role === "assistant" && m.tool_calls?.length) {
			converted.push({
				role: "assistant",
				content: [...m.content ? [{
					type: "text",
					text: m.content
				}] : [], ...m.tool_calls.map((c) => ({
					type: "tool_use",
					id: c.id,
					name: c.function.name,
					input: JSON.parse(c.function.arguments || "{}")
				}))]
			});
			continue;
		}
		converted.push({
			role: m.role,
			content: m.content ?? ""
		});
	}
	return {
		system,
		converted
	};
}
async function* iterateSseData(res) {
	const reader = res.body?.getReader();
	if (!reader) return;
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const data = trimmed.slice(5).trim();
			if (!data || data === "[DONE]") continue;
			yield data;
		}
	}
	const tail = buffer.trim();
	if (tail.startsWith("data:")) {
		const data = tail.slice(5).trim();
		if (data && data !== "[DONE]") yield data;
	}
}
var MAX_STEPS = 8;
var MAX_FILES = 120;
var MAX_CHARS = 22e4;
function flavorOf(input) {
	const id = input.agentId;
	if (!id) return null;
	return builtinById(id);
}
function systemPrompt(mode, rules, flavorName) {
	const base = [
		flavorName ? acpSystemPreamble(flavorName) : "You are Aperture, an AI coding agent inside a web IDE.",
		"You operate on a virtual workspace snapshot. Tools see the live snapshot, including staged edits.",
		"Always inspect code with semantic_search, grep, or read_file before editing.",
		"Prefer the smallest unique search/replace. Never invent files that do not exist.",
		"Cite paths as path:line when answering questions.",
		"When the user wants a change, call propose_edit. Do not dump entire files into chat unless asked.",
		"The user may attach files with @path. Treat those as the primary context.",
		"Never repeat API keys, tokens, passwords, private keys, or secret-looking strings. If one appears, write [redacted].",
		mode === "inline" ? "Inline mode: return one focused replacement for the selection." : mode === "composer" ? "Composer mode: call set_plan with 3–7 short steps before any propose_edit. Keep the plan visible. Update statuses as you complete steps, then edit." : "Chat mode: answer first; only edit when the user asks for a change."
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
	const requirePlan = input.mode === "composer" || Boolean(flavor);
	const ctx = {
		files,
		chunks,
		edits: [],
		plan: [],
		requirePlan
	};
	const traces = [];
	const rules = findRules(fileMap)?.text ?? null;
	if (input.mode === "inline") return runInline(cfg, input, files, signal);
	if (flavor) emit({
		type: "status",
		text: `ACP session/new · ${flavor.name}`
	});
	const messages = [{
		role: "system",
		content: systemPrompt(input.mode, rules, flavor?.kind ?? null)
	}, {
		role: "user",
		content: buildContextMessage(input, files)
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
	try {
		for (let step = 0; step < MAX_STEPS; step++) {
			if (signal?.aborted) return {
				ok: false,
				error: "Stopped."
			};
			const hasPlan = ctx.plan.length > 0;
			const allowEdit = !requirePlan || hasPlan;
			emit({
				type: "status",
				text: step === 0 ? requirePlan && !hasPlan ? "Writing a plan…" : "Reading the index…" : "Continuing…"
			});
			const completion = await completeStreaming(cfg, messages, true, (delta) => emit({
				type: "text",
				delta
			}), signal, toolsForStep(allowEdit));
			const calls = completion.tool_calls ?? [];
			if (calls.length === 0) {
				if (requirePlan && !hasPlan && !planNudged) {
					planNudged = true;
					messages.push({
						role: "assistant",
						content: completion.content ?? ""
					});
					messages.push({
						role: "user",
						content: "Before you finish, call set_plan with the steps you will take. Then continue."
					});
					continue;
				}
				const text = completion.content.trim() || "Done.";
				const edits = mergeEdits(ctx.edits);
				const plan = ctx.plan;
				emit({
					type: "done",
					text,
					traces,
					edits,
					plan
				});
				return {
					ok: true,
					text,
					traces,
					edits,
					plan
				};
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
		}
		const text = "Stopped after the tool-call limit. Review the staged edits.";
		const edits = mergeEdits(ctx.edits);
		emit({
			type: "done",
			text,
			traces,
			edits,
			plan: ctx.plan
		});
		return {
			ok: true,
			text,
			traces,
			edits,
			plan: ctx.plan
		};
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
		return {
			ok: true,
			text: "Inline replacement ready.",
			traces: [],
			edits: [{
				id: `inline_${sel.path}`,
				path: sel.path,
				oldText: file,
				newText: applied.next,
				description: input.instruction,
				status: "pending"
			}]
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
