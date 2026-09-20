import type { DiffNote, ProposedEdit } from "./types";

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function isPreviewPath(path: string): boolean {
  return /\.(html?|css)$/i.test(path);
}

export function htmlIssues(html: string): string[] {
  const issues: string[] = [];
  if (!html.trim()) return ["empty HTML"];
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const err = doc.querySelector("parsererror");
      if (err) issues.push((err.textContent ?? "parse error").replace(/\s+/g, " ").slice(0, 160));
    } catch (error) {
      issues.push(error instanceof Error ? error.message.slice(0, 160) : "parse error");
    }
  }
  const stack: string[] = [];
  const re =
    /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)\b[^>]*?(\/?)\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match[0].startsWith("<!--") || match[0].toLowerCase().startsWith("<!doctype")) continue;
    if (match[1]) {
      const close = match[1].toLowerCase();
      let i = stack.length - 1;
      while (i >= 0 && stack[i] !== close) i -= 1;
      if (i < 0) issues.push(`unexpected </${close}>`);
      else stack.length = i;
      continue;
    }
    const tag = (match[2] ?? "").toLowerCase();
    const self = match[3] === "/" || VOID.has(tag);
    if (!self) stack.push(tag);
  }
  const leftover = stack.filter((tag) => tag !== "html" && tag !== "head" && tag !== "body");
  if (leftover.length) issues.push(`unclosed <${leftover.slice(-3).join(">, <")}>`);
  return [...new Set(issues)].slice(0, 6);
}

export function cssIssues(css: string): string[] {
  let depth = 0;
  for (const ch of css) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    if (depth < 0) return ["unmatched }"];
  }
  if (depth > 0) return [`${depth} unclosed {`];
  return [];
}

export function issuesForText(path: string, text: string): string[] {
  if (/\.html?$/i.test(path)) return htmlIssues(text);
  if (/\.css$/i.test(path)) return cssIssues(text);
  return [];
}

export function mergeEdits(files: Record<string, string>, edits: ProposedEdit[]): Record<string, string> {
  const next = { ...files };
  for (const edit of edits) next[edit.path] = edit.newText;
  return next;
}

export function previewIssues(
  files: Record<string, string>,
  edits: ProposedEdit[],
  liveErrors: string[] = [],
): Array<{ path: string; issues: string[] }> {
  const snapshot = mergeEdits(files, edits);
  const out: Array<{ path: string; issues: string[] }> = [];
  const paths = new Set(edits.filter((e) => isPreviewPath(e.path)).map((e) => e.path));
  for (const path of paths) {
    const issues = issuesForText(path, snapshot[path] ?? "");
    if (issues.length) out.push({ path, issues });
  }
  if (liveErrors.length && paths.size) {
    const htmlPath = [...paths].find((p) => /\.html?$/i.test(p)) ?? [...paths][0]!;
    const row = out.find((r) => r.path === htmlPath);
    const extra = liveErrors.slice(0, 4);
    if (row) row.issues.push(...extra);
    else out.push({ path: htmlPath, issues: extra });
  }
  return out;
}

export function notesFromPreviewIssues(path: string, issues: string[]): DiffNote[] {
  return issues.slice(0, 4).map((text, i) => ({
    id: `preview_${i}_${path}`,
    excerpt: "",
    type: "eq" as const,
    text: `Preview check: ${text}`,
  }));
}

export function previewNotesForEdit(
  edit: ProposedEdit,
  files: Record<string, string>,
  liveErrors: string[] = [],
): DiffNote[] {
  if (!isPreviewPath(edit.path)) return [];
  const rows = previewIssues(files, [edit], liveErrors);
  const hit = rows.find((r) => r.path === edit.path) ?? rows[0];
  if (!hit) return [];
  return notesFromPreviewIssues(edit.path, hit.issues);
}
