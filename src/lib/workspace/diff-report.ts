import { diffStats, lineDiff } from "../agent/apply-edit.ts";
import type { Checkpoint, ChatMessage, ProposedEdit } from "./types.ts";

export type ReportFile = {
  path: string;
  oldText: string;
  newText: string;
};

function esc(value: string): string {
  const amp = "\u0026";
  return value.replaceAll("&", `${amp}amp;`).replaceAll("<", `${amp}lt;`).replaceAll(">", `${amp}gt;`);
}

function slug(value: string): string {
  const s = value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "diff";
}

export function filesFromEdits(edits: ProposedEdit[]): ReportFile[] {
  const byPath = new Map<string, ReportFile>();
  for (const edit of edits) {
    const prev = byPath.get(edit.path);
    byPath.set(edit.path, {
      path: edit.path,
      oldText: prev?.oldText ?? edit.oldText,
      newText: edit.newText,
    });
  }
  return [...byPath.values()];
}

export function filesFromCheckpoint(
  checkpoint: Checkpoint,
  messages: ChatMessage[],
  current: Record<string, string>,
): ReportFile[] {
  const message = checkpoint.messageId ? messages.find((m) => m.id === checkpoint.messageId) : undefined;
  if (message?.edits?.length) return filesFromEdits(message.edits);
  return Object.entries(checkpoint.before).map(([path, oldText]) => ({
    path,
    oldText: oldText ?? "",
    newText: current[path] ?? "",
  }));
}

export function htmlDiffReport(opts: { title: string; workspace: string; files: ReportFile[] }): string {
  const blocks = opts.files.map((file) => {
    const stats = diffStats(file.oldText, file.newText);
    const rows = lineDiff(file.oldText, file.newText)
      .map((row) => {
        const mark = row.type === "add" ? "+" : row.type === "del" ? "−" : " ";
        return `<div class="ln ${row.type}">${mark} ${esc(row.text)}</div>`;
      })
      .join("");
    return `<section class="file">
  <header>
    <h2>${esc(file.path)}</h2>
    <p>+${stats.added} −${stats.removed}</p>
  </header>
  <pre>${rows || `<div class="ln eq">  (unchanged)</div>`}</pre>
</section>`;
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(opts.title)} · ${esc(opts.workspace)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #09090b; color: #f4f4f5; font: 14px/1.5 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
    header.top { padding: 28px 32px 12px; border-bottom: 1px solid #27272a; }
    header.top p { margin: 6px 0 0; color: #a1a1aa; }
    h1 { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: -0.02em; }
    .file { margin: 24px 32px 40px; border: 1px solid #27272a; border-radius: 14px; overflow: hidden; background: #111113; }
    .file header { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #27272a; }
    .file h2 { margin: 0; font: 500 13px/1.4 "IBM Plex Mono", ui-monospace, monospace; }
    .file header p { margin: 0; color: #6ee7b7; font-variant-numeric: tabular-nums; }
    pre { margin: 0; padding: 8px 0 12px; font: 12.5px/1.7 "IBM Plex Mono", ui-monospace, monospace; overflow: auto; }
    .ln { padding: 0 16px; white-space: pre-wrap; }
    .add { background: rgba(110, 231, 183, 0.12); color: #b7f5d8; }
    .del { background: rgba(248, 113, 113, 0.12); color: #fecaca; }
    .eq { color: #83838c; }
  </style>
</head>
<body>
  <header class="top">
    <h1>${esc(opts.title)}</h1>
    <p>${esc(opts.workspace)} · ${opts.files.length} ${opts.files.length === 1 ? "file" : "files"} · Aperture</p>
  </header>
  ${blocks.join("\n") || "<p style='padding:32px;color:#a1a1aa'>No file changes.</p>"}
</body>
</html>`;
}

export function downloadDiffReport(opts: { title: string; workspace: string; files: ReportFile[] }): void {
  const html = htmlDiffReport(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `aperture-${slug(opts.title)}.html`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 4_000);
}
