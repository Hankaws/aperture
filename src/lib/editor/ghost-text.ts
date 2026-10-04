import { Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type ViewUpdate } from "@codemirror/view";
import { requestTabCompletion } from "@/lib/agent/tab";
import { ED } from "@/lib/editor/theme";
import { useIdeUi } from "@/lib/ui-store";
import { takeGhostWord } from "./ghost-word";
class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: GhostWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-aperture-ghost";
    span.textContent = this.text.split("\n").slice(0, 8).join("\n");
    return span;
  }
}

const setGhost = StateEffect.define<string | null>();

const ghostField = StateField.define<string | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGhost)) return effect.value;
    }
    if (tr.docChanged) return null;
    return value;
  },
});

function ghostDecorations(view: EditorView, text: string | null) {
  if (!text) return Decoration.none;
  const pos = view.state.selection.main.head;
  return Decoration.set([Decoration.widget({ widget: new GhostWidget(text), side: 1 }).range(pos)]);
}

const ghostTheme = EditorView.theme({
  ".cm-aperture-ghost": {
    color: ED.ghost,
    fontStyle: "italic",
    pointerEvents: "none",
    opacity: "0.85",
    whiteSpace: "pre",
    display: "inline-block",
    verticalAlign: "text-top",
  },
});

const clientCache = new Map<string, string>();
const CLIENT_CACHE_MAX = 80;

function clientGet(key: string): string | undefined {
  const hit = clientCache.get(key);
  if (hit === undefined) return undefined;
  clientCache.delete(key);
  clientCache.set(key, hit);
  return hit;
}

function clientSet(key: string, text: string) {
  clientCache.set(key, text);
  while (clientCache.size > CLIENT_CACHE_MAX) {
    const first = clientCache.keys().next().value;
    if (first === undefined) break;
    clientCache.delete(first);
  }
}

export function ghostText(path: () => string | null): Extension[] {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;
  let lastKey = "";

  const plugin = ViewPlugin.fromClass(
    class {
      decorations = Decoration.none;
      constructor(readonly view: EditorView) {}
      update(update: ViewUpdate) {
        this.decorations = ghostDecorations(update.view, update.state.field(ghostField));
        if (!update.docChanged && !update.selectionSet) return;
        if (!update.state.selection.main.empty) return;
        if (timer) clearTimeout(timer);
        inflight?.abort();
        timer = setTimeout(() => {
          void this.request();
        }, 280);
      }
      async request() {
        const filePath = path();
        if (!filePath) return;
        const state = this.view.state;
        const pos = state.selection.main.head;
        if (!state.selection.main.empty) return;
        if (state.doc.length < 12 || pos < 2) return;
        const prefix = state.doc.sliceString(Math.max(0, pos - 2400), pos);
        const suffix = state.doc.sliceString(pos, Math.min(state.doc.length, pos + 280));
        const key = `${filePath}:${prefix.slice(-100)}:${suffix.slice(0, 24)}`;
        if (key === lastKey) return;
        const cached = clientGet(key);
        if (cached !== undefined) {
          lastKey = key;
          if (cached) this.view.dispatch({ effects: setGhost.of(cached) });
          return;
        }
        inflight?.abort();
        const abort = new AbortController();
        inflight = abort;
        try {
          const result = await requestTabCompletion({ path: filePath, prefix, suffix }, abort.signal);
          if (abort.signal.aborted) return;
          if (this.view.state.selection.main.head !== pos) return;
          lastKey = key;
          const next = result.text ?? "";
          if (result.reason) {
            useIdeUi.getState().setTabNote(result.reason);
            return;
          }
          clientSet(key, next);
          useIdeUi.getState().setTabNote(null);
          if (!next) return;
          this.view.dispatch({ effects: setGhost.of(next) });
        } catch {
          if (abort.signal.aborted) return;
          useIdeUi.getState().setTabNote("Tab did not answer.");
        }
      }
      destroy() {
        if (timer) clearTimeout(timer);
        inflight?.abort();
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );

  const accept = keymap.of([
    {
      key: "Tab",
      run: (view) => {
        const ghost = view.state.field(ghostField);
        if (!ghost) return false;
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: ghost },
          selection: { anchor: pos + ghost.length },
          effects: setGhost.of(null),
        });
        return true;
      },
    },
    {
      key: "Ctrl-ArrowRight",
      mac: "Cmd-ArrowRight",
      run: (view) => {
        const ghost = view.state.field(ghostField);
        if (!ghost) return false;
        const { take, rest } = takeGhostWord(ghost);
        if (!take) return false;
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: take },
          selection: { anchor: pos + take.length },
          effects: setGhost.of(rest.length ? rest : null),
        });
        return true;
      },
    },
    {
      key: "Escape",
      run: (view) => {
        if (!view.state.field(ghostField)) return false;
        view.dispatch({ effects: setGhost.of(null) });
        return true;
      },
    },
  ]);

  return [ghostField, plugin, ghostTheme, Prec.high(accept)];
}
