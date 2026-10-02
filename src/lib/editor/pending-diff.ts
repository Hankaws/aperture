import { Prec, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, WidgetType, gutter, keymap } from "@codemirror/view";
import { hunksFromDiff } from "@/lib/agent/apply-edit";
import { placeMark, type LineMark } from "./marks.ts";
import type { ProposedEdit } from "@/lib/workspace/types";

const MAX_ADD_LINES = 80;

class AddBlockWidget extends WidgetType {
  constructor(
    readonly lines: string[],
    readonly marks: Array<string | null> = [],
  ) {
    super();
  }
  eq(other: AddBlockWidget) {
    return (
      this.lines.length === other.lines.length &&
      this.lines.every((line, i) => line === other.lines[i] && this.marks[i] === other.marks[i])
    );
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-aperture-add-block";
    wrap.setAttribute("aria-hidden", "true");
    const shown = this.lines.slice(0, MAX_ADD_LINES);
    shown.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "cm-aperture-add-line";
      const sign = document.createElement("span");
      sign.className = "cm-aperture-add-sign";
      sign.textContent = "+";
      const body = document.createElement("span");
      body.textContent = text.length ? text : " ";
      const note = this.marks[i];
      if (note) {
        body.className = "cm-lintRange-error";
        body.title = note;
      }
      row.append(sign, body);
      wrap.appendChild(row);
    });
    if (this.lines.length > MAX_ADD_LINES) {
      const more = document.createElement("div");
      more.className = "cm-aperture-add-more";
      more.textContent = `+${this.lines.length - MAX_ADD_LINES} more`;
      wrap.appendChild(more);
    }
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

class SignMarker extends GutterMarker {
  constructor(
    readonly sign: string,
    readonly cls: string,
  ) {
    super();
  }
  eq(other: SignMarker) {
    return other.sign === this.sign;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = this.cls;
    el.textContent = this.sign;
    return el;
  }
}

const delMarker = new SignMarker("−", "cm-aperture-diff-sign cm-aperture-diff-sign-del");

function addedNotes(edit: ProposedEdit, hunk: { insertAfter: number; added: string[] }, marks: LineMark[]): Array<string | null> {
  return hunk.added.map((_, index) => {
    const hit = marks.find((mark) => {
      const place = placeMark(edit.oldText, edit.newText, mark.line);
      return place !== null && "addedIndex" in place && place.insertAfter === hunk.insertAfter && place.addedIndex === index;
    });
    return hit?.message ?? null;
  });
}

function buildDecorations(state: EditorState, edit: ProposedEdit, marks: LineMark[]) {
  if (state.doc.toString() !== edit.oldText) return Decoration.none;
  const hunks = hunksFromDiff(edit.oldText, edit.newText);
  const ranges = [];
  for (const hunk of hunks) {
    for (const n of hunk.deleted) {
      if (n < 1 || n > state.doc.lines) continue;
      ranges.push(Decoration.line({ class: "cm-aperture-del" }).range(state.doc.line(n).from));
    }
    if (hunk.added.length === 0) continue;
    const pos =
      hunk.insertAfter <= 0
        ? 0
        : hunk.insertAfter >= state.doc.lines
          ? state.doc.length
          : state.doc.line(hunk.insertAfter).to;
    ranges.push(
      Decoration.widget({
        widget: new AddBlockWidget(hunk.added, addedNotes(edit, hunk, marks)),
        block: true,
        side: hunk.insertAfter <= 0 ? -1 : 1,
      }).range(pos),
    );
  }
  return Decoration.set(ranges, true);
}

export function firstHunkPos(edit: ProposedEdit, lineCount: number, lineFrom: (n: number) => number): number | null {
  const hunks = hunksFromDiff(edit.oldText, edit.newText);
  const hunk = hunks[0];
  if (!hunk) return null;
  const lineNo = hunk.deleted[0] ?? Math.max(1, hunk.insertAfter);
  const safe = Math.min(Math.max(1, lineNo), lineCount);
  return lineFrom(safe);
}

export function pendingDiff(
  edit: ProposedEdit | null,
  handlers: {
    apply: (edit: ProposedEdit) => void;
    reject: (id: string) => void;
    keep: () => void;
    drop: (line: number) => void;
  },
  notes: LineMark[] = [],
): Extension {
  if (!edit) return [];

  const deleted = new Set(hunksFromDiff(edit.oldText, edit.newText).flatMap((hunk) => hunk.deleted));

  const decoField = StateField.define({
    create: (state) => buildDecorations(state, edit, notes),
    update(value, tr) {
      if (tr.docChanged) return buildDecorations(tr.state, edit, notes);
      return value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  const matchField = StateField.define({
    create: (state) => state.doc.toString() === edit.oldText,
    update(value, tr) {
      if (tr.docChanged) return tr.state.doc.toString() === edit.oldText;
      return value;
    },
  });

  const marks = gutter({
    class: "cm-aperture-diffGutter",
    lineMarker(view, line) {
      if (!view.state.field(matchField)) return null;
      const number = view.state.doc.lineAt(line.from).number;
      return deleted.has(number) ? delMarker : null;
    },
  });

  const keys = Prec.high(
    keymap.of([
      {
        key: "Enter",
        run: () => {
          handlers.keep();
          return true;
        },
      },
      {
        key: "Backspace",
        run: (view) => {
          const line = view.state.doc.lineAt(view.state.selection.main.head).number;
          handlers.drop(line);
          return true;
        },
      },
      {
        key: "Delete",
        run: (view) => {
          const line = view.state.doc.lineAt(view.state.selection.main.head).number;
          handlers.drop(line);
          return true;
        },
      },
      {
        key: "Mod-Enter",
        run: () => {
          if (edit.notes?.length) return false;
          handlers.apply(edit);
          return true;
        },
      },
      {
        key: "Mod-Backspace",
        run: () => {
          handlers.reject(edit.id);
          return true;
        },
      },
    ]),
  );

  return [decoField, matchField, marks, keys];
}
