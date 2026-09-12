import { i as fuzzyMatch } from "./utils-DTfuEt1f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mentions-9PH6SrSM.js
var RULE_CANDIDATES = [
	".aperture.md",
	"APERTURE.md",
	".cursorrules",
	"AGENTS.md",
	".cursor/rules.md"
];
var DEFAULT_RULES = `# Project rules

- Prefer the smallest unique search/replace. Do not rewrite files unless asked.
- Match the existing style. Cite path:line when you explain.
- Do not add dependencies unless the user asks.
`;
function findRules(files) {
	for (const path of RULE_CANDIDATES) {
		const text = files[path]?.trim();
		if (text) return {
			path,
			text
		};
	}
	return null;
}
function mentionItems(files) {
	const folders = /* @__PURE__ */ new Set();
	const items = [];
	for (const path of Object.keys(files)) {
		items.push({
			path,
			kind: "file"
		});
		const parts = path.split("/");
		let acc = "";
		for (let i = 0; i < parts.length - 1; i++) {
			acc = acc ? `${acc}/${parts[i]}` : parts[i];
			folders.add(acc);
		}
	}
	for (const path of folders) items.push({
		path,
		kind: "folder"
	});
	items.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
		return a.path.localeCompare(b.path);
	});
	return items;
}
function parseMentions(text, files) {
	const catalog = mentionItems(files);
	const found = [];
	const re = /@([A-Za-z0-9_./-]+)/g;
	let match;
	while (match = re.exec(text)) {
		const raw = match[1];
		const hit = catalog.find((item) => item.path === raw) ?? catalog.find((item) => item.path.startsWith(`${raw}/`) || item.path === raw);
		if (hit) found.push(hit.path);
	}
	return [...new Set(found)];
}
function expandMentions(paths, files, cap = 8) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const path of paths) {
		if (files[path] !== void 0) {
			if (seen.has(path)) continue;
			seen.add(path);
			out.push({
				path,
				content: files[path].slice(0, 4e3)
			});
		} else {
			const prefix = path.endsWith("/") ? path : `${path}/`;
			for (const filePath of Object.keys(files)) if (filePath === path || filePath.startsWith(prefix)) {
				if (seen.has(filePath)) continue;
				seen.add(filePath);
				out.push({
					path: filePath,
					content: files[filePath].slice(0, 2400)
				});
				if (out.length >= cap) return out;
			}
		}
		if (out.length >= cap) break;
	}
	return out;
}
function activeMention(text, caret) {
	const left = text.slice(0, caret);
	const at = left.lastIndexOf("@");
	if (at < 0) return null;
	const between = left.slice(at + 1);
	if (between.includes(" ") || between.includes("\n") || between.includes("	")) return null;
	return {
		start: at,
		query: between
	};
}
function filterMentions(items, query, limit = 8) {
	const q = query.trim().toLowerCase();
	const ranked = items.filter((item) => fuzzyMatch(q, item.path));
	ranked.sort((a, b) => {
		const as = a.path.toLowerCase().startsWith(q) ? 0 : 1;
		const bs = b.path.toLowerCase().startsWith(q) ? 0 : 1;
		if (as !== bs) return as - bs;
		return a.path.length - b.path.length;
	});
	return ranked.slice(0, limit);
}
//#endregion
export { findRules as a, filterMentions as i, activeMention as n, mentionItems as o, expandMentions as r, parseMentions as s, DEFAULT_RULES as t };
