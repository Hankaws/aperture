/** Shared guards: secret-looking paths and tokens never go to Composer. */

const SKIP_SECRET_FILES = new Set([
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
  "wallet.dat",
]);

const SKIP_SECRET_EXT = new Set(["pem", "p12", "pfx", "key", "kdbx", "jks", "keystore", "ovpn"]);

const SECRET_LINE =
  /(?:api[_-]?key|auth(?:orization|token)?|secret|passwd|password|private[_-]?key|access[_-]?token|client[_-]?secret|npm[_-]?token)\s*[:=]\s*\S+/gi;

const KEY_LIKE =
  /\b(sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|sk-proj-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/g;

const PEM_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

export function safeRelPath(path: string): string | null {
  const n = path.replace(/\\/g, "/").replace(/^\//, "").replace(/\0/g, "");
  if (!n || n.length > 240) return null;
  const parts = n.split("/").filter((p) => p && p !== ".");
  if (parts.length === 0) return null;
  if (parts.some((p) => p === ".." || p === "~")) return null;
  return parts.join("/");
}

export function isSecretPath(path: string): boolean {
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

export function redactSecrets(text: string): string {
  if (!text) return text;
  return text
    .replace(PEM_BLOCK, "[redacted private key]")
    .replace(SECRET_LINE, (full) => {
      const cut = full.search(/[:=]/);
      if (cut < 0) return "[redacted]";
      return `${full.slice(0, cut + 1)} [redacted]`;
    })
    .replace(KEY_LIKE, "[redacted]");
}

export function sanitizeFileMap(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const safe = safeRelPath(path);
    if (!safe || isSecretPath(safe)) continue;
    out[safe] = redactSecrets(typeof content === "string" ? content : "");
  }
  return out;
}
