import { chunkSource } from "../parser/chunk.ts";
import { buildIdf, cosine, embedTokens, tokenize } from "./embed.ts";
import type { IndexedChunk } from "@/lib/workspace/types";

const K1 = 1.2;
const B = 0.75;

type RawChunk = Omit<IndexedChunk, "embedding">;

/**
 * Chunks and tokens per file, reused while the file is unchanged.
 *
 * Chunking and tokenizing are ~78% of indexing and depend on one file alone,
 * yet every edit recomputed them for the whole workspace. Only the corpus-wide
 * half — IDF and the hashed vectors — genuinely needs redoing when one file
 * changes, so ranking is identical to a cold build.
 *
 * Safe to share across callers on a server: an entry is served only when the
 * caller passes content identical to what produced it, so it can never return
 * anything the caller did not already hold. Bounded by content size, because a
 * warm instance would otherwise retain every workspace it ever indexed.
 */
const fileCache = new Map<string, { content: string; chunks: RawChunk[] }>();
let cachedBytes = 0;
export const INDEX_CACHE_BYTES = 8_000_000;

function evict(path: string) {
  const entry = fileCache.get(path);
  if (!entry) return;
  cachedBytes -= entry.content.length;
  fileCache.delete(path);
}

function fileChunks(path: string, content: string): RawChunk[] {
  const hit = fileCache.get(path);
  if (hit && hit.content === content) {
    // Re-insert so Map order tracks recency, making the eviction below LRU.
    fileCache.delete(path);
    fileCache.set(path, hit);
    return hit.chunks;
  }
  const chunks = chunkSource(path, content).map((chunk, i) => ({
    id: `${path}#${i}:${chunk.name}`,
    path,
    ...chunk,
    tokens: tokenize(`${path} ${chunk.name} ${chunk.text}`),
  }));
  evict(path);
  if (content.length <= INDEX_CACHE_BYTES) {
    fileCache.set(path, { content, chunks });
    cachedBytes += content.length;
    for (const oldest of fileCache.keys()) {
      if (cachedBytes <= INDEX_CACHE_BYTES) break;
      evict(oldest);
    }
  }
  return chunks;
}

/** For tests: start from a cold cache. */
export function clearIndexCache() {
  fileCache.clear();
  cachedBytes = 0;
}

export function indexCacheStats() {
  return { files: fileCache.size, bytes: cachedBytes };
}

export function indexFiles(files: Record<string, string>): IndexedChunk[] {
  const raw: RawChunk[] = [];
  for (const [path, content] of Object.entries(files)) raw.push(...fileChunks(path, content));
  const idf = buildIdf(raw.map((c) => c.tokens));
  return raw.map((chunk) => ({ ...chunk, embedding: embedTokens(chunk.tokens, idf) }));
}

type CorpusStats = { idf: Map<string, number>; avgLen: number };

/**
 * Corpus statistics, computed once per index rather than once per query.
 *
 * Keyed by the chunk array itself: a new index is a new array, so a stale entry
 * can never be served, and the WeakMap lets it go with the index.
 */
const statsCache = new WeakMap<IndexedChunk[], CorpusStats>();

function corpusStats(chunks: IndexedChunk[]): CorpusStats {
  const cached = statsCache.get(chunks);
  if (cached) return cached;
  const stats = {
    idf: buildIdf(chunks.map((c) => c.tokens)),
    avgLen: chunks.reduce((s, c) => s + c.tokens.length, 0) / Math.max(1, chunks.length),
  };
  statsCache.set(chunks, stats);
  return stats;
}

/**
 * Okapi BM25.
 *
 * The inverse-document-frequency weight is what makes this BM25 rather than
 * saturated term counting, and it was missing: every matching word scored the
 * same whether it appeared in two chunks or two thousand, so long generic files
 * won by sheer volume of common words.
 */
