import { EditorState } from "@codemirror/state";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { ChunkKind, IndexedChunk } from "../workspace/types.ts";

const KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "let",
  "new",
  "null",
  "return",
  "static",
  "switch",
  "this",
  "true",
  "try",
  "type",
  "undefined",
  "var",
  "void",
  "while",
]);

export type SymbolHit = {
  name: string;
  kind: ChunkKind | "identifier";
  path: string;
};

export function identifiersIn(doc: string, cap = 80): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\b[A-Za-z_][\w]{1,}\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(doc))) {
    const name = match[0]!;
    if (KEYWORDS.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= cap) break;
  }
  return out;
}

export function collectSymbols(chunks: IndexedChunk[], activePath: string | null, doc = ""): SymbolHit[] {
  const hits: SymbolHit[] = [];
  const seen = new Set<string>();
  const add = (hit: SymbolHit) => {
    const key = `${hit.path}:${hit.name}`;
    if (!hit.name || seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };
  for (const name of identifiersIn(doc)) add({ name, kind: "identifier", path: activePath ?? "" });
  for (const chunk of chunks) {
    if (chunk.name === "module" || chunk.kind === "block") continue;
    add({ name: chunk.name, kind: chunk.kind, path: chunk.path });
  }
  return hits;
}

export function filterSymbols(hits: SymbolHit[], query: string, activePath: string | null): SymbolHit[] {
  const q = query.trim().toLowerCase();
  const ranked = hits
    .map((hit) => {
      const name = hit.name.toLowerCase();
      if (q && !name.startsWith(q) && !name.includes(q)) return null;
      let score = 0;
      if (q && name.startsWith(q)) score += 40;
      else if (q && name.includes(q)) score += 12;
      if (hit.path === activePath) score += 20;
      if (hit.kind === "function" || hit.kind === "method") score += 6;
      if (hit.kind === "class") score += 4;
      score -= Math.min(hit.name.length, 20);
      return { hit, score };
    })
    .filter((row): row is { hit: SymbolHit; score: number } => row !== null)
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name));
  const out: SymbolHit[] = [];
  const names = new Set<string>();
  for (const row of ranked) {
    if (names.has(row.hit.name)) continue;
    names.add(row.hit.name);
    out.push(row.hit);
    if (out.length >= 30) break;
  }
  return out;
}

function completionType(kind: SymbolHit["kind"]): string {
  if (kind === "class") return "class";
  if (kind === "function") return "function";
  if (kind === "method") return "method";
  if (kind === "heading") return "text";
  return "variable";
}

export function workspaceSource(
  getChunks: () => IndexedChunk[],
  getPath: () => string | null,
): (context: CompletionContext) => CompletionResult | null {
  return (context) => {
    const word = context.matchBefore(/[\w$]{1,}/);
    if (!word && !context.explicit) return null;
    if (word && word.from === word.to && !context.explicit) return null;
    if (word && word.text.length < 2 && !context.explicit) return null;
    const path = getPath();
    const hits = filterSymbols(collectSymbols(getChunks(), path, context.state.doc.toString()), word?.text ?? "", path);
    if (hits.length === 0) return null;
    const options: Completion[] = hits.map((hit) => ({
      label: hit.name,
      type: completionType(hit.kind),
      detail: !hit.path || hit.path === path ? hit.kind : hit.path,
      boost: hit.path === path ? 10 : 0,
    }));
    return {
      from: word ? word.from : context.pos,
      options,
      validFor: /^[\w$]*$/,
    };
  };
}

export function workspaceComplete(getChunks: () => IndexedChunk[], getPath: () => string | null) {
  const source = workspaceSource(getChunks, getPath);
  return EditorState.languageData.of(() => [{ autocomplete: source }]);
}
