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

/**
 * A name that holds a secret, also inside a longer one (DB_PASSWORD, clientSecret,
 * STRIPE_SECRET_KEY), then `:` or `=` (never `==`, `===` or `=>`). A quoted name
 * counts only where an object key can stand, so `cond ? "new-password" : "x"` does not.
 */
const SECRET_NAME =
  String.raw`[\w$-]*(?:api[_-]?key|auth[_-]?token|authorization|secret|passwd|password|private[_-]?key|access[_-]?token|npm[_-]?token)[\w$-]*`;
const SECRET_KEY = new RegExp(
  String.raw`((?<![\w$-])${SECRET_NAME}|(?<=(?:^|[{,])\s*)(["'])${SECRET_NAME}\2)(\s*[:=](?![=>])\s*)`,
  "gim",
);
/** A quoted value: the secret is between the quotes, which stay so the line still parses. */
const QUOTED = /(["'`])((?:(?!\1)[^\n\\]|\\.)*)\1/y;
/** A bare value outside code: a run of characters, not a flag or a reference to another variable. */
const BARE =
  /(?!(?:true|false|null|none|undefined)\b|\[redacted)(?![$%]|process\.env|import\.meta|os\.environ)[^\s"'`,;)}\]]{6,}/iy;

/** A quoted value that reads as a sentence (a label, a message) or as an environment variable's name. */
const NOT_A_SECRET = /^(?:[^ ]* ){5,}|^[A-Z][A-Z0-9_]*$/;

/** Files where a bare value after `password =` is an expression, not the password. */
const CODE_EXT = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts", "vue", "svelte", "astro",
  "py", "go", "rb", "java", "kt", "rs", "php", "cs", "swift", "dart", "scala",
]);

function isCodePath(path: string | undefined): boolean {
  const base = path?.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 && CODE_EXT.has(base.slice(dot + 1).toLowerCase());
}

/** Replaces the value after each secret name: a quoted literal always, a bare one only outside code. */
function redactValues(text: string, code: boolean): string {
  let out = "";
  let last = 0;
  SECRET_KEY.lastIndex = 0;
  for (let match = SECRET_KEY.exec(text); match; match = SECRET_KEY.exec(text)) {
    const at = match.index + match[0].length;
    let end = -1;
    let replacement = "";
    QUOTED.lastIndex = at;
    const quoted = QUOTED.exec(text);
    if (quoted) {
      const value = quoted[2]!;
      if (value.trim().length >= 6 && !value.includes("${") && !NOT_A_SECRET.test(value)) {
        end = at + quoted[0].length;
        replacement = `${quoted[1]}[redacted]${quoted[1]}`;
      }
    } else if (!code) {
      BARE.lastIndex = at;
      const bare = BARE.exec(text);
      if (bare) {
        end = at + bare[0].length;
        replacement = "[redacted]";
      }
    }
    if (end < 0) continue;
    out += text.slice(last, at) + replacement;
    last = end;
    SECRET_KEY.lastIndex = end;
  }
  return out + text.slice(last);
}

const KEY_LIKE =
  /\b(sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|sk-proj-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+(?!\$\{)[A-Za-z0-9\-._~+/]{20,}=*)\b/g;

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

/**
 * Text with keys, tokens and passwords replaced by [redacted]. Pass the file's
 * path when there is one: in code, only quoted values are secrets.
 */
export function redactSecrets(text: string, path?: string): string {
  if (!text) return text;
  return redactValues(text.replace(PEM_BLOCK, "[redacted private key]"), isCodePath(path)).replace(
    KEY_LIKE,
    "[redacted]",
  );
}

export function sanitizeFileMap(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const safe = safeRelPath(path);
    if (!safe || isSecretPath(safe)) continue;
    out[safe] = redactSecrets(typeof content === "string" ? content : "", safe);
  }
  return out;
}
