import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/redact-Ckw8E-v4.js
var redact_Ckw8E_v4_exports = /* @__PURE__ */ __exportAll({
	a: () => sanitizeFileMap,
	i: () => safeRelPath,
	n: () => redactSecrets,
	r: () => redact_exports,
	t: () => isSecretPath
});
var redact_exports = /* @__PURE__ */ __exportAll$1({
	isSecretPath: () => isSecretPath,
	redactSecrets: () => redactSecrets,
	safeRelPath: () => safeRelPath,
	sanitizeFileMap: () => sanitizeFileMap
});
/** Shared guards: secret-looking paths and tokens never go to Composer. */
var SKIP_SECRET_FILES = /* @__PURE__ */ new Set([
	".env",
	".env.local",
	".env.production",
	".env.development",
	".env.staging",
	".netrc",
	".npmrc",
	".pypirc",
	"id_rsa",
	"id_dsa",
	"id_ecdsa",
	"id_ed25519",
	"credentials.json",
	"service-account.json",
	".bash_history",
	".zsh_history",
	"wallet.dat"
]);
var SKIP_SECRET_EXT = /* @__PURE__ */ new Set([
	"pem",
	"p12",
	"pfx",
	"key",
	"kdbx",
	"jks",
	"keystore",
	"ovpn"
]);
var SECRET_LINE = /(?:api[_-]?key|auth(?:orization|token)?|secret|passwd|password|private[_-]?key|access[_-]?token|client[_-]?secret|npm[_-]?token)\s*[:=]\s*\S+/gi;
var KEY_LIKE = /\b(sk-[A-Za-z0-9_\-]{16,}|sk-ant-[A-Za-z0-9_\-]{16,}|sk-proj-[A-Za-z0-9_\-]{16,}|xai-[A-Za-z0-9_\-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_\-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/g;
var PEM_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
function safeRelPath(path) {
	const n = path.replace(/\\/g, "/").replace(/^\//, "").replace(/\0/g, "");
	if (!n || n.length > 240) return null;
	const parts = n.split("/").filter((p) => p && p !== ".");
	if (parts.length === 0) return null;
	if (parts.some((p) => p === ".." || p === "~")) return null;
	return parts.join("/");
}
function isSecretPath(path) {
	const safe = safeRelPath(path);
	if (!safe) return true;
	const base = (safe.split("/").pop() ?? safe).toLowerCase();
	if (SKIP_SECRET_FILES.has(base)) return true;
	if (base.startsWith(".env") && base !== ".env.example") return true;
	if (base.includes("service-account") && base.endsWith(".json")) return true;
	const dot = base.lastIndexOf(".");
	const ext = dot >= 0 ? base.slice(dot + 1) : "";
	return SKIP_SECRET_EXT.has(ext);
}
function redactSecrets(text) {
	if (!text) return text;
	return text.replace(PEM_BLOCK, "[redacted private key]").replace(SECRET_LINE, (full) => {
		const cut = full.search(/[:=]/);
		if (cut < 0) return "[redacted]";
		return `${full.slice(0, cut + 1)} [redacted]`;
	}).replace(KEY_LIKE, "[redacted]");
}
function sanitizeFileMap(files) {
	const out = {};
	for (const [path, content] of Object.entries(files)) {
		const safe = safeRelPath(path);
		if (!safe || isSecretPath(safe)) continue;
		out[safe] = redactSecrets(typeof content === "string" ? content : "");
	}
	return out;
}
//#endregion
export { sanitizeFileMap as a, safeRelPath as i, redactSecrets as n, redact_Ckw8E_v4_exports as r, isSecretPath as t };
