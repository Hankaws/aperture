/**
 * What the editor knows about a TypeScript name, from TypeScript itself:
 * hover a name for its type and docs; F12 or Ctrl/⌘+click to go to where it
 * is defined; F2 to rename it everywhere; and completions that know the
 * types as you type. The answers come from the compiler's worker (tsc.ts),
 * which loads the first time anyone asks, so nobody who never asks downloads it.
 */
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, type Tooltip } from "@codemirror/view";
import type { CompletionEntry, DefinitionTarget, RenameLocation } from "../workspace/ts-service.ts";
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
});

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
) {
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
