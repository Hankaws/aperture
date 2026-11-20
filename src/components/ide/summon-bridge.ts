import { useEffect } from "react";
import {
  EDITOR_LIMITS,
  fileWindow,
  type EditorContext,
  type EditorPeek,
  type EditorProblem,
} from "@/lib/bot/editor-context";
import { useSummon } from "@/lib/bot/summon-store";
import { isSecretPath } from "@/lib/security/redact";
import { useIdeUi } from "@/lib/ui-store";
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

function peekOf(ws: Workspace): EditorPeek {
  const path = openPath(ws);
  const sel = selectionIn(ws, path);
  return {
    project: ws.name,
    path,
    selection: sel ? { fromLine: sel.fromLine, toLine: sel.toLine } : null,
  };
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
async function editorContext(): Promise<EditorContext> {
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
    const note = (ws: Workspace) => {
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
