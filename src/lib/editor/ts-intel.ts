/**
 * What the editor knows about a TypeScript name, from TypeScript itself:
 * hover a name for its type and docs; F12 or Ctrl/⌘+click to go to where it
 * is defined. The answers come from the compiler's worker (tsc.ts), which
 * loads the first time anyone asks, so nobody who never hovers downloads it.
 */
import { EditorView, hoverTooltip, keymap, type Tooltip } from "@codemirror/view";
import type { DefinitionTarget } from "../workspace/ts-service.ts";
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

export function tsIntel(
  current: () => string | null,
  files: () => Record<string, string>,
  /** Open the definition: its file, with the name selected. */
  go: (target: DefinitionTarget) => void,
  /** Say why there is nowhere to go. */
  say: (message: string) => void,
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

  return [
    tipTheme,
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
