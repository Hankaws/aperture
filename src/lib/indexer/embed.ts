export const EMBED_DIM = 256;

const CAMEL = /([a-z0-9])([A-Z])/g;
const NON_TOKEN = /[^a-z0-9_]+/g;

export function tokenize(text: string): string[] {
  const lowered = text.replace(CAMEL, "$1 $2").toLowerCase();
  return lowered
    .split(NON_TOKEN)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 40);
}

function murmurish(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildIdf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const n = Math.max(1, docs.length);
  for (const tokens of docs) {
    const uniq = new Set(tokens);
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log((n + 1) / (count + 0.5)));
  }
  return idf;
}

export function embedTokens(tokens: string[], idf: Map<string, number>): number[] {
  const vec = new Float32Array(EMBED_DIM);
  if (tokens.length === 0) return Array.from(vec);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [token, count] of tf) {
    const weight = (count / tokens.length) * (idf.get(token) ?? 1);
    const a = murmurish(token) % EMBED_DIM;
    const b = murmurish(`${token}#`) % EMBED_DIM;
    vec[a] += weight;
    vec[b] += weight * 0.5;
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) out[i] = vec[i]! / norm;
  return out;
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i]! * b[i]!;
  return sum;
}
