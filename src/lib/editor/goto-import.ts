import { EditorView } from "@codemirror/view";

const SPEC = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\1/g;

/** The relative import under a column, or null. Column is an index into the line. */
export function importSpecAt(line: string, column: number): string | null {
  for (const match of line.matchAll(SPEC)) {
    const spec = match[2];
    if (!spec?.startsWith(".")) continue;
    const start = (match.index ?? 0) + match[0].lastIndexOf(spec);
    const end = start + spec.length;
    if (column >= start && column <= end) return spec;
  }
  return null;
}

/** A relative import resolved to a file in this project, or null. */
export function localImportPath(from: string, spec: string, files: Record<string, string>): string | null {
  if (!spec.startsWith(".")) return null;
  const parts = from.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const base = parts.join("/");
  const swapped = base.replace(/\.jsx$/, ".tsx").replace(/\.js$/, ".ts");
  const exts = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", "/index.ts", "/index.tsx", "/index.js"];
  const candidates = [base, swapped, ...exts.flatMap((ext) => [base + ext, swapped + ext])];
  return candidates.find((path) => files[path] !== undefined) ?? null;
}

/** Cmd-click or Ctrl-click a relative import to open that file. */
export function gotoImport(
  current: () => string | null,
  files: () => Record<string, string>,
  open: (path: string) => void,
) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!event.metaKey && !event.ctrlKey) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const line = view.state.doc.lineAt(pos);
      const spec = importSpecAt(line.text, pos - line.from);
      const file = current();
      if (!spec || !file) return false;
      const target = localImportPath(file, spec, files());
      if (!target) return false;
      event.preventDefault();
      open(target);
      return true;
    },
  });
}
