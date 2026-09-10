//#region node_modules/.nitro/vite/services/ssr/assets/tab.server-BD57F2QL.js
/** Cheap, low-latency models only. Never grok-4.5 / grok-4.6 / sonnet / gpt-4o. */
function modelOf(provider) {
	if (provider === "openai") return "gpt-4o-mini";
	if (provider === "anthropic") return "claude-haiku-4-5";
	return "grok-4-1-fast-non-reasoning";
}
var TAB_CACHE_MAX = 160;
var TAB_CACHE_TTL = 6e5;
function tabCache() {
	const g = globalThis;
	g.__apertureTabCache ??= /* @__PURE__ */ new Map();
	return g.__apertureTabCache;
}
function tabCacheKey(path, prefix, suffix) {
	return `${path}\n${prefix.slice(-480)}\n${suffix.slice(0, 120)}`;
}
function tabCacheGet(key) {
	const cache = tabCache();
	const hit = cache.get(key);
	if (!hit) return null;
	if (Date.now() - hit.at > TAB_CACHE_TTL) {
		cache.delete(key);
		return null;
	}
	cache.delete(key);
	cache.set(key, hit);
	return hit.text;
}
function tabCacheSet(key, text) {
	const cache = tabCache();
	cache.set(key, {
		text,
		at: Date.now()
	});
	while (cache.size > TAB_CACHE_MAX) {
		const first = cache.keys().next().value;
		if (first === void 0) break;
		cache.delete(first);
	}
}
function cleanCompletion(text, prefix, suffix) {
	let next = text.replace(/\r/g, "");
	if (next.startsWith("```")) next = next.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```[\s\S]*$/, "");
	const line = (next.split("\n")[0] ?? "").replace(/^\s+/, "").slice(0, 160);
	if (!line) return "";
	if (suffix.startsWith(line)) return "";
	if ((prefix.split("\n").pop() ?? "").endsWith(line)) return "";
	return line;
}
async function completeTab(cfg, input, signal) {
	const prefix = input.prefix.slice(-2400);
	const suffix = input.suffix.slice(0, 280);
	const prompt = [
		"You complete code at the cursor. Return ONLY the characters to insert.",
		"Do not repeat PREFIX. Do not use markdown. One line max. No explanation.",
		`File: ${input.path}`,
		"PREFIX:",
		prefix,
		"SUFFIX:",
		suffix || "(end of file)"
	].join("\n");
	if (cfg.provider === "anthropic") {
		const res = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": cfg.apiKey,
				"anthropic-version": "2023-06-01"
			},
			body: JSON.stringify({
				model: modelOf("anthropic"),
				max_tokens: 40,
				temperature: .05,
				stop_sequences: ["\n"],
				messages: [{
					role: "user",
					content: prompt
				}]
			}),
			signal
		});
		if (!res.ok) throw new Error("Tab unavailable");
		return cleanCompletion((await res.json()).content?.map((b) => b.text ?? "").join("") ?? "", prefix, suffix);
	}
	const base = cfg.provider === "openai" ? "https://api.openai.com/v1" : "https://api.x.ai/v1";
	const models = cfg.provider === "openai" ? ["gpt-4o-mini"] : ["grok-4-1-fast-non-reasoning", "grok-4.1-fast-non-reasoning"];
	let lastError = null;
	for (const model of models) {
		const res = await fetch(`${base}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cfg.apiKey}`
			},
			body: JSON.stringify({
				model,
				temperature: .05,
				max_tokens: 40,
				stop: ["\n"],
				messages: [{
					role: "user",
					content: prompt
				}]
			}),
			signal
		});
		if (res.ok) return cleanCompletion((await res.json()).choices?.[0]?.message?.content ?? "", prefix, suffix);
		lastError = /* @__PURE__ */ new Error("Tab unavailable");
		if (res.status === 401 || res.status === 403) break;
	}
	throw lastError ?? /* @__PURE__ */ new Error("Tab unavailable");
}
//#endregion
export { completeTab, tabCacheGet, tabCacheKey, tabCacheSet };
