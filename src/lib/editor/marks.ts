import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { lineDiff } from "../agent/apply-edit.ts";
import { importIssues } from "../workspace/module-graph.ts";
import { issuesForText } from "../workspace/preview-check.ts";
import { isScriptPath } from "../workspace/syntax-check.ts";
import { isTypePath, typeIssues } from "../workspace/type-check.ts";

export type LineMark = { line: number; message: string; severity: "error" | "warning" };

export function lineOfIssue(text: string): number | null {
  const match = /\bat line (\d+)\b/.exec(text);
  if (!match) return null;
  const line = Number(match[1]);
  return Number.isInteger(line) && line >= 1 ? line : null;
}

/** Parse, type, and import failures that name a line. Same order the check strip uses. */
export function collectMarks(path: string, text: string, files: Record<string, string>): LineMark[] {
  const parse = issuesForText(path, text);
  const messages = parse.length > 0 ? parse : isScriptPath(path) ? [...importIssues(path, files), ...(isTypePath(path) ? typeIssues(path, text, files) : [])] : [];
  const marks: LineMark[] = [];
  for (const message of messages) {
    const line = lineOfIssue(message);
    if (!line || marks.some((mark) => mark.line === line && mark.message === message)) continue;
    marks.push({ line, message, severity: "error" });
  }
  return marks;
}

export type MarkPlace = { oldLine: number } | { insertAfter: number; addedIndex: number };

/** Where a line in the staged file sits in the old file the editor is showing. */
export function placeMark(oldText: string, newText: string, newLine: number): MarkPlace | null {
  if (newLine < 1) return null;
  let oldLine = 1;
  let next = 1;
  let insertAfter = 0;
  let addedIndex = 0;
  let adding = false;
  for (const row of lineDiff(oldText, newText)) {
    if (row.type === "add") {
      if (!adding) addedIndex = 0;
      adding = true;
      if (next === newLine) return { insertAfter, addedIndex };
      next += 1;
      addedIndex += 1;
      continue;
    }
    adding = false;
    addedIndex = 0;
    if (row.type === "eq") {
      if (next === newLine) return { oldLine };
      oldLine += 1;
      next += 1;
      insertAfter = oldLine - 1;
      continue;
    }
    oldLine += 1;
    insertAfter = oldLine - 1;
  }
  return null;
}

const setMarks = StateEffect.define<LineMark[]>();

function classFor(severity: LineMark["severity"]): string {
  return severity === "warning" ? "cm-lintRange-warning" : "cm-lintRange-error";
}

function decorate(doc: { lines: number; line: (n: number) => { from: number; to: number; length: number } }, marks: LineMark[]): DecorationSet {
  const ranges = [];
  for (const mark of marks) {
    if (mark.line < 1 || mark.line > doc.lines) continue;
    const line = doc.line(mark.line);
    if (line.length === 0) continue;
    ranges.push(
      Decoration.mark({
        class: classFor(mark.severity),
        attributes: { title: mark.message },
      }).range(line.from, line.to),
    );
  }
  return Decoration.set(ranges, true);
}

const markField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMarks)) return decorate(tr.state.doc, effect.value);
    }
    if (tr.docChanged) return Decoration.none;
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function lineMarkExtension(): Extension {
  return markField;
}

export function lineMarkEffect(marks: LineMark[]) {
  return setMarks.of(marks);
}
