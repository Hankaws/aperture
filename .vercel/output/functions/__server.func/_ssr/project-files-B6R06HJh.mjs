import { o as __toESM } from "../_runtime.mjs";
import { i as safeRelPath, t as isSecretPath } from "./redact-Ckw8E-v4.mjs";
import { r as extOf } from "./utils-DTfuEt1f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/project-files-B6R06HJh.js
var MAX_ZIP_BYTES = 8e6;
var SKIP_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"coverage",
	"vendor",
	"__pycache__",
	".turbo",
	".vercel",
	".cache",
	"out",
	".output",
	"target",
	".pnpm-store",
	"Pods",
	".idea",
	".vscode"
]);
var SKIP_EXT = /* @__PURE__ */ new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"ico",
	"bmp",
	"mp4",
	"webm",
	"mov",
	"mp3",
	"wav",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
	"pdf",
	"zip",
	"gz",
	"tgz",
	"wasm",
	"exe",
	"dll",
	"so",
	"dylib",
	"bin",
	"lockb",
	"psd",
	"sqlite",
	"db",
	"parquet"
]);
var KEEP_HIDDEN = /* @__PURE__ */ new Set([
	".aperture.md",
	".cursorrules",
	".gitignore",
	".env.example",
	".editorconfig",
	".eslintrc",
	".eslintrc.cjs",
	".eslintrc.json",
	".prettierrc",
	".prettierrc.json"
]);
var KEEP_HIDDEN_DIRS = /* @__PURE__ */ new Set([".cursor"]);
function skipPath(path) {
	const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (SKIP_DIRS.has(part)) return true;
		const last = i === parts.length - 1;
		if (part.startsWith(".")) {
			if (!last) {
				if (KEEP_HIDDEN_DIRS.has(part)) continue;
				return true;
			}
			if (part === ".DS_Store" || part.startsWith(".env") && part !== ".env.example") return true;
			if (KEEP_HIDDEN.has(part)) continue;
			if (!/^\.(eslint|prettier|nvmrc|tool-versions)/.test(part)) return true;
		}
	}
	return SKIP_EXT.has(extOf(path));
}
function isProbablyBinary(bytes) {
	const n = Math.min(bytes.length, 800);
	let weird = 0;
	for (let i = 0; i < n; i++) {
		const b = bytes[i];
		if (b === 0) return true;
		if (b < 8 || b > 13 && b < 32 && b !== 27) weird += 1;
	}
	return n > 0 && weird / n > .3;
}
function decodeUtf8(bytes) {
	try {
		const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
		if (text.includes("�") && bytes.length > 40) {
			if ((text.match(/\uFFFD/g) ?? []).length > 8) return null;
		}
		return text.replace(/\r\n/g, "\n");
	} catch {
		return null;
	}
}
function stripCommonRoot(paths) {
	if (paths.length === 0) return {
		cut: (p) => p,
		root: ""
	};
	const first = paths[0].split("/").filter(Boolean)[0];
	if (!first) return {
		cut: (p) => p,
		root: ""
	};
	if (!paths.every((p) => p === first || p.startsWith(`${first}/`))) return {
		cut: (p) => p,
		root: ""
	};
	return {
		root: first,
		cut: (p) => p.startsWith(`${first}/`) ? p.slice(first.length + 1) : p === first ? "" : p
	};
}
function assembleImport(entries, fallbackName = "workspace") {
	const normalized = entries.map((e) => ({
		...e,
		path: e.path.replace(/\\/g, "/").replace(/^\//, "")
	})).filter((e) => e.path && !e.path.endsWith("/"));
	const { cut, root } = stripCommonRoot(normalized.map((e) => e.path));
	const files = {};
	let skipped = 0;
	let truncated = false;
	let total = 0;
	for (const entry of normalized) {
		const path = safeRelPath(cut(entry.path));
		if (!path) {
			skipped += 1;
			continue;
		}
		if (skipPath(path) || isSecretPath(path)) {
			skipped += 1;
			continue;
		}
		if (files[path]) continue;
		if (Object.keys(files).length >= 160) {
			truncated = true;
			skipped += 1;
			continue;
		}
		if (entry.bytes.byteLength > 2e5) {
			skipped += 1;
			continue;
		}
		if (total + entry.bytes.byteLength > 25e5) {
			truncated = true;
			skipped += 1;
			continue;
		}
		if (isProbablyBinary(entry.bytes)) {
			skipped += 1;
			continue;
		}
		const text = decodeUtf8(entry.bytes);
		if (text === null) {
			skipped += 1;
			continue;
		}
		files[path] = text;
		total += entry.bytes.byteLength;
	}
	return {
		name: fallbackName || root || "workspace",
		files,
		skipped,
		truncated
	};
}
async function filesFromZipBuffer(buf, fallbackName = "workspace") {
	if (buf.byteLength > 8e6) return {
		name: fallbackName,
		files: {},
		skipped: 0,
		truncated: true
	};
	const zip = await (await import("../_libs/jszip+[...].mjs").then((n) => /* @__PURE__ */ __toESM(n.t()))).default.loadAsync(buf);
	const packed = [];
	const names = Object.keys(zip.files);
	for (const relativePath of names) {
		const file = zip.files[relativePath];
		if (!file || file.dir) continue;
		const bytes = await file.async("uint8array");
		packed.push({
			path: relativePath,
			bytes
		});
	}
	return assembleImport(packed, fallbackName);
}
//#endregion
export { assembleImport as n, filesFromZipBuffer as r, MAX_ZIP_BYTES as t };
