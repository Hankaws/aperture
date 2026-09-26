export const EMBED_DIM = 256;

const CAMEL = /([a-z0-9])([A-Z])/g;
/** Underscores split too: `api_key` and `apiKey` should both reach "api" and "key". */
const NON_TOKEN = /[^a-z0-9]+/g;

/**
 * Words that carry no signal in a question or in code.
 *
 * "where", "how" and "does" are how people phrase a search, not what they are
 * searching for; "from", "if" and "return" are on nearly every line of code.
 * Left in, they reward long files for being long.
 */
const STOP = new Set(
  (
    "the an and or of to in on at for with by from is are be been it its this that " +
    "these those which what where when how why does do did can may should would will " +
    "my our your their we you they he she not no into than then so if as there here " +
    "each any all some one also only just about before after while use using used " +
    "const let var function return import export default new true false null undefined " +
    "type interface async await else case break"
  ).split(" "),
);

/**
 * Fold common inflections onto one stem: keys/key, plans/plan, saved/save.
 *
 * Deliberately crude. It runs on both the query and the code, so it only needs
 * to be consistent, not linguistically right — "typing" and "type" landing on
 * the same stem matters; whether that stem is a real word does not.
 *
 * Known cost: distinct meanings sometimes share a stem. "settings" reduces to
 * "set", so a question about the settings page also matches every setter call.
 * IDF is what contains it — "set" is on so many chunks that it earns almost no
 * weight, which makes "settings" nearly useless as a search term rather than
 * actively misleading. Not special-cased: an exception list tuned to the words
 * one happens to notice is how a stemmer gets fitted to its own benchmark.
 */
export function stem(token: string): string {
  let t = token;
  if (t.length <= 3) return t;
  if (/ie[sd]$/.test(t) && t.length > 4) t = `${t.slice(0, -3)}y`;
  else if (/(ss|us|is)$/.test(t)) {
    // class, status, analysis: the s is not a plural
  } else if (/(sh|ch|x|z)es$/.test(t)) t = t.slice(0, -2);
  else if (t.endsWith("s")) t = t.slice(0, -1);
  if (t.endsWith("ing") && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith("ed") && t.length > 4) t = t.slice(0, -2);
  // running -> runn -> run; the doubled consonant is inflection, not stem
  if (/([bdgmnprt])\1$/.test(t)) t = t.slice(0, -1);
  if (t.endsWith("e") && t.length > 3) t = t.slice(0, -1);
  return t;
}

export function tokenize(text: string): string[] {
  const lowered = text.replace(CAMEL, "$1 $2").toLowerCase();
  const out: string[] = [];
  for (const raw of lowered.split(NON_TOKEN)) {
    if (raw.length < 2 || raw.length > 40 || STOP.has(raw)) continue;
    // Pure numbers are line numbers, sizes and versions: noise to a search.
    if (/^\d+$/.test(raw)) continue;
    out.push(stem(raw));
  }
  return out;
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
