import { r as extOf } from "./utils-DTfuEt1f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stack-BS70QEOJ.js
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
function grepFiles(files, pattern, maxHits = 40, pathPrefix) {
	const hits = [];
	let regex = null;
	const raw = pattern.slice(0, 80);
	if (!(/([+*?]|\{\d+,?\d*\})[+*?{]/.test(raw) || /\(\?/.test(raw) || raw.length === 0)) try {
		regex = new RegExp(raw, "i");
	} catch {
		regex = null;
	}
	const prefix = pathPrefix?.trim() ?? "";
	for (const [path, content] of Object.entries(files)) {
		if (prefix && path !== prefix && !path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) && !path.endsWith(`/${prefix}`)) continue;
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
function applyHunk(lines, hunk) {
	const next = [...lines];
	if (hunk.deleted.length) {
		const start = hunk.deleted[0] - 1;
		next.splice(start, hunk.deleted.length, ...hunk.added);
	} else next.splice(hunk.insertAfter, 0, ...hunk.added);
	return next;
}
function hunkLines(oldText, hunk) {
	const old = oldText.split("\n");
	return [...hunk.deleted.map((n) => old[n - 1] ?? ""), ...hunk.added];
}
/** Rebuild newText without hunk `index`. Empty string means the edit is fully reverted. */
function dropHunk(oldText, newText, index) {
	const hunks = hunksFromDiff(oldText, newText);
	if (index < 0 || index >= hunks.length) return newText;
	let lines = oldText.split("\n");
	for (let i = hunks.length - 1; i >= 0; i -= 1) {
		if (i === index) continue;
		lines = applyHunk(lines, hunks[i]);
	}
	return lines.join("\n");
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
var VOID = /* @__PURE__ */ new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
]);
function isPreviewPath(path) {
	return /\.(html?|css)$/i.test(path);
}
function htmlIssues(html) {
	const issues = [];
	if (!html.trim()) return ["empty HTML"];
	if (typeof DOMParser !== "undefined") try {
		const err = new DOMParser().parseFromString(html, "text/html").querySelector("parsererror");
		if (err) issues.push((err.textContent ?? "parse error").replace(/\s+/g, " ").slice(0, 160));
	} catch (error) {
		issues.push(error instanceof Error ? error.message.slice(0, 160) : "parse error");
	}
	const stack = [];
	const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)\b[^>]*?(\/?)\s*>/gi;
	let match;
	while (match = re.exec(html)) {
		if (match[0].startsWith("<!--") || match[0].toLowerCase().startsWith("<!doctype")) continue;
		if (match[1]) {
			const close = match[1].toLowerCase();
			let i = stack.length - 1;
			while (i >= 0 && stack[i] !== close) i -= 1;
			if (i < 0) issues.push(`unexpected </${close}>`);
			else stack.length = i;
			continue;
		}
		const tag = (match[2] ?? "").toLowerCase();
		if (!(match[3] === "/" || VOID.has(tag))) stack.push(tag);
	}
	const leftover = stack.filter((tag) => tag !== "html" && tag !== "head" && tag !== "body");
	if (leftover.length) issues.push(`unclosed <${leftover.slice(-3).join(">, <")}>`);
	return [...new Set(issues)].slice(0, 6);
}
function cssIssues(css) {
	let depth = 0;
	for (const ch of css) {
		if (ch === "{") depth += 1;
		else if (ch === "}") depth -= 1;
		if (depth < 0) return ["unmatched }"];
	}
	if (depth > 0) return [`${depth} unclosed {`];
	return [];
}
function issuesForText(path, text) {
	if (/\.html?$/i.test(path)) return htmlIssues(text);
	if (/\.css$/i.test(path)) return cssIssues(text);
	return [];
}
function mergeEdits(files, edits) {
	const next = { ...files };
	for (const edit of edits) next[edit.path] = edit.newText;
	return next;
}
function previewIssues(files, edits, liveErrors = []) {
	const snapshot = mergeEdits(files, edits);
	const out = [];
	const paths = new Set(edits.filter((e) => isPreviewPath(e.path)).map((e) => e.path));
	for (const path of paths) {
		const issues = issuesForText(path, snapshot[path] ?? "");
		if (issues.length) out.push({
			path,
			issues
		});
	}
	if (liveErrors.length && paths.size) {
		const htmlPath = [...paths].find((p) => /\.html?$/i.test(p)) ?? [...paths][0];
		const row = out.find((r) => r.path === htmlPath);
		const extra = liveErrors.slice(0, 4);
		if (row) row.issues.push(...extra);
		else out.push({
			path: htmlPath,
			issues: extra
		});
	}
	return out;
}
function notesFromPreviewIssues(path, issues) {
	return issues.slice(0, 4).map((text, i) => ({
		id: `preview_${i}_${path}`,
		excerpt: "",
		type: "eq",
		text: `Preview check: ${text}`
	}));
}
function previewNotesForEdit(edit, files, liveErrors = []) {
	if (!isPreviewPath(edit.path)) return [];
	const rows = previewIssues(files, [edit], liveErrors);
	const hit = rows.find((r) => r.path === edit.path) ?? rows[0];
	if (!hit) return [];
	return notesFromPreviewIssues(edit.path, hit.issues);
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
	const paths = Array.isArray(files) ? files : Object.keys(files);
	const folders = /* @__PURE__ */ new Set();
	const items = [...CONTEXT_SOURCES];
	for (const path of paths) {
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
/** Windsurf-style: last viewed files and open tabs ride along without @. */
function autoContextPaths(input) {
	const skip = new Set(input.mentioned ?? []);
	const out = [];
	const add = (path) => {
		if (!path || skip.has(path) || out.includes(path)) return;
		out.push(path);
	};
	add(input.activePath);
	for (const path of input.recentPaths.slice(0, 3)) add(path);
	for (const path of input.openTabs) add(path);
	for (const path of input.extra ?? []) add(path);
	return out.slice(0, 6);
}
function formatAutoContext(paths, files, clip = 2400) {
	const blocks = paths.filter((path) => files[path] !== void 0).map((path) => `### ${path}\n${files[path].slice(0, clip)}`);
	if (blocks.length === 0) return "";
	return `Auto-context (open tabs and recently viewed):\n${blocks.join("\n\n")}`;
}
/** Editor chrome + syntax. Hex matches public/theme.html exactly. */
var EDITOR = {
	page: "#09090b",
	bg: "#0c0c0e",
	surface: "#111113",
	elevated: "#18181b",
	fg: "#e8e9ed",
	fgBright: "#f4f4f5",
	muted: "#a1a1aa",
	subtle: "#71717a",
	gutterFg: "#8b8e98",
	border: "#27272a",
	accent: "#93c5fd",
	ok: "#6ee7b7",
	danger: "#f87171",
	warn: "#fbbf24",
	caret: "#f4f4f5",
	activeLine: "#1a1a20",
	activeLineGutter: "#c4c4cc",
	selection: "#1f4a3c",
	selectionInactive: "#16332c",
	wordRead: "#243830",
	wordWrite: "#2d5c4c",
	matchBorder: "#6cb2ff",
	tabHover: "#1a1a20",
	tabModified: "#c4c4cc",
	tabPreview: "#a1a1aa",
	ghost: "#5e616c",
	inlayBg: "#1c1c22",
	inlayFg: "#8b8e98",
	stickyBg: "#141418",
	stickyHover: "#1a1a20",
	listHover: "#1a1a20",
	listSelected: "#1c1c22",
	listSelectedInactive: "#141418",
	listFocus: "#1c2430",
	listDrop: "#1a2a38",
	paletteFocus: "#1c2430",
	quickInputBg: "#111113",
	peekBg: "#18181b",
	peekBorder: "#93c5fd",
	toastBg: "#18181b",
	toastBorder: "#27272a",
	minimapSlider: "rgba(255, 255, 255, 0.10)",
	minimapSliderHover: "rgba(255, 255, 255, 0.18)",
	scrollbar: "#27272a",
	scrollbarHover: "#3f3f46",
	diffAddBg: "rgba(110, 231, 183, 0.12)",
	diffDelBg: "rgba(248, 113, 113, 0.12)",
	diffAddGutter: "#6ee7b7",
	diffDelGutter: "#f87171",
	mergeCurrent: "#2d5c4c",
	mergeIncoming: "#1a2a38",
	mergeConflict: "#f87171",
	squiggleError: "#f87171",
	squiggleWarn: "#fbbf24",
	squiggleInfo: "#93c5fd",
	ansi: {
		black: "#18181b",
		red: "#f87171",
		green: "#6ee7b7",
		yellow: "#fbbf24",
		blue: "#93c5fd",
		magenta: "#e8b4c4",
		cyan: "#9ec0c8",
		white: "#e8e9ed",
		brightBlack: "#71717a",
		brightRed: "#fca5a5",
		brightGreen: "#a7f3d0",
		brightYellow: "#fde68a",
		brightBlue: "#bfdbfe",
		brightMagenta: "#f5d0dc",
		brightCyan: "#c2e7ee",
		brightWhite: "#fafafa"
	}
};
/** Cool chrome, more hue in tokens so keywords/strings/comments scan apart. */
var SYNTAX = {
	bg: EDITOR.bg,
	fg: EDITOR.fg,
	caret: EDITOR.caret,
	gutter: EDITOR.bg,
	gutterFg: EDITOR.gutterFg,
	activeLine: EDITOR.activeLine,
	selection: EDITOR.selection,
	match: EDITOR.wordWrite,
	keyword: "#6cb2ff",
	string: "#5ee0a8",
	fn: "#e8c27a",
	type: "#5bc6d4",
	comment: "#646770",
	number: "#c9ae86",
	property: "#b8bcc6",
	operator: "#8b8e98",
	tag: "#6cb2ff",
	invalid: EDITOR.danger
};
var UI_HINT = /\b(ui|css|html|layout|button|color|theme|preview|design|spacing|font|header|sidebar|panel|style|palette|tab|modal|dialog|chrome)\b/i;
function isUiTask(instruction) {
	return UI_HINT.test(instruction) || /preview\.(html|css)/i.test(instruction);
}
function collectCssTokens(files) {
	const out = /* @__PURE__ */ new Set();
	for (const [path, content] of Object.entries(files)) {
		if (!/\.(css|html?|tsx|jsx)$/i.test(path)) continue;
		for (const match of content.matchAll(/--([a-zA-Z][\w-]*)\s*:/g)) out.add(`--${match[1]}`);
		for (const match of content.matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) out.add(match[0].toLowerCase());
	}
	return [...out].slice(0, 24);
}
function collectClassNames(files) {
	const out = /* @__PURE__ */ new Set();
	for (const [path, content] of Object.entries(files)) {
		if (/\.css$/i.test(path)) for (const match of content.matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(match[1]);
		for (const match of content.matchAll(/class(?:Name)?=["'`]([^"'`]+)["'`]/g)) for (const name of match[1].split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(name)) out.add(name);
	}
	return [...out].slice(0, 40);
}
function collectComponents(files) {
	const out = [];
	for (const [path, content] of Object.entries(files)) {
		if (/\.html?$/i.test(path)) {
			out.push({
				path,
				name: path.split("/").pop() ?? path
			});
			continue;
		}
		if (!/\.(t|j)sx?$/.test(path)) continue;
		for (const match of content.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9]+)/g)) out.push({
			path,
			name: match[1]
		});
	}
	return out.slice(0, 24);
}
function nearestUiFiles(files, query, activePath, n = 3) {
	const q = query.toLowerCase();
	const comps = collectComponents(files);
	const dir = activePath ? activePath.split("/").slice(0, -1).join("/") : "";
	const scored = Object.keys(files).filter((path) => /\.(html?|css|tsx|jsx)$/i.test(path)).map((path) => {
		let score = 0;
		path.toLowerCase();
		if (path === activePath) score += 5;
		if (dir && path.startsWith(`${dir}/`)) score += 2;
		if (/\.html?$/i.test(path)) score += 2;
		if (/\.css$/i.test(path)) score += 1;
		const stem = (path.split("/").pop() ?? "").replace(/\.\w+$/, "");
		if (q.includes(stem.toLowerCase())) score += 4;
		for (const comp of comps) if (comp.path === path && q.includes(comp.name.toLowerCase())) score += 5;
		return {
			path,
			score
		};
	}).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
	const out = [];
	for (const row of scored) {
		if (row.score <= 0 && out.length >= n) continue;
		if (!out.includes(row.path)) out.push(row.path);
		if (out.length >= n) break;
	}
	return out.slice(0, n);
}
var HOST_TOKENS = [
	`bg ${EDITOR.bg}`,
	`fg ${EDITOR.fg}`,
	`surface ${EDITOR.surface}`,
	`border ${EDITOR.border}`,
	`accent ${EDITOR.accent}`,
	`ok ${EDITOR.ok}`,
	`danger ${EDITOR.danger}`,
	`muted ${EDITOR.muted}`
];
function formatUiGraph(files, instruction, activePath) {
	if (!isUiTask(instruction)) return "";
	const tokens = collectCssTokens(files);
	const classes = collectClassNames(files);
	const nearest = nearestUiFiles(files, instruction, activePath, 3);
	const comps = collectComponents(files).filter((row) => nearest.includes(row.path)).slice(0, 8);
	return [
		"UI context (reuse these; do not invent a palette or new chrome classes):",
		`Host tokens: ${HOST_TOKENS.join(", ")}`,
		"Host chrome: Button TabBar classes bg-bg text-fg border-border bg-elevated text-subtle bg-accent",
		tokens.length ? `Repo tokens: ${tokens.join(", ")}` : "",
		classes.length ? `Repo classes: ${classes.slice(0, 24).join(", ")}` : "",
		comps.length ? `Components: ${comps.map((c) => `${c.name} @ ${c.path}`).join("; ")}` : "",
		nearest.length ? `Nearest UI files: ${nearest.join(", ")}` : ""
	].filter(Boolean).join("\n");
}
var TURN_CLIP = 1200;
var MEMORY_CLIP = 2400;
var LOOP_BUDGET = 48e3;
function clipText(text, n) {
	const t = text.trim();
	if (t.length <= n) return t;
	return `${t.slice(0, n)}\n…`;
}
function oneLine(text, n = 140) {
	return text.replace(/\s+/g, " ").trim().slice(0, n);
}
function summarizeTurn(message) {
	if (message.role === "user") return `- User: ${oneLine(message.content)}`;
	const edits = message.edits ?? [];
	const applied = [...new Set(edits.filter((e) => e.status === "applied").map((e) => e.path))];
	const pending = [...new Set(edits.filter((e) => e.status === "pending").map((e) => e.path))];
	const open = (message.plan ?? []).filter((p) => p.status !== "completed").map((p) => p.content);
	const bits = [];
	if (applied.length) bits.push(`applied ${applied.slice(0, 4).join(", ")}`);
	if (pending.length) bits.push(`pending ${pending.slice(0, 4).join(", ")}`);
	if (open.length) bits.push(`open: ${open.slice(0, 2).join("; ")}`);
	return `- Agent: ${oneLine(message.content, 80) || "(no recap)"}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
}
function priorMessages(messages, instruction) {
	const usable = messages.filter((m) => m.content.trim().length > 0 || (m.edits?.length ?? 0) > 0 || (m.plan?.length ?? 0) > 0);
	const last = usable[usable.length - 1];
	if (last?.role === "user" && instruction.trim().startsWith(last.content.trim())) return usable.slice(0, -1);
	return usable;
}
function compactHistory(messages, keep = 4) {
	const clipped = messages.map((m) => ({
		role: m.role,
		content: clipText(m.content, TURN_CLIP)
	}));
	const chars = clipped.reduce((n, m) => n + m.content.length, 0);
	if (messages.length <= keep + 2 && chars <= 8e3) return {
		history: clipped,
		compacted: 0
	};
	const head = messages.slice(0, Math.max(0, messages.length - keep));
	const tail = messages.slice(-keep);
	if (head.length === 0) return {
		history: clipped,
		compacted: 0
	};
	return {
		history: [
			{
				role: "user",
				content: clipText([`Thread memory (${head.length} earlier turns; continue from here):`, ...head.map(summarizeTurn)].join("\n"), MEMORY_CLIP)
			},
			{
				role: "assistant",
				content: "Noted. I'll use the thread memory and continue from the latest turns."
			},
			...tail.map((m) => ({
				role: m.role,
				content: clipText(m.content, TURN_CLIP)
			}))
		],
		compacted: head.length
	};
}
function totalChars(messages) {
	return messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
}
/** Shrink stale tool dumps so later steps stay inside the window. Keeps the last two tool results intact. */
function compactLoopMessages(messages, budget = LOOP_BUDGET) {
	if (totalChars(messages) <= budget) return messages;
	const next = messages.map((m) => ({ ...m }));
	const toolIdx = [];
	for (let i = 0; i < next.length; i++) if (next[i].role === "tool") toolIdx.push(i);
	const preserve = new Set(toolIdx.slice(-2));
	for (const i of toolIdx) {
		if (preserve.has(i)) continue;
		const content = next[i].content ?? "";
		if (content.length > 400) next[i] = {
			...next[i],
			content: `${content.slice(0, 400)}\n…`
		};
	}
	if (totalChars(next) <= budget) return next;
	const lastKeep = Math.max(2, next.length - 4);
	for (let i = 2; i < lastKeep; i++) {
		const row = next[i];
		if (row.role !== "assistant") continue;
		const content = row.content ?? "";
		if (content.length > 220) next[i] = {
			...row,
			content: `${content.slice(0, 220)}\n…`
		};
	}
	return next;
}
var STACK_START = "<!-- aperture:stack -->";
var STACK_END = "<!-- /aperture:stack -->";
function parsePkg(files) {
	const raw = files["package.json"];
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
function extractStack(files, name) {
	const pkg = parsePkg(files);
	const paths = Object.keys(files);
	const deps = {
		...pkg?.dependencies ?? {},
		...pkg?.devDependencies ?? {}
	};
	const depNames = Object.keys(deps);
	const runtime = [];
	const has = (re) => paths.some((p) => re.test(p));
	const blob = Object.values(files).join("\n");
	if (depNames.includes("react") || has(/\.tsx$/)) runtime.push("React");
	if (files["tsconfig.json"] || has(/\.tsx?$/)) runtime.push("TypeScript");
	if (has(/\.py$/)) runtime.push("Python");
	if (depNames.includes("next")) runtime.push("Next.js");
	if (blob.includes("node:http") || blob.includes("createServer(")) runtime.push("Node HTTP");
	if (has(/\.html?$/)) runtime.push("HTML");
	if (has(/\.css$/)) runtime.push("CSS");
	if (pkg?.type === "module") runtime.push("ESM");
	const dirs = [...new Set(paths.map((p) => p.split("/")[0]).filter((top) => paths.some((p) => p.startsWith(`${top}/`))).map((d) => `${d}/`))].sort();
	const entries = [
		"src/index.ts",
		"src/index.tsx",
		"src/main.ts",
		"src/main.tsx",
		"src/router.ts",
		"src/store.ts",
		"index.html",
		"preview.html",
		"preview.css"
	].filter((p) => files[p] !== void 0);
	return {
		name: (name || pkg?.name || "").trim(),
		runtime: [...new Set(runtime)].slice(0, 8),
		deps: depNames.filter((d) => !d.startsWith("@types/")).slice(0, 12),
		layout: [...dirs.slice(0, 8), ...entries.slice(0, 6)],
		scripts: Object.keys(pkg?.scripts ?? {}).slice(0, 8),
		components: collectComponents(files).slice(0, 12).map((c) => `${c.name} @ ${c.path}`),
		tokens: collectCssTokens(files).slice(0, 16)
	};
}
function formatStackBody(stack) {
	return [
		stack.name ? `- Project: ${stack.name}` : "",
		stack.runtime.length ? `- Runtime: ${stack.runtime.join(", ")}` : "",
		`- Deps: ${stack.deps.length ? stack.deps.join(", ") : "none"}`,
		stack.layout.length ? `- Layout: ${stack.layout.join(", ")}` : "",
		stack.scripts.length ? `- Scripts: ${stack.scripts.join(", ")}` : "",
		stack.components.length ? `- Components: ${stack.components.join("; ")}` : "",
		stack.tokens.length ? `- Tokens: ${stack.tokens.join(", ")}` : "",
		"- Reuse this stack. Do not invent a palette or add dependencies."
	].filter(Boolean).join("\n");
}
function escapeRe(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function mergeStackSection(text, body) {
	const block = `${STACK_START}\n${body.trim()}\n${STACK_END}`;
	if (text.includes("<!-- aperture:stack -->") && text.includes("<!-- /aperture:stack -->")) return text.replace(new RegExp(`${escapeRe(STACK_START)}[\\s\\S]*?${escapeRe(STACK_END)}`), block);
	if (/^##\s+Stack\s*$/m.test(text)) return text.replace(/^##\s+Stack\s*\n[\s\S]*?(?=\n##\s|\s*$)/m, `## Stack\n${block}\n`);
	return `${text.trimEnd()}\n\n## Stack\n${block}\n`;
}
function applyStackMemory(files, name) {
	const found = findRules(files);
	if (!found) return files;
	const next = mergeStackSection(found.text, formatStackBody(extractStack(files, name)));
	if (next === found.text) return files;
	return {
		...files,
		[found.path]: next
	};
}
function formatStackContext(files, name) {
	return `Stack memory (reuse; do not invent a palette or extra deps):\n${formatStackBody(extractStack(files, name))}`;
}
//#endregion
export { mentionQuery as A, hunksFromDiff as C, languageLabel as D, languageFromPath as E, previewNotesForEdit as F, priorMessages as I, semanticSearch as L, nearestUiFiles as M, parseMentions as N, lineDiff as O, previewIssues as P, hunkLines as S, isUiTask as T, formatAutoContext as _, activeMention as a, formatUiGraph as b, autoContextPaths as c, diffStats as d, dropHunk as f, findRules as g, filterMentions as h, SYNTAX as i, mergeStackSection as j, mentionItems as k, compactHistory as l, extractStack as m, EDITOR as n, applySearchReplace as o, expandMentions as p, RULE_CANDIDATES as r, applyStackMemory as s, DEFAULT_RULES as t, compactLoopMessages as u, formatStackBody as v, indexFiles as w, grepFiles as x, formatStackContext as y };
