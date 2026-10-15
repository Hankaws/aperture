/**
 * What the editor knows about a TypeScript name, from TypeScript itself:
 * hover a name for its type and docs; F12 or Ctrl/⌘+click to go to where it
 * is defined; F2 to rename it everywhere; completions that know the types as
 * you type; parameter hints inside a call; and Shift+Alt+O to organize imports. The answers come from the compiler's worker (tsc.ts),
 * which loads the first time anyone asks, so nobody who never asks downloads it.
 */
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { linter, openLintPanel, type Diagnostic } from "@codemirror/lint";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, showTooltip, type Tooltip } from "@codemirror/view";
import type {
  CompletionEntry,
  DefinitionTarget,
  QuickFix,
  ReferencesResult,
  RenameLocation,
  SignatureHelp,
} from "../workspace/ts-service.ts";
import { isTsPath } from "../workspace/tsc-core.ts";
import { ED, SYN } from "./theme.ts";

/** How long the pointer rests on a name before its type is asked for. */
const HOVER_MS = 350;

const tipTheme = EditorView.baseTheme({
  ".cm-aperture-ts-tip": {
    maxWidth: "min(560px, 90vw)",
    maxHeight: "320px",
    overflow: "auto",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  ".cm-aperture-ts-sig": {
    margin: 0,
    padding: "6px 10px",
    fontFamily: "var(--font-mono)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: SYN.fg,
  },
  ".cm-aperture-ts-doc": {
    padding: "6px 10px",
    borderTop: `1px solid ${ED.border}`,
    whiteSpace: "pre-wrap",
    color: ED.muted,
  },
  ".cm-aperture-ts-param": {
    fontWeight: 600,
    color: SYN.fg,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  ".cm-aperture-ts-count": {
    marginRight: "8px",
    color: ED.muted,
  },
});

/** The parameter hint: the signature with the argument being typed underlined, and its doc. */
export function signatureDom(help: SignatureHelp): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "cm-aperture-ts-tip";
  dom.setAttribute("aria-label", "Parameter hints");
  const sig = document.createElement("pre");
  sig.className = "cm-aperture-ts-sig";
  if (help.overloads > 1) {
    const count = document.createElement("span");
    count.className = "cm-aperture-ts-count";
    count.textContent = `${help.overload}/${help.overloads}`;
    sig.append(count);
  }
  sig.append(help.prefix);
  help.params.forEach((param, i) => {
    if (i > 0) sig.append(help.separator);
    if (i === help.active) {
      const strong = document.createElement("span");
      strong.className = "cm-aperture-ts-param";
      strong.textContent = param.label;
      sig.append(strong);
    } else sig.append(param.label);
  });
  sig.append(help.suffix);
  dom.append(sig);
  const active = help.params[help.active];
  const doc = [active?.doc ? `${active.label.split(/[?:]/)[0]}: ${active.doc}` : "", help.doc]
    .filter(Boolean)
    .join("\n\n");
  if (doc) {
    const text = document.createElement("div");
    text.className = "cm-aperture-ts-doc";
    text.textContent = doc;
    dom.append(text);
  }
  return dom;
}

/** The parameter hint on screen, anchored where the call's arguments start; null when none is shown. */
const setSignature = StateEffect.define<{ pos: number; help: SignatureHelp } | null>();
const signatureField = StateField.define<{ pos: number; help: SignatureHelp } | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setSignature)) return effect.value;
    return value && tr.docChanged ? { ...value, pos: tr.changes.mapPos(value.pos) } : value;
  },
  provide: (field) =>
    showTooltip.from(field, (value) =>
      value
        ? { pos: value.pos, above: true, create: () => ({ dom: signatureDom(value.help) }) }
        : null,
    ),
});

/** Typing that opens a call or moves to its next argument: the moments a parameter hint is wanted. */
const OPENS_HINT = /[(,<]/;

/** After the cursor moves inside an open hint, how long before the hint is asked again. */
const HINT_MS = 120;

function tipDom(signature: string, doc: string): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "cm-aperture-ts-tip";
  const sig = document.createElement("pre");
  sig.className = "cm-aperture-ts-sig";
  sig.textContent = signature;
  dom.append(sig);
  if (doc) {
    const text = document.createElement("div");
    text.className = "cm-aperture-ts-doc";
    text.textContent = doc;
    dom.append(text);
  }
  return dom;
}

