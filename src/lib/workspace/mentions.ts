function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return true;
  }
  return false;
}

export type MentionKind = "file" | "folder" | "source";

export type MentionItem = {
  path: string;
  kind: MentionKind;
  description?: string;
};

export const CONTEXT_SOURCES: MentionItem[] = [
  { path: "codebase", kind: "source", description: "Search the indexed repo" },
  { path: "repo-map", kind: "source", description: "Workspace file tree" },
];

export function isContextSource(path: string): boolean {
  return CONTEXT_SOURCES.some((item) => item.path === path);
}

export function mentionItems(files: Record<string, string> | readonly string[]): MentionItem[] {
  const paths = Array.isArray(files) ? files : Object.keys(files);
  const folders = new Set<string>();
  const items: MentionItem[] = [...CONTEXT_SOURCES];
  for (const path of paths) {
    items.push({ path, kind: "file", description: "File" });
    const parts = path.split("/");
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
      folders.add(acc);
    }
  }
  for (const path of folders) items.push({ path, kind: "folder", description: "Folder" });
  items.sort((a, b) => {
    if (a.kind === "source" && b.kind !== "source") return -1;
    if (a.kind !== "source" && b.kind === "source") return 1;
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return items;
}

export function parseMentions(text: string, files: Record<string, string>): string[] {
  const catalog = mentionItems(files);
  const found: string[] = [];
  const re = /@([A-Za-z0-9_./-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[1]!;
    const exact = catalog.find((item) => item.path === raw);
    const hit = exact ?? catalog.find((item) => item.path.startsWith(`${raw}/`) || item.path === raw);
    if (hit) found.push(hit.path);
  }
  return [...new Set(found)];
}

export function expandMentions(
  paths: string[],
  files: Record<string, string>,
  cap = 8,
): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  const seen = new Set<string>();
  for (const path of paths) {
    if (isContextSource(path)) continue;
    if (files[path] !== undefined) {
      if (seen.has(path)) continue;
      seen.add(path);
      out.push({ path, content: files[path]!.slice(0, 4000) });
    } else {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      for (const filePath of Object.keys(files)) {
        if (filePath === path || filePath.startsWith(prefix)) {
          if (seen.has(filePath)) continue;
          seen.add(filePath);
          out.push({ path: filePath, content: files[filePath]!.slice(0, 2400) });
          if (out.length >= cap) return out;
        }
      }
    }
    if (out.length >= cap) break;
  }
  return out;
}

export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const left = text.slice(0, caret);
  const at = left.lastIndexOf("@");
  if (at < 0) return null;
  const between = left.slice(at + 1);
  if (between.includes(" ") || between.includes("\n") || between.includes("\t")) return null;
  return { start: at, query: between };
}

export function filterMentions(items: MentionItem[], query: string, limit = 10): MentionItem[] {
  const q = query.trim().toLowerCase();
  const match = (item: MentionItem) =>
    !q || fuzzyMatch(q, item.path) || Boolean(item.description && fuzzyMatch(q, item.description));
  const sources = items.filter((item) => item.kind === "source" && match(item));
  const rest = items.filter((item) => item.kind !== "source" && match(item));
  rest.sort((a, b) => {
    const as = a.path.toLowerCase().startsWith(q) ? 0 : 1;
    const bs = b.path.toLowerCase().startsWith(q) ? 0 : 1;
    if (as !== bs) return as - bs;
    return a.path.length - b.path.length;
  });
  return [...sources, ...rest].slice(0, limit);
}

export function mentionQuery(instruction: string): string {
  return instruction.replace(/@[A-Za-z0-9_./-]+/g, " ").replace(/\s+/g, " ").trim();
}
