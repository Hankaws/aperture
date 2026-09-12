import { t as normalizePlan } from "./plan-C3-iIH1W.mjs";
import { i as safeRelPath } from "./redact-Ckw8E-v4.mjs";
import { c as semanticSearch, r as grepFiles, t as applySearchReplace } from "./apply-edit-EH1xW8If.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/complete.server-DFKFh9h7.js
var AGENT_TOOLS = [
	{
		type: "function",
		function: {
			name: "set_plan",
			description: "Post or update the visible todo list. In Plan mode, call this then stop — the user clicks Build it. In Build mode, update statuses as you complete steps.",
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
			description: "Propose a focused edit. `search` must uniquely identify the text to replace. Empty search replaces the whole file. Do not apply edits yourself — the user will accept them in the UI. Locked in Plan mode until the user clicks Build it.",
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
function toolsForStep(kind) {
	if (kind === "read") return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit" && t.function.name !== "set_plan");
	if (kind === "plan") return AGENT_TOOLS.filter((t) => t.function.name !== "propose_edit");
	return AGENT_TOOLS;
}
function clip(text, max = 8e3) {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n… truncated`;
}
function executeTool(name, args, ctx) {
	if (name === "set_plan") {
		if (ctx.mode === "chat") return "Ask mode does not plan. Switch to Agent.";
		ctx.plan = normalizePlan(args.entries ?? args);
		if (ctx.plan.length === 0) return "Plan was empty. Pass entries: [{ content, status }].";
		if (ctx.phase === "plan") return `Plan set (${ctx.plan.length} steps). Stop. The user will click Build it.`;
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
		if (ctx.mode === "chat") return "Ask mode does not edit. The user can switch to Agent.";
		if (ctx.phase === "plan") return "Edits are locked until the user clicks Build it.";
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
	if (provider === "gemini") return "gemini-2.5-flash";
	if (provider === "deepseek") return "deepseek-chat";
	return "grok-4.5";
}
function openaiCompatBase(provider) {
	if (provider === "openai") return "https://api.openai.com/v1";
	if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai";
	if (provider === "deepseek") return "https://api.deepseek.com/v1";
	return "https://api.x.ai/v1";
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
	const res = await fetch(`${openaiCompatBase(cfg.provider)}/chat/completions`, {
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
	const res = await fetch(`${openaiCompatBase(cfg.provider)}/chat/completions`, {
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
//#endregion
export { toolsForStep as a, openaiCompatBase as i, completeStreaming as n, executeTool as r, complete as t };
