import { r as extOf } from "./utils-DTfuEt1f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mentions-Detj12_r.js
function languageFromPath(path) {
	const ext = extOf(path);
	if (ext === "ts" || ext === "tsx" || ext === "mts" || ext === "cts") return "typescript";
	if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "javascript";
	if (ext === "json") return "json";
	if (ext === "md" || ext === "mdx") return "markdown";
	if (ext === "py") return "python";
	if (ext === "html" || ext === "htm") return "html";
	if (ext === "css") return "css";
	return "text";
}
function languageLabel(path) {
	const lang = languageFromPath(path);
	if (lang === "typescript") return "TypeScript";
	if (lang === "javascript") return "JavaScript";
	if (lang === "markdown") return "Markdown";
	if (lang === "python") return "Python";
	if (lang === "html") return "HTML";
	if (lang === "css") return "CSS";
	if (lang === "json") return "JSON";
	return "";
}
var WINDOW = 80;
function lineAt(source, index) {
	let line = 1;
	for (let i = 0; i < index && i < source.length; i++) if (source.charCodeAt(i) === 10) line += 1;
	return line;
}
function sliceLines(source, startLine, endLine) {
	return source.split("\n").slice(startLine - 1, endLine).join("\n");
}
function matchBrace(source, openIndex) {
	let depth = 0;
	let inStr = null;
	let escaped = false;
	for (let i = openIndex; i < source.length; i++) {
		const ch = source[i];
		if (inStr) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				escaped = true;
				continue;
			}
			if (ch === inStr) inStr = null;
			continue;
		}
		if (ch === "\"" || ch === "'" || ch === "`") {
			inStr = ch;
			continue;
		}
		if (ch === "/" && source[i + 1] === "/") {
			i = source.indexOf("\n", i);
			if (i < 0) return source.length;
			continue;
		}
		if (ch === "{" || ch === "(") depth += 1;
		else if (ch === "}" || ch === ")") {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return source.length;
}
function pushChunk(chunks, source, name, kind, start, end) {
	const startLine = lineAt(source, start);
	const endLine = lineAt(source, Math.max(start, end - 1));
	chunks.push({
		name,
		kind,
		startLine,
		endLine,
		text: sliceLines(source, startLine, endLine)
	});
}
function chunkJsFamily(source) {
	const chunks = [];
	const patterns = [
		{
			re: /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g,
			kind: "class",
			name: (m) => m[1] ?? "class"
		},
		{
			re: /(?:export\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/g,
			kind: "function",
			name: (m) => m[1] ?? "function"
		},
		{
			re: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g,
			kind: "function",
			name: (m) => m[1] ?? "fn"
		}
	];
	const seen = /* @__PURE__ */ new Set();
	for (const { re, kind, name } of patterns) {
		re.lastIndex = 0;
		let match;
		while (match = re.exec(source)) {
			const start = match.index;
			const brace = source.indexOf("{", start);
			const end = brace >= 0 ? matchBrace(source, brace) : start + match[0].length;
			const label = name(match);
			const key = `${kind}:${label}:${start}`;
			if (seen.has(key)) continue;
			seen.add(key);
			pushChunk(chunks, source, label, kind, start, end);
		}
	}
	const methodRe = /^\s+(?:async\s+)?(?:static\s+)?(?:get|set|)\s*([A-Za-z_]\w*)\s*\(/gm;
	let methodMatch;
	while (methodMatch = methodRe.exec(source)) {
		const name = methodMatch[1] ?? "method";
		if (name === "if" || name === "for" || name === "while" || name === "switch" || name === "catch") continue;
		const start = methodMatch.index;
		const brace = source.indexOf("{", start);
		if (brace < 0) continue;
		pushChunk(chunks, source, name, "method", start, matchBrace(source, brace));
	}
	return dedupeChunks(chunks, source);
}
function chunkPython(source) {
	const chunks = [];
	const lines = source.split("\n");
	const starts = [];
	lines.forEach((line, i) => {
		const trimmed = line.trimEnd();
		const match = /^( *)(def|async def|class)\s+(\w+)/.exec(trimmed);
		if (!match) return;
		const indent = match[1]?.length ?? 0;
		const kind = match[2] === "class" ? "class" : "function";
		starts.push({
			line: i,
			indent,
			name: match[3] ?? "block",
			kind
		});
	});
	starts.forEach((item, idx) => {
		let end = lines.length;
		for (let j = idx + 1; j < starts.length; j++) if (starts[j].indent <= item.indent) {
			end = starts[j].line;
			break;
		}
		if (idx === starts.length - 1) for (let k = item.line + 1; k < lines.length; k++) {
			const t = lines[k];
			if (t.trim() === "") continue;
			if ((t.match(/^ */)?.[0].length ?? 0) <= item.indent && t.trim() !== "") {
				end = k;
				break;
			}
		}
		chunks.push({
			name: item.name,
			kind: item.kind,
			startLine: item.line + 1,
			endLine: end,
			text: lines.slice(item.line, end).join("\n")
		});
	});
	return chunks;
}
function chunkMarkdown(source) {
	const lines = source.split("\n");
	const headings = [];
	lines.forEach((line, i) => {
		const m = /^(#{1,3})\s+(.+)$/.exec(line);
		if (m) headings.push({
			line: i,
			name: m[2].trim()
		});
	});
	return headings.map((h, i) => {
		const end = i + 1 < headings.length ? headings[i + 1].line : lines.length;
		return {
			name: h.name,
			kind: "heading",
			startLine: h.line + 1,
			endLine: end,
			text: lines.slice(h.line, end).join("\n")
		};
	});
}
function chunkWindows(source) {
	const lines = source.split("\n");
	if (lines.length === 0) return [];
	const chunks = [];
	for (let i = 0; i < lines.length; i += 64) {
		const startLine = i + 1;
		const endLine = Math.min(lines.length, i + WINDOW);
		chunks.push({
			name: `L${startLine}-L${endLine}`,
			kind: "block",
			startLine,
			endLine,
			text: lines.slice(i, endLine).join("\n")
		});
		if (endLine >= lines.length) break;
	}
	return chunks;
}
function dedupeChunks(chunks, source) {
	const sorted = [...chunks].sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
	const out = [];
	for (const chunk of sorted) {
		if (out.find((c) => c.name === chunk.name && Math.abs(c.startLine - chunk.startLine) <= 1)) continue;
		out.push(chunk);
	}
	if (out.length === 0) return chunkWindows(source);
	return out;
}
function chunkSource(path, source) {
	const lang = languageFromPath(path);
	let chunks = [];
	if (lang === "typescript" || lang === "javascript") chunks = chunkJsFamily(source);
	else if (lang === "python") chunks = chunkPython(source);
	else if (lang === "markdown") chunks = chunkMarkdown(source);
	else chunks = chunkWindows(source);
	if (chunks.length === 0) chunks = chunkWindows(source);
	return [{
		name: path.split("/").pop() ?? path,
		kind: "module",
		startLine: 1,
		endLine: Math.max(1, source.split("\n").length),
		text: source.length > 4e3 ? source.slice(0, 4e3) : source
	}, ...chunks.filter((c) => c.kind !== "module")];
}
var CAMEL = /([a-z0-9])([A-Z])/g;
var NON_TOKEN = /[^a-z0-9_]+/g;
function tokenize(text) {
	return text.replace(CAMEL, "$1 $2").toLowerCase().split(NON_TOKEN).map((t) => t.trim()).filter((t) => t.length >= 2 && t.length <= 40);
}
function murmurish(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function buildIdf(docs) {
	const df = /* @__PURE__ */ new Map();
	const n = Math.max(1, docs.length);
	for (const tokens of docs) {
		const uniq = new Set(tokens);
		for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
	}
	const idf = /* @__PURE__ */ new Map();
	for (const [token, count] of df) idf.set(token, Math.log((n + 1) / (count + .5)));
	return idf;
}
function embedTokens(tokens, idf) {
	const vec = /* @__PURE__ */ new Float32Array(256);
	if (tokens.length === 0) return Array.from(vec);
	const tf = /* @__PURE__ */ new Map();
	for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
	for (const [token, count] of tf) {
		const weight = count / tokens.length * (idf.get(token) ?? 1);
		const a = murmurish(token) % 256;
		const b = murmurish(`${token}#`) % 256;
		vec[a] += weight;
		vec[b] += weight * .5;
	}
	let norm = 0;
	for (let i = 0; i < 256; i++) norm += vec[i] * vec[i];
	norm = Math.sqrt(norm) || 1;
	const out = new Array(256);
	for (let i = 0; i < 256; i++) out[i] = vec[i] / norm;
	return out;
}
function cosine(a, b) {
	const n = Math.min(a.length, b.length);
	let sum = 0;
	for (let i = 0; i < n; i++) sum += a[i] * b[i];
	return sum;
}
var K1 = 1.2;
var B = .75;
function indexFiles(files) {
	const raw = [];
	for (const [path, content] of Object.entries(files)) chunkSource(path, content).forEach((chunk, i) => {
		raw.push({
			id: `${path}#${i}:${chunk.name}`,
			path,
			...chunk,
			tokens: tokenize(`${path} ${chunk.name} ${chunk.text}`)
		});
	});
	const idf = buildIdf(raw.map((c) => c.tokens));
	return raw.map((chunk) => ({
		...chunk,
		embedding: embedTokens(chunk.tokens, idf)
	}));
}
function bm25(queryTokens, docTokens, avgLen) {
	if (queryTokens.length === 0 || docTokens.length === 0) return 0;
	const tf = /* @__PURE__ */ new Map();
	for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
	const dl = docTokens.length;
	let score = 0;
	const uniq = [...new Set(queryTokens)];
	for (const q of uniq) {
		const f = tf.get(q) ?? 0;
		if (f === 0) continue;
		const denom = f + K1 * (.25 + B * (dl / Math.max(avgLen, 1)));
		score += f * 2.2 / denom;
	}
	return score;
}
function semanticSearch(chunks, query, limit = 8) {
	const qTokens = tokenize(query);
	if (chunks.length === 0 || qTokens.length === 0) return [];
	const qVec = embedTokens(qTokens, buildIdf([qTokens, ...chunks.map((c) => c.tokens)]));
	const avgLen = chunks.reduce((s, c) => s + c.tokens.length, 0) / chunks.length;
	const keywordScores = chunks.map((c) => bm25(qTokens, c.tokens, avgLen));
	const maxKw = Math.max(1e-4, ...keywordScores);
	const hits = chunks.map((chunk, i) => {
		const c = cosine(qVec, chunk.embedding);
		const kw = keywordScores[i] / maxKw;
		return {
			chunk,
			cosine: c,
			keyword: kw,
			score: .58 * c + .42 * kw
		};
	});
	hits.sort((a, b) => b.score - a.score);
	return hits.filter((h) => h.score > .02).slice(0, limit);
}
function grepFiles(files, pattern, maxHits = 40) {
	const hits = [];
	let regex = null;
	const raw = pattern.slice(0, 80);
	if (!(/([+*?]|\{\d+,?\d*\})[+*?{]/.test(raw) || /\(\?/.test(raw) || raw.length === 0)) try {
		regex = new RegExp(raw, "i");
	} catch {
		regex = null;
	}
	for (const [path, content] of Object.entries(files)) {
		content.split("\n").forEach((text, i) => {
			if (hits.length >= maxHits) return;
			if (regex ? regex.test(text) : text.toLowerCase().includes(raw.toLowerCase())) hits.push({
				path,
				line: i + 1,
				text: text.slice(0, 240)
			});
		});
		if (hits.length >= maxHits) break;
	}
	return hits;
}
function applySearchReplace(content, search, replace) {
	if (!search) return {
		ok: true,
		next: replace
	};
	const first = content.indexOf(search);
	if (first < 0) return {
		ok: false,
		error: "search string not found in file"
	};
	if (content.indexOf(search, first + search.length) >= 0) return {
		ok: false,
		error: "search string matched more than once; include surrounding lines to make it unique"
	};
	return {
		ok: true,
		next: content.slice(0, first) + replace + content.slice(first + search.length)
	};
}
function lineDiff(oldText, newText) {
	const a = oldText.split("\n");
	const b = newText.split("\n");
	const n = a.length;
	const m = b.length;
	const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? (dp[i + 1][j + 1] ?? 0) + 1 : Math.max(dp[i + 1][j] ?? 0, dp[i][j + 1] ?? 0);
	const out = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) if (a[i] === b[j]) {
		out.push({
			type: "eq",
			text: a[i]
		});
		i += 1;
		j += 1;
	} else if ((dp[i + 1][j] ?? 0) >= (dp[i][j + 1] ?? 0)) {
		out.push({
			type: "del",
			text: a[i]
		});
		i += 1;
	} else {
		out.push({
			type: "add",
			text: b[j]
		});
		j += 1;
	}
	while (i < n) {
		out.push({
			type: "del",
			text: a[i]
		});
		i += 1;
	}
	while (j < m) {
		out.push({
			type: "add",
			text: b[j]
		});
		j += 1;
	}
	return out;
}
function hunksFromDiff(oldText, newText) {
	const hunks = [];
	let oldLine = 1;
	let cur = null;
	const flush = () => {
		if (cur) hunks.push(cur);
		cur = null;
	};
	for (const row of lineDiff(oldText, newText)) {
		if (row.type === "eq") {
			flush();
			oldLine += 1;
			continue;
		}
		if (!cur) cur = {
			deleted: [],
			added: [],
			insertAfter: oldLine - 1
		};
		if (row.type === "del") {
			cur.deleted.push(oldLine);
			cur.insertAfter = oldLine;
			oldLine += 1;
		} else cur.added.push(row.text);
	}
	flush();
	return hunks;
}
function diffStats(oldText, newText) {
	let added = 0;
	let removed = 0;
	for (const row of lineDiff(oldText, newText)) if (row.type === "add") added += 1;
	else if (row.type === "del") removed += 1;
	return {
		added,
		removed
	};
}
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
function fuzzyMatch(query, text) {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const t = text.toLowerCase();
	if (t.includes(q)) return true;
	let i = 0;
	for (const ch of t) {
		if (ch === q[i]) i += 1;
		if (i === q.length) return true;
	}
	return false;
}
var CONTEXT_SOURCES = [{
	path: "codebase",
	kind: "source",
	description: "Search the indexed repo"
}, {
	path: "repo-map",
	kind: "source",
	description: "Workspace file tree"
}];
function isContextSource(path) {
	return CONTEXT_SOURCES.some((item) => item.path === path);
}
function mentionItems(files) {
	const folders = /* @__PURE__ */ new Set();
	const items = [...CONTEXT_SOURCES];
	for (const path of Object.keys(files)) {
		items.push({
			path,
			kind: "file",
			description: "File"
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
		kind: "folder",
		description: "Folder"
	});
	items.sort((a, b) => {
		if (a.kind === "source" && b.kind !== "source") return -1;
		if (a.kind !== "source" && b.kind === "source") return 1;
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
		if (isContextSource(path)) continue;
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
function filterMentions(items, query, limit = 10) {
	const q = query.trim().toLowerCase();
	const match = (item) => !q || fuzzyMatch(q, item.path) || Boolean(item.description && fuzzyMatch(q, item.description));
	const sources = items.filter((item) => item.kind === "source" && match(item));
	const rest = items.filter((item) => item.kind !== "source" && match(item));
	rest.sort((a, b) => {
		const as = a.path.toLowerCase().startsWith(q) ? 0 : 1;
		const bs = b.path.toLowerCase().startsWith(q) ? 0 : 1;
		if (as !== bs) return as - bs;
		return a.path.length - b.path.length;
	});
	return [...sources, ...rest].slice(0, limit);
}
function mentionQuery(instruction) {
	return instruction.replace(/@[A-Za-z0-9_./-]+/g, " ").replace(/\s+/g, " ").trim();
}
//#endregion
export { semanticSearch as _, expandMentions as a, grepFiles as c, languageFromPath as d, languageLabel as f, parseMentions as g, mentionQuery as h, diffStats as i, hunksFromDiff as l, mentionItems as m, activeMention as n, filterMentions as o, lineDiff as p, applySearchReplace as r, findRules as s, DEFAULT_RULES as t, indexFiles as u };
