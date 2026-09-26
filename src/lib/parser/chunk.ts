import { languageFromPath } from "./language.ts";
import type { ChunkKind, SyntaxChunk } from "@/lib/workspace/types";

const WINDOW = 80;
const OVERLAP = 16;

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function sliceLines(source: string, startLine: number, endLine: number): string {
  const lines = source.split("\n");
  return lines.slice(startLine - 1, endLine).join("\n");
}

function matchBrace(source: string, openIndex: number): number {
  let depth = 0;
  let inStr: string | null = null;
  let escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]!;
    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
      if (i < 0) return source.length;
      continue;
    }
    if (ch === "{" || ch === "(") depth += 1;
    else if (ch === "}" || ch === ")") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}

function pushChunk(
  chunks: SyntaxChunk[],
  source: string,
  name: string,
  kind: ChunkKind,
  start: number,
  end: number,
) {
  const startLine = lineAt(source, start);
  const endLine = lineAt(source, Math.max(start, end - 1));
  chunks.push({
    name,
    kind,
    startLine,
    endLine,
    text: sliceLines(source, startLine, endLine),
  });
}

function chunkJsFamily(source: string): SyntaxChunk[] {
  const chunks: SyntaxChunk[] = [];
  const patterns: Array<{ re: RegExp; kind: ChunkKind; name: (m: RegExpExecArray) => string }> = [
    { re: /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g, kind: "class", name: (m) => m[1] ?? "class" },
    {
      re: /(?:export\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/g,
      kind: "function",
      name: (m) => m[1] ?? "function",
    },
    {
      re: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g,
      kind: "function",
      name: (m) => m[1] ?? "fn",
    },
  ];

  const seen = new Set<string>();
  for (const { re, kind, name } of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      const start = match.index;
      const brace = source.indexOf("{", start);
      const end = brace >= 0 ? matchBrace(source, brace) : start + match[0].length;
      const label = name(match);
      const key = `${kind}:${label}:${start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pushChunk(chunks, source, label, kind, start, end);
    }
  }

  const methodRe = /^\s+(?:async\s+)?(?:static\s+)?(?:get|set|)\s*([A-Za-z_]\w*)\s*\(/gm;
  let methodMatch: RegExpExecArray | null;
  while ((methodMatch = methodRe.exec(source))) {
    const name = methodMatch[1] ?? "method";
    if (name === "if" || name === "for" || name === "while" || name === "switch" || name === "catch") continue;
    const start = methodMatch.index;
    const brace = source.indexOf("{", start);
    if (brace < 0) continue;
    const end = matchBrace(source, brace);
    pushChunk(chunks, source, name, "method", start, end);
  }

  return dedupeChunks(chunks, source);
}

function chunkPython(source: string): SyntaxChunk[] {
  const chunks: SyntaxChunk[] = [];
  const lines = source.split("\n");
  const starts: Array<{ line: number; indent: number; name: string; kind: ChunkKind }> = [];

  lines.forEach((line, i) => {
    const trimmed = line.trimEnd();
    const match = /^( *)(def|async def|class)\s+(\w+)/.exec(trimmed);
    if (!match) return;
    const indent = match[1]?.length ?? 0;
    const kind: ChunkKind = match[2] === "class" ? "class" : "function";
    starts.push({ line: i, indent, name: match[3] ?? "block", kind });
  });

  starts.forEach((item, idx) => {
    let end = lines.length;
    for (let j = idx + 1; j < starts.length; j++) {
      if (starts[j]!.indent <= item.indent) {
        end = starts[j]!.line;
        break;
      }
    }
    if (idx === starts.length - 1) {
      for (let k = item.line + 1; k < lines.length; k++) {
        const t = lines[k]!;
        if (t.trim() === "") continue;
        const indent = t.match(/^ */)?.[0].length ?? 0;
        if (indent <= item.indent && t.trim() !== "") {
          end = k;
          break;
        }
      }
    }
    chunks.push({
      name: item.name,
      kind: item.kind,
      startLine: item.line + 1,
      endLine: end,
      text: lines.slice(item.line, end).join("\n"),
    });
  });

  return chunks;
}

function chunkMarkdown(source: string): SyntaxChunk[] {
  const lines = source.split("\n");
  const headings: Array<{ line: number; name: string }> = [];
  lines.forEach((line, i) => {
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (m) headings.push({ line: i, name: m[2]!.trim() });
  });
  return headings.map((h, i) => {
    const end = i + 1 < headings.length ? headings[i + 1]!.line : lines.length;
    return {
      name: h.name,
      kind: "heading" as const,
      startLine: h.line + 1,
      endLine: end,
      text: lines.slice(h.line, end).join("\n"),
    };
  });
}

function chunkWindows(source: string): SyntaxChunk[] {
  const lines = source.split("\n");
  if (lines.length === 0) return [];
  const chunks: SyntaxChunk[] = [];
  for (let i = 0; i < lines.length; i += WINDOW - OVERLAP) {
    const startLine = i + 1;
    const endLine = Math.min(lines.length, i + WINDOW);
    chunks.push({
      name: `L${startLine}-L${endLine}`,
      kind: "block",
      startLine,
      endLine,
      text: lines.slice(i, endLine).join("\n"),
    });
    if (endLine >= lines.length) break;
  }
  return chunks;
}

function dedupeChunks(chunks: SyntaxChunk[], source: string): SyntaxChunk[] {
  const sorted = [...chunks].sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
  const out: SyntaxChunk[] = [];
  for (const chunk of sorted) {
    const overlap = out.find(
      (c) => c.name === chunk.name && Math.abs(c.startLine - chunk.startLine) <= 1,
    );
    if (overlap) continue;
    out.push(chunk);
  }
  if (out.length === 0) return chunkWindows(source);
  return out;
}

export function chunkSource(path: string, source: string): SyntaxChunk[] {
  const lang = languageFromPath(path);
  let chunks: SyntaxChunk[] = [];
  if (lang === "typescript" || lang === "javascript") chunks = chunkJsFamily(source);
  else if (lang === "python") chunks = chunkPython(source);
  else if (lang === "markdown") chunks = chunkMarkdown(source);
  else chunks = chunkWindows(source);

  if (chunks.length === 0) chunks = chunkWindows(source);

  const module: SyntaxChunk = {
    name: path.split("/").pop() ?? path,
    kind: "module",
    startLine: 1,
    endLine: Math.max(1, source.split("\n").length),
    text: source.length > 4000 ? source.slice(0, 4000) : source,
  };
  return [module, ...chunks.filter((c) => c.kind !== "module")];
}
