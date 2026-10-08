import { Prec, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  hoverTooltip,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { lineDiff } from "../agent/apply-edit.ts";
import { newIssues } from "../workspace/checks.ts";
import { importIssues } from "../workspace/module-graph.ts";
import { issuesForText } from "../workspace/preview-check.ts";
import { isScriptPath } from "../workspace/syntax-check.ts";
import { isTypePath, typeIssues } from "../workspace/type-check.ts";

/** `warning`: the file already had this issue before the staged change, as the check strip's amber row says. */
export type LineMark = { line: number; message: string; severity: "error" | "warning" };

export function lineOfIssue(text: string): number | null {
  const match = /\bat line (\d+)\b/.exec(text);
  if (!match) return null;
  const line = Number(match[1]);
  return Number.isInteger(line) && line >= 1 ? line : null;
}

/**
 * Parse failures, or else import and type failures. Same order the check
 * strip uses. `types`, when given, is what real tsc found, in place of the light check.
 */
function issuesIn(
  path: string,
  text: string,
  files: Record<string, string>,
  types?: string[],
  parseErrors?: string[],
): { parse: boolean; messages: string[] } {
  // tsc read the file with TypeScript's own parser: its parse errors overrule Lezer's.
  const parse = issuesForText(path, text, parseErrors ? () => parseErrors : undefined);
  if (parse.length > 0) return { parse: true, messages: parse };
  if (!isScriptPath(path)) return { parse: false, messages: [] };
  const typed = types ?? (isTypePath(path) ? typeIssues(path, text, files) : []);
  return { parse: false, messages: [...importIssues(path, files), ...typed] };
}

/**
 * Parse, type, and import failures that name a line. Given the applied files
 * a staged change would replace, an issue the file already had is a warning,
 * not an error: the check strip does not blame it on the change either. A
 * parse failure is always an error, as it is in the strip.
 */
export function collectMarks(
  path: string,
  text: string,
  files: Record<string, string>,
  applied?: Record<string, string>,
  tsc?: { after: string[]; before: string[]; parse?: string[] },
): LineMark[] {
  const { parse, messages } = issuesIn(path, text, files, tsc?.after, tsc?.parse);
  const before =
    !parse && applied?.[path] !== undefined ? issuesIn(path, applied[path], applied, tsc?.before).messages : null;
  const fresh = new Map<string, number>();
  for (const message of before ? newIssues(messages, before) : messages) fresh.set(message, (fresh.get(message) ?? 0) + 1);
  const marks: LineMark[] = [];
  for (const message of messages) {
    const left = fresh.get(message) ?? 0;
    if (left > 0) fresh.set(message, left - 1);
    const line = lineOfIssue(message);
    if (!line || marks.some((mark) => mark.line === line && mark.message === message)) continue;
    marks.push({ line, message, severity: left > 0 ? "error" : "warning" });
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

/** The next marked line after `from` (or before it, going back), wrapping around the file. F7 and Shift-F7. */
export function nextMarkedLine(marks: LineMark[], from: number, dir: 1 | -1): number | null {
  const lines = [...new Set(marks.map((mark) => mark.line))].sort((a, b) => a - b);
  if (lines.length === 0) return null;
  if (dir === 1) return lines.find((line) => line > from) ?? lines[0]!;
  return [...lines].reverse().find((line) => line < from) ?? lines[lines.length - 1]!;
}

/** The marks on one line, errors first, and the severity the line shows. */
export function marksOnLine(marks: LineMark[], line: number): { severity: LineMark["severity"]; messages: string[] } | null {
  const here = marks.filter((mark) => mark.line === line);
  if (here.length === 0) return null;
  const errors = here.filter((mark) => mark.severity === "error");
  const warnings = here.filter((mark) => mark.severity === "warning");
  return {
    severity: errors.length > 0 ? "error" : "warning",
    messages: [...errors, ...warnings].map((mark) => mark.message),
  };
}

const setMarks = StateEffect.define<LineMark[]>();

function classFor(severity: LineMark["severity"]): string {
  return severity === "warning" ? "cm-lintRange-warning" : "cm-lintRange-error";
}

type Doc = EditorState["doc"];

function decorate(doc: Doc, marks: LineMark[]): DecorationSet {
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

type Marked = { marks: LineMark[]; deco: DecorationSet };

const markField = StateField.define<Marked>({
  create: () => ({ marks: [], deco: Decoration.none }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMarks)) {
        const marks = effect.value.filter((mark) => mark.line >= 1 && mark.line <= tr.state.doc.lines);
        return { marks, deco: decorate(tr.state.doc, marks) };
      }
    }
    // Typing moves lines; stale marks would point at the wrong ones until the checks run again.
    if (tr.docChanged) return { marks: [], deco: Decoration.none };
    return value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
});

/** The marks the editor is showing now. */
export function shownMarks(state: EditorState): LineMark[] {
  return state.field(markField, false)?.marks ?? [];
}

// Plain fields: the tests run this file with Node's type stripping, which has no parameter properties.
class DotMarker extends GutterMarker {
  readonly severity: LineMark["severity"];
  readonly messages: string[];
  constructor(severity: LineMark["severity"], messages: string[]) {
    super();
    this.severity = severity;
    this.messages = messages;
  }
  eq(other: DotMarker) {
    return other.severity === this.severity && other.messages.join("\n") === this.messages.join("\n");
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-aperture-check-dot cm-aperture-check-${this.severity}`;
    el.title = this.messages.join("\n");
    return el;
  }
}

const dotGutter = gutter({
  class: "cm-aperture-checkGutter",
  lineMarker(view, line) {
    const here = marksOnLine(shownMarks(view.state), view.state.doc.lineAt(line.from).number);
    return here ? new DotMarker(here.severity, here.messages) : null;
  },
  lineMarkerChange: (update) => update.transactions.some((tr) => tr.effects.some((e) => e.is(setMarks))) || update.docChanged,
  domEventHandlers: {
    mousedown(view, line) {
      const number = view.state.doc.lineAt(line.from).number;
      if (!marksOnLine(shownMarks(view.state), number)) return false;
      view.dispatch({ selection: { anchor: line.from } });
      view.focus();
      return true;
    },
  },
});

const markTooltip = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const here = marksOnLine(shownMarks(view.state), line.number);
  if (!here) return null;
  return {
    pos: line.from,
    end: line.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-aperture-check-tip";
      for (const message of here.messages) {
        const row = document.createElement("div");
        row.textContent = message;
        dom.appendChild(row);
      }
      return { dom };
    },
  };
});

function jump(dir: 1 | -1) {
  return (view: EditorView) => {
    const current = view.state.doc.lineAt(view.state.selection.main.head).number;
    const target = nextMarkedLine(shownMarks(view.state), current, dir);
    if (target === null) return false;
    const pos = view.state.doc.line(target).from;
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "center" }) });
    return true;
  };
}

/**
 * Wavy underlines, a dot in the margin, the message on hover, and F7 /
 * Shift-F7 between marked lines. Not F8: that steps through review hunks.
 */
export function lineMarkExtension(): Extension {
  return [
    markField,
    dotGutter,
    markTooltip,
    Prec.high(keymap.of([{ key: "F7", run: jump(1) }, { key: "Shift-F7", run: jump(-1) }])),
  ];
}

export function lineMarkEffect(marks: LineMark[]) {
  return setMarks.of(marks);
}
