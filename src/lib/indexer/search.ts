import { chunkSource } from "@/lib/parser/chunk";
import { buildIdf, cosine, embedTokens, tokenize } from "./embed";
import type { IndexedChunk } from "@/lib/workspace/types";

const K1 = 1.2;
const B = 0.75;

export function indexFiles(files: Record<string, string>): IndexedChunk[] {
  const raw: Array<Omit<IndexedChunk, "embedding" | "tokens"> & { tokens: string[] }> = [];
  for (const [path, content] of Object.entries(files)) {
    const chunks = chunkSource(path, content);
    chunks.forEach((chunk, i) => {
      raw.push({
        id: `${path}#${i}:${chunk.name}`,
        path,
        ...chunk,
        tokens: tokenize(`${path} ${chunk.name} ${chunk.text}`),
      });
    });
  }
  const idf = buildIdf(raw.map((c) => c.tokens));
  return raw.map((chunk) => ({
    ...chunk,
    embedding: embedTokens(chunk.tokens, idf),
  }));
}

function bm25(queryTokens: string[], docTokens: string[], avgLen: number): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const dl = docTokens.length;
  let score = 0;
  const uniq = [...new Set(queryTokens)];
  for (const q of uniq) {
    const f = tf.get(q) ?? 0;
    if (f === 0) continue;
    const denom = f + K1 * (1 - B + B * (dl / Math.max(avgLen, 1)));
    score += ((f * (K1 + 1)) / denom);
  }
  return score;
}

export type SearchHit = {
  chunk: IndexedChunk;
  score: number;
  cosine: number;
  keyword: number;
};

export function semanticSearch(
  chunks: IndexedChunk[],
  query: string,
  limit = 8,
): SearchHit[] {
  const qTokens = tokenize(query);
  if (chunks.length === 0 || qTokens.length === 0) return [];
  const idf = buildIdf([qTokens, ...chunks.map((c) => c.tokens)]);
  const qVec = embedTokens(qTokens, idf);
  const avgLen = chunks.reduce((s, c) => s + c.tokens.length, 0) / chunks.length;
  const keywordScores = chunks.map((c) => bm25(qTokens, c.tokens, avgLen));
  const maxKw = Math.max(0.0001, ...keywordScores);

  const hits: SearchHit[] = chunks.map((chunk, i) => {
    const c = cosine(qVec, chunk.embedding);
    const kw = keywordScores[i]! / maxKw;
    return { chunk, cosine: c, keyword: kw, score: 0.58 * c + 0.42 * kw };
  });

  hits.sort((a, b) => b.score - a.score);
  return hits.filter((h) => h.score > 0.02).slice(0, limit);
}

export function grepFiles(
  files: Record<string, string>,
  pattern: string,
  maxHits = 40,
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
  for (const [path, content] of Object.entries(files)) {
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
