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

/** IPv4 embedded in an IPv4-mapped IPv6 address, including the hex form `::ffff:a9fe:a9fe`. */
function mappedV4(host: string): string | null {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (!name.startsWith("::ffff:")) return null;
  const rest = name.slice("::ffff:".length);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(rest)) return rest;
  const parts = rest.split(":");
  if (parts.length !== 2) return null;
  const hi = Number.parseInt(parts[0]!, 16);
  const lo = Number.parseInt(parts[1]!, 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi < 0 || lo < 0 || hi > 0xffff || lo > 0xffff) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function ipv4Parts(host: string): number[] | null {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return null;
  const n = v4.slice(1).map(Number);
  if (n.some((p) => p > 255)) return null;
  return n;
}

/** Cloud metadata and link-local. Never a place an agent or a model may call. */
export function isMetadataAddress(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (name === "metadata.google.internal" || name === "metadata.goog" || name.endsWith(".internal")) return true;
  if (name.startsWith("fe80:")) return true;
  const mapped = mappedV4(name);
  if (mapped) return isMetadataAddress(mapped);
  const n = ipv4Parts(name);
  return Boolean(n && n[0] === 169 && n[1] === 254);
}

/** True for addresses a server must not call on a user's behalf. */
export function isPrivateAddress(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal")) {
    return true;
  }
  const mapped = mappedV4(name);
  if (mapped) return isPrivateAddress(mapped);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name) && !ipv4Parts(name)) return true;
  const n = ipv4Parts(name);
  if (n) {
    const [a, b] = n;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (name.includes(":")) {
    if (name === "::" || name === "::1") return true;
    if (name.startsWith("fc") || name.startsWith("fd") || name.startsWith("fe80")) return true;
    return false;
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

/**
 * Whether a loopback base may be called. Loopback is the server's own
 * machine: Ollama on your laptop when you run Aperture there, but on a
 * shared deployment it reaches nobody's Ollama and only the server's own
 * local services. So it is on for local dev and off once deployed, unless
 * APERTURE_LOCAL_ENDPOINTS says otherwise.
 */
export function localEndpointsAllowed(env: Record<string, string | undefined>): boolean {
  if (env.APERTURE_LOCAL_ENDPOINTS === "1") return true;
  if (env.APERTURE_LOCAL_ENDPOINTS === "0") return false;
  return env.NODE_ENV !== "production" && !env.VERCEL;
}

export const LOCAL_ENDPOINTS_OFF =
  "Ollama and LM Studio only work when Aperture runs on your own machine. Use an https endpoint, " +
  "or set APERTURE_LOCAL_ENDPOINTS=1 on a server you run yourself.";

/** Model ids, including OpenRouter's `vendor/name` form. */
export function cleanCustomModel(raw: string): string | null {
  const model = raw.trim();
  if (!model || model.length > 80) return null;
  if (!/^[A-Za-z0-9_.:@+/-]+$/.test(model)) return null;
  return model;
}