/** TypeScript's kinds as CodeMirror's completion icons. */
const COMPLETION_TYPE: Record<string, string> = {
  method: "method",
  function: "function",
  "local function": "function",
  property: "property",
  getter: "property",
  setter: "property",
  class: "class",
  "local class": "class",
  interface: "interface",
  type: "type",
  "type parameter": "type",
  enum: "enum",
  "enum member": "enum",
  module: "namespace",
  keyword: "keyword",
  const: "constant",
};

export function completionOf(entry: CompletionEntry): Completion {
  // TypeScript sorts locals and members ("11") before globals ("15") and keywords.
  const rank = Number.parseInt(entry.sortText, 10);
  return {
    label: entry.name,
    type: COMPLETION_TYPE[entry.kind] ?? "variable",
    detail: entry.kind,
    boost: Number.isFinite(rank) ? Math.max(-99, Math.min(99, 20 - rank)) : 0,
  };
}

/** Set once TypeScript has answered a completion here: the word list then steps aside in TypeScript files. */
let typescriptCompletes = false;
export function tsCompletesHere(path: string | null): boolean {
  return typescriptCompletes && Boolean(path && isTsPath(path));
}

/** A rename that is ready for its new name: every place the name is used, and where to ask. */
export type RenameAsk = {
  path: string;
  name: string;
  locations: RenameLocation[];
  /** Where the name is on screen, to put the box under it. */
  at: { left: number; bottom: number } | null;
};