export function bm25(queryTokens: string[], docTokens: string[], stats: CorpusStats): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const dl = docTokens.length;
  let score = 0;
  for (const q of new Set(queryTokens)) {
    const f = tf.get(q) ?? 0;
    if (f === 0) continue;
    const denom = f + K1 * (1 - B + B * (dl / Math.max(stats.avgLen, 1)));
    score += (stats.idf.get(q) ?? 0) * ((f * (K1 + 1)) / denom);
  }
  return score;
}

export type SearchHit = {
  chunk: IndexedChunk;
  score: number;
  cosine: number;
  keyword: number;
};

/**
 * How much of a hit's score comes from BM25 rather than the hashed vector.
 *
 * Measured, not assumed: the hashed vector alone put the right file in front of
 * the agent for 28% of benchmark questions, BM25 for 61%, and this blend for
 * 67%. The vector is kept because a real embedding will occupy the same slot,
 * at which point this weight should be measured again rather than trusted.
 */
export const KEYWORD_WEIGHT = 0.75;

/** Most chunks one file may contribute to a result list. Measured; see the benchmark. */
export const PER_FILE = 2;

export function semanticSearch(
  chunks: IndexedChunk[],
  query: string,
  limit = 8,
  perFile = PER_FILE,
): SearchHit[] {
  const qTokens = tokenize(query);
  if (chunks.length === 0 || qTokens.length === 0) return [];
  const stats = corpusStats(chunks);
  const qVec = embedTokens(qTokens, stats.idf);
  const keywordScores = chunks.map((c) => bm25(qTokens, c.tokens, stats));
  const maxKw = Math.max(0.0001, ...keywordScores);

  const hits: SearchHit[] = chunks.map((chunk, i) => {
    const c = cosine(qVec, chunk.embedding);
    const kw = keywordScores[i]! / maxKw;
    return { chunk, cosine: c, keyword: kw, score: KEYWORD_WEIGHT * kw + (1 - KEYWORD_WEIGHT) * c };
  });

  hits.sort((a, b) => b.score - a.score);
  // Cap each file's share of the results, so `limit` chunks span more files:
  // on the benchmark, 4.8 distinct files per query uncapped, 5.7 at two per
  // file. It did NOT change whether the answering file was shown — the misses
  // were files ranking too low, not files crowded out — so this buys breadth,
  // not recall. Order is preserved, so a file's rank is unchanged.
  const out: SearchHit[] = [];
  const perPath = new Map<string, number>();
  for (const hit of hits) {
    if (hit.score <= 0.02) break;
    const seen = perPath.get(hit.chunk.path) ?? 0;
    if (seen >= perFile) continue;
    perPath.set(hit.chunk.path, seen + 1);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export function grepFiles(
  files: Record<string, string>,
  pattern: string,
  maxHits = 40,
  pathPrefix?: string,
): Array<{ path: string; line: number; text: string }> {
  const hits: Array<{ path: string; line: number; text: string }> = [];
  let regex: RegExp | null = null;
  const raw = pattern.slice(0, 80);
  const nested = /([+*?]|\{\d+,?\d*\})[+*?{]/.test(raw) || /\(\?/.test(raw) || raw.length === 0;
  if (!nested) {
    try {
      regex = new RegExp(raw, "i");
    } catch {
      regex = null;
    }
  }
  const prefix = pathPrefix?.trim() ?? "";
  for (const [path, content] of Object.entries(files)) {
    if (prefix && path !== prefix && !path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) && !path.endsWith(`/${prefix}`)) {
      continue;
    }
    const lines = content.split("\n");
    lines.forEach((text, i) => {
      if (hits.length >= maxHits) return;
      const ok = regex ? regex.test(text) : text.toLowerCase().includes(raw.toLowerCase());
      if (ok) hits.push({ path, line: i + 1, text: text.slice(0, 240) });
    });
    if (hits.length >= maxHits) break;
  }
  return hits;
}
