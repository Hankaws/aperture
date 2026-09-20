import { lineDiff } from "./apply-edit.ts";
import type { PlanEntry, ProposedEdit } from "../workspace/types.ts";
import { previewIssues } from "../workspace/preview-check.ts";

const DECL =
  /(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z_][\w]*)/;

function declarations(text: string): Array<{ name: string; line: number }> {
  return text.split("\n").flatMap((row, i) => {
    const match = DECL.exec(row);
    return match?.[1] ? [{ name: match[1], line: i + 1 }] : [];
  });
}

function addedLines(oldText: string, newText: string): number[] {
  const lines: number[] = [];
  let n = 1;
  for (const row of lineDiff(oldText, newText)) {
    if (row.type === "add") lines.push(n);
    if (row.type !== "del") n += 1;
  }
  return lines;
}

export function symbolsFromEdit(edit: ProposedEdit): string[] {
  const decls = declarations(edit.newText);
  const added = addedLines(edit.oldText, edit.newText);
  const names = new Set<string>();
  for (const line of added) {
    const onLine = decls.filter((d) => d.line === line);
    if (onLine.length) {
      onLine.forEach((d) => names.add(d.name));
      continue;
    }
    const enclosing = [...decls].reverse().find((d) => d.line <= line);
    if (enclosing) names.add(enclosing.name);
  }
  for (const row of lineDiff(edit.oldText, edit.newText)) {
    if (row.type !== "add" && row.type !== "del") continue;
    const match = DECL.exec(row.text);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names].filter((n) => n.length > 1 && n.length < 48).slice(0, 8);
}

function filesMentioning(files: Record<string, string>, symbol: string, skip: Set<string>): string[] {
  const needle = symbol.toLowerCase();
  const out: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (skip.has(path)) continue;
    if (content.toLowerCase().includes(needle)) out.push(path);
    if (out.length >= 3) break;
  }
  return out;
}

/** Three-line recap: what changed, what still references it, what the plan left open. */
export function verifyRecap(edits: ProposedEdit[], files: Record<string, string>, plan: PlanEntry[] = []): string {
  if (edits.length === 0) return "";
  const paths = [...new Set(edits.map((e) => e.path))];
  const skip = new Set(paths);
  const changed = paths.map((path) => {
    const names = [...new Set(edits.filter((e) => e.path === path).flatMap(symbolsFromEdit))];
    return names.length ? `${path} (${names.slice(0, 3).join(", ")})` : path;
  });
  const line1 = `Changed: ${changed.slice(0, 4).join("; ")}`;

  const leftover: string[] = [];
  for (const symbol of [...new Set(edits.flatMap(symbolsFromEdit))].slice(0, 5)) {
    const hits = filesMentioning(files, symbol, skip);
    if (hits.length) leftover.push(`${symbol} still in ${hits.slice(0, 2).join(", ")}`);
  }
  const line2 = leftover.length
    ? `Didn't: ${leftover.slice(0, 2).join("; ")}`
    : "Didn't: no other files mention the changed names.";

  const open = plan.filter((e) => e.status !== "completed").map((e) => e.content);
  const line3 = open.length ? `Left: ${open.slice(0, 2).join("; ")}` : "Left: nothing on the plan.";
  const preview = previewIssues(files, edits);
  const line4 = preview.length
    ? `Preview: ${preview
        .map((row) => `${row.path} ${row.issues[0]}`)
        .slice(0, 2)
        .join("; ")}`
    : "";
  return [line1, line2, line3, line4].filter(Boolean).join("\n");
}

export function appendVerify(
  text: string,
  edits: ProposedEdit[],
  files: Record<string, string>,
  plan: PlanEntry[] = [],
): string {
  if (edits.length === 0 || text.includes("Changed:")) return text;
  const recap = verifyRecap(edits, files, plan);
  if (!recap) return text;
  return `${text.trim()}\n\n${recap}`;
}