export function tsIntel(
  current: () => string | null,
  files: () => Record<string, string>,
  /** Open the definition: its file, with the name selected. */
  go: (target: DefinitionTarget) => void,
  /** Say why there is nowhere to go. */
  say: (message: string) => void,
  /** Ask for the new name of a rename TypeScript can do. */
  rename: (ask: RenameAsk) => void,
  /** How many errors the open file has; null when TypeScript has not looked at it. */
  errors: (count: number | null) => void = () => {},
  /** Apply one of TypeScript's fixes, worked out against `basis` (the files as they were then). */
  fix: (fix: QuickFix, basis: Record<string, string>) => void = () => {},
  /** Show every place a name is used. */
  references: (found: ReferencesResult) => void = () => {},
) {
  /**
   * Views someone has typed in. The compiler is a few megabytes: opening a file
   * does not download it, but typing in one, or any other question, does.
   */
  const typedIn = new WeakSet<EditorView>();

  async function problems(view: EditorView): Promise<Diagnostic[]> {
    const path = current();
    if (!path || !isTsPath(path)) {
      errors(null);
      return [];
    }
    const { tsProblems, tsReady } = await import("../workspace/tsc");
    if (!tsReady() && !typedIn.has(view)) {
      errors(null);
      return [];
    }
    const doc = view.state.doc.toString();
    const basis = { ...files(), [path]: doc };
    const found = await tsProblems(basis, path, doc);
    // Superseded by more typing, or no answer: the next run will say.
    if (found === null || view.state.doc.toString() !== doc || current() !== path) return [];
    errors(found.filter((p) => p.severity === "error").length);
    const end = view.state.doc.length;
    return found.map((p) => ({
      from: Math.min(p.start, end),
      to: Math.min(p.start + p.length, end),
      severity: p.severity,
      message: p.message,
      source: p.code,
      actions: (p.fixes ?? []).map((f) => ({ name: f.description, apply: () => fix(f, basis) })),
    }));
  }

  async function findReferences(view: EditorView, pos: number) {
    const path = ready(view, pos);
    if (!path) return;
    const { tsReferences, tsReady } = await import("../workspace/tsc");
    if (!tsReady()) say("Loading TypeScript to find references…");
    const found = await tsReferences(files(), path, view.state.doc.toString(), pos);
    if (!found) return say("Not a name TypeScript knows here.");
    if ("unavailable" in found) return say(found.unavailable);
    references(found);
  }

  const ready = (view: EditorView, pos: number) => {
    const path = current();
    if (!path || !isTsPath(path) || !view.state.wordAt(pos)) return null;
    return path;
  };

  async function goToDefinition(view: EditorView, pos: number) {
    const path = ready(view, pos);
    if (!path) return;
    const { tsDefinition, tsReady } = await import("../workspace/tsc");
    if (!tsReady()) say("Loading TypeScript to find the definition…");
    const result = await tsDefinition(files(), path, view.state.doc.toString(), pos);
    if (!result) return say("TypeScript could not answer here.");
    if ("unavailable" in result) return say(result.unavailable);
    if (result.targets[0]) return go(result.targets[0]);
    say(
      result.elsewhere
        ? "Defined outside this project, in TypeScript's standard library or a package."
        : "No definition found.",
    );
  }

  async function startRename(view: EditorView, pos: number) {
    const path = ready(view, pos);
    if (!path) return;
    const { tsRename, tsReady } = await import("../workspace/tsc");
    if (!tsReady()) say("Loading TypeScript to rename…");
    const result = await tsRename(files(), path, view.state.doc.toString(), pos);
    if (!result.ok) return say(result.reason);
    const coords = view.coordsAtPos(pos);
    rename({
      path,
      name: result.name,
      locations: result.locations,
      at: coords ? { left: coords.left, bottom: coords.bottom } : null,
    });
  }

  /** Asks for the parameter hint at the cursor; a newer ask, or a move, makes an older answer moot. */
  let hintAsk = 0;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  async function askSignature(view: EditorView, explicit: boolean) {
    const path = current();
    const seq = ++hintAsk;
    if (!path || !isTsPath(path)) return;
    const { tsSignatureHelp, tsReady } = await import("../workspace/tsc");
    const doc = view.state.doc.toString();
    const head = view.state.selection.main.head;
    const asked = tsSignatureHelp({ ...files(), [path]: doc }, path, doc, head);
    // Not loaded yet: the ask starts it; typing does not wait on a download for a hint.
    if (!tsReady() && !explicit) return;
    const help = await asked;
    if (seq !== hintAsk || current() !== path) return;
    if (view.state.doc.toString() !== doc || view.state.selection.main.head !== head) return;
    if (!help && !view.state.field(signatureField, false)) {
      if (explicit) say("Not inside a call TypeScript knows here.");
      return;
    }
    view.dispatch({
      effects: setSignature.of(
        help && help.start <= view.state.doc.length ? { pos: help.start, help } : null,
      ),
    });
  }

  async function organizeImports(view: EditorView) {
    const path = current();
    if (!path || !isTsPath(path)) return;
    const { tsOrganizeImports, tsReady } = await import("../workspace/tsc");
    if (!tsReady()) say("Loading TypeScript to organize imports…");
    const doc = view.state.doc.toString();
    const basis = { ...files(), [path]: doc };
    const changes = await tsOrganizeImports(basis, path, doc);
    if (!changes) return say("TypeScript could not answer here.");
    if ("unavailable" in changes) return say(changes.unavailable);
    if (changes.length === 0) return say("Imports are already organized.");
    fix({ description: "Organize imports", changes }, basis);
  }

  async function complete(context: CompletionContext): Promise<CompletionResult | null> {
    const path = current();
    if (!path || !isTsPath(path)) return null;
    const word = context.matchBefore(/[\w$]*/);
    const from = word ? word.from : context.pos;
    const afterDot = context.state.sliceDoc(from - 1, from) === ".";
    if (!context.explicit && !afterDot && !word?.text) return null;
    const { tsCompletions, tsReady } = await import("../workspace/tsc");
    const abort = new AbortController();
    context.addEventListener("abort", () => abort.abort());
    const asked = tsCompletions(
      files(),
      path,
      context.state.doc.toString(),
      context.pos,
      abort.signal,
    );
    // Not loaded yet: start it, and let the word list answer this time rather than make typing wait.
    if (!tsReady()) return null;
    const list = await asked;
    if (!list || context.aborted) return null;
    typescriptCompletes = true;
    const entries = list.member ? list.entries.filter((e) => e.kind !== "keyword") : list.entries;
    if (entries.length === 0) return null;
    return { from, options: entries.map(completionOf), validFor: /^[\w$]*$/ };
  }

  return [
    tipTheme,
    EditorView.updateListener.of((update) => {
      if (update.transactions.some((tr) => tr.isUserEvent("input") || tr.isUserEvent("delete")))
        typedIn.add(update.view);
      // Typing "(" or "," asks at once; while a hint is up, any edit or move asks again (and may close it).
      const opened = update.transactions.some((tr) => {
        if (!tr.isUserEvent("input")) return false;
        let found = false;
        tr.changes.iterChanges((_fa, _ta, _fb, _tb, inserted) => {
          if (OPENS_HINT.test(inserted.toString())) found = true;
        });
        return found;
      });
      const shown = update.state.field(signatureField, false);
      if (opened) {
        clearTimeout(hintTimer);
        void askSignature(update.view, false);
      } else if (shown && (update.docChanged || update.selectionSet)) {
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => void askSignature(update.view, false), HINT_MS);
      }
      // Another file in this view: its hint no longer applies.
      if (shown && update.transactions.some((tr) => tr.reconfigured)) {
        hintAsk++;
        queueMicrotask(() => update.view.dispatch({ effects: setSignature.of(null) }));
      }
    }),
    signatureField,
    // A moment after typing stops; each run checks the open file only, against the rest as saved in the store.
    linter(problems, { delay: 600 }),
    EditorState.languageData.of(() => [{ autocomplete: complete }]),
    hoverTooltip(
      async (view, pos): Promise<Tooltip | null> => {
        const path = ready(view, pos);
        if (!path) return null;
        const { tsHover, tsReady } = await import("../workspace/tsc");
        const asked = tsHover(files(), path, view.state.doc.toString(), pos);
        if (!tsReady()) {
          // The first question loads the compiler, which takes seconds: say so at once, then answer.
          const word = view.state.wordAt(pos)!;
          return {
            pos: word.from,
            end: word.to,
            above: true,
            create: () => {
              const dom = tipDom(
                "Loading TypeScript…",
                "The first time only: the compiler is a few megabytes.",
              );
              void asked.then((info) => {
                dom.replaceChildren(
                  ...tipDom(info?.signature ?? "No type information here.", info?.doc ?? "")
                    .childNodes,
                );
                view.requestMeasure();
              });
              return { dom };
            },
          };
        }
        const info = await asked;
        if (!info || info.start + info.length > view.state.doc.length) return null;
        return {
          pos: info.start,
          end: info.start + info.length,
          above: true,
          create: () => ({ dom: tipDom(info.signature, info.doc) }),
        };
      },
      { hoverTime: HOVER_MS },
    ),
    // After the relative-import handler: Ctrl/⌘+click on an import path still opens that file.
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!event.metaKey && !event.ctrlKey) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null || !ready(view, pos)) return false;
        event.preventDefault();
        void goToDefinition(view, pos);
        return true;
      },
    }),
    keymap.of([
      {
        key: "Escape",
        run: (view) => {
          if (!view.state.field(signatureField, false)) return false;
          hintAsk++;
          view.dispatch({ effects: setSignature.of(null) });
          return true;
        },
      },
      {
        key: "Mod-Shift-Space",
        run: (view) => {
          if (!current() || !isTsPath(current()!)) return false;
          void askSignature(view, true);
          return true;
        },
      },
      {
        key: "Shift-Alt-o",
        run: (view) => {
          if (!current() || !isTsPath(current()!)) return false;
          void organizeImports(view);
          return true;
        },
      },
      {
        key: "Shift-F12",
        run: (view) => {
          const pos = view.state.selection.main.head;
          if (!ready(view, pos)) return false;
          void findReferences(view, pos);
          return true;
        },
      },
      // The file's problems, with TypeScript's fixes as buttons: the keyboard's way to a fix.
      { key: "Mod-.", run: openLintPanel },
      {
        key: "F2",
        run: (view) => {
          const pos = view.state.selection.main.head;
          if (!ready(view, pos)) return false;
          void startRename(view, pos);
          return true;
        },
      },
      {
        key: "F12",
        run: (view) => {
          const pos = view.state.selection.main.head;
          if (!ready(view, pos)) return false;
          void goToDefinition(view, pos);
          return true;
        },
      },
    ]),
  ];
}
