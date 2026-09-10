import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-DTfuEt1f.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function isModEvent(e) {
	return e.metaKey || e.ctrlKey;
}
function modSymbol() {
	if (typeof navigator === "undefined") return "Ctrl";
	return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
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
function extOf(path) {
	const base = path.split("/").pop() ?? path;
	const dot = base.lastIndexOf(".");
	return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}
function basename(path) {
	return path.split("/").pop() ?? path;
}
//#endregion
export { isModEvent as a, fuzzyMatch as i, cn as n, modSymbol as o, extOf as r, basename as t };
