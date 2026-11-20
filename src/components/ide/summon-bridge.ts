import { useEffect } from "react";
import {
  EDITOR_LIMITS,
  fileWindow,
  findPath,
  type EditorContext,
  type EditorFile,
  type EditorPeek,
  type EditorProblem,
} from "@/lib/bot/editor-context";
import { useSummon } from "@/lib/bot/summon-store";
import { isSecretPath } from "@/lib/security/redact";
import { useIdeUi } from "@/lib/ui-store";
import { collectImports, resolveSpecifier } from "@/lib/workspace/module-graph";
import { useWorkspace } from "@/lib/workspace/store";

/** TypeScript has this long to say what is wrong with the file, or the message goes without. */
const PROBLEMS_MS = 2500;
const CHECKED = /\.(?:[cm]?[jt]sx?)$/i;

type Workspace = ReturnType<typeof useWorkspace.getState>;

function openPath(ws: Workspace): string | null {
  return ws.activePath && ws.files[ws.activePath] !== undefined ? ws.activePath : null;
}

function selectionIn(ws: Workspace, path: string | null) {
  const sel = ws.selection;
  return sel && path && sel.path === path && !sel.empty ? sel : null;
}

/** The project's files the open one imports that go along with it: small ones, never a secret. */
function importsOf(ws: Workspace, path: string | null): string[] {
  if (!path || !CHECKED.test(path) || isSecretPath(path)) return [];
  const found: string[] = [];
  for (const ref of collectImports(path, ws.files[path] ?? "")) {
    const hit = resolveSpecifier(path, ref.spec, ws.files);
    if (hit.kind !== "file" || hit.path === path || found.includes(hit.path)) continue;
    if (isSecretPath(hit.path) || (ws.files[hit.path] ?? "").length > EDITOR_LIMITS.importFile)
      continue;
    found.push(hit.path);
    if (found.length >= EDITOR_LIMITS.imports) break;
  }
  return found;
}

function peekOf(ws: Workspace): EditorPeek {
  const path = openPath(ws);
  const sel = selectionIn(ws, path);
  return {
    project: ws.name,
    path,
    selection: sel ? { fromLine: sel.fromLine, toLine: sel.toLine } : null,
    imports: importsOf(ws, path).length,
  };
}

/** The other files that go: those asked for first, then the imports, within the limits. */
function otherFiles(
  ws: Workspace,
  path: string | null,
  asked: string[],
): { extra: EditorFile[]; missing: string[] } {
  const all = Object.keys(ws.files);
  const extra: EditorFile[] = [];
  const missing: string[] = [];
  let total = 0;
  const add = (at: string, why: EditorFile["why"]) => {
    if (at === path || extra.some((f) => f.path === at)) return;
    if (extra.length >= EDITOR_LIMITS.extra || total >= EDITOR_LIMITS.extraTotal) return;
    const text = (ws.files[at] ?? "").slice(
      0,
      Math.min(EDITOR_LIMITS.extraFile, EDITOR_LIMITS.extraTotal - total),
    );
    total += text.length;
    extra.push({ path: at, text, why });
  };
  for (const want of asked) {
    const at = findPath(want, all);
    if (!at) missing.push(want);
    else if (isSecretPath(at)) missing.push(`${at} (it holds secrets)`);
    else add(at, "asked");
  }
  for (const at of importsOf(ws, path)) add(at, "import");
  return { extra, missing: missing.slice(0, EDITOR_LIMITS.extra) };
}

/** 1-based line of an offset in the text. */
function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

async function problemsIn(ws: Workspace, path: string, text: string): Promise<EditorProblem[]> {
  if (!CHECKED.test(path)) return [];
  const { tsProblems } = await import("@/lib/workspace/tsc");
  const control = new AbortController();
  const timer = window.setTimeout(() => control.abort(), PROBLEMS_MS);
  try {
    const found = await tsProblems(ws.files, path, text, control.signal);
    return (found ?? []).slice(0, EDITOR_LIMITS.problems).map((p) => ({
      line: lineAt(text, p.start),
      message: p.message,
      severity: p.severity,
    }));
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

/** What the editor shows now, for the summoned bot: never a secret file's text. */
async function editorContext(asked: string[] = []): Promise<EditorContext> {
  const ws = useWorkspace.getState();
  const path = openPath(ws);
  const secret = path ? isSecretPath(path) : false;
  const text = path && !secret ? ws.files[path]! : "";
  const sel = secret ? null : selectionIn(ws, path);
  const shown = fileWindow(text, sel);
  return {
    project: ws.name,
    files: Object.keys(ws.files).length,
    path,
    text: shown.text,
    fromLine: shown.fromLine,
    lines: path ? (ws.files[path] ?? "").split("\n").length : 0,
    selection: sel
      ? {
          fromLine: sel.fromLine,
          toLine: sel.toLine,
          text: sel.text.slice(0, EDITOR_LIMITS.selection),
        }
      : null,
    problems: path && !secret ? await problemsIn(ws, path, text) : [],
    tree: Object.keys(ws.files).sort().slice(0, EDITOR_LIMITS.tree),
    ...otherFiles(ws, path, asked),
  };
}

/**
 * Lends the summoned bot (Ctrl/⌘+J) the editor while it is open: what it
 * shows, and Composer, which takes the changes the bot proposes.
 */
export function useSummonBridge() {
  useEffect(() => {
    const summon = useSummon.getState();
    summon.setEditor({
      context: editorContext,
      toComposer: (instruction) => {
        useIdeUi.getState().handToComposer(instruction);
        useSummon.getState().setOpen(false);
      },
    });
    let last = "";
    let seen: unknown[] = [];
    const note = (ws: Workspace) => {
      // Composer streaming changes the store many times a second: only what the peek reads counts.
      const now = [ws.name, ws.activePath, ws.selection, ws.files];
      if (now.every((v, i) => v === seen[i])) return;
      seen = now;
      const peek = peekOf(ws);
      const key = JSON.stringify(peek);
      if (key === last) return;
      last = key;
      useSummon.getState().setPeek(peek);
    };
    note(useWorkspace.getState());
    const stop = useWorkspace.subscribe(note);
    return () => {
      stop();
      useSummon.getState().setEditor(null);
    };
  }, []);
}
