/** OpenAI-compatible endpoints. Local ones are http on loopback; everything else is https. */
export type CustomPreset = {
  id: "ollama" | "lmstudio" | "openrouter";
  label: string;
  base: string;
  model: string;
  needsKey: boolean;
};

export const CUSTOM_PRESETS: readonly CustomPreset[] = [
  {
    id: "ollama",
    label: "Ollama",
    base: "http://127.0.0.1:11434/v1",
    model: "llama3.1",
    needsKey: false,
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    base: "http://127.0.0.1:1234/v1",
    model: "local-model",
    needsKey: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    needsKey: true,
  },
];

/** True for addresses a server must not call on a user's behalf. */
export function isPrivateAddress(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal")) {
    return true;
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  if (v4) {
    const n = v4.slice(1).map(Number);
    if (n.some((p) => p > 255)) return true;
    const [a, b] = n;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (name.includes(":")) {
    const v6 = name.split("%")[0] ?? name;
    if (v6 === "::" || v6 === "::1") return true;
    if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")) return true;
    if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  }
  return false;
}

/**
 * A base URL we will POST `/chat/completions` to.
 * http is only loopback (Ollama, LM Studio). https must not be a private address.
 */
export function normalizeCustomBase(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol === "http:") {
    if (!loopback) return null;
  } else if (url.protocol !== "https:") {
    return null;
  } else if (isPrivateAddress(host)) {
    return null;
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) path = path.slice(0, -"/chat/completions".length);
  return `${url.protocol}//${url.host}${path}`;
}

/** Model ids, including OpenRouter's `vendor/name` form. */
export function cleanCustomModel(raw: string): string | null {
  const model = raw.trim();
  if (!model || model.length > 80) return null;
  if (!/^[A-Za-z0-9_.:@+/-]+$/.test(model)) return null;
  return model;
}
