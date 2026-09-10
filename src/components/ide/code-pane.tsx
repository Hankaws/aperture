import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, bracketMatching, foldGutter, indentOnInput, defaultHighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { languageFromPath } from "@/lib/parser/language";
import { useWorkspace } from "@/lib/workspace/store";
import { useAccount } from "@/lib/billing/use-account";
import { ghostText } from "@/lib/editor/ghost-text";
import { FileCode } from "lucide-react";

const theme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#09090b",
      color: "#f4f4f5",
      height: "100%",
      fontSize: "13px",
    },
    ".cm-scroller": { overflow: "auto", fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace' },
    ".cm-content": { caretColor: "#f4f4f5", padding: "12px 0" },
    ".cm-gutters": {
      backgroundColor: "#09090b",
      color: "#52525b",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "#18181b" },
    ".cm-activeLineGutter": { backgroundColor: "#18181b", color: "#a1a1aa" },
    ".cm-cursor": { borderLeftColor: "#f4f4f5" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#27272a",
    },
    ".cm-foldPlaceholder": {
      background: "#18181b",
      border: "none",
      color: "#a1a1aa",
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "#93c5fd" },
  { tag: t.comment, color: "#71717a", fontStyle: "italic" },
  { tag: t.string, color: "#6ee7b7" },
  { tag: t.number, color: "#e4e4e7" },
  { tag: t.bool, color: "#e4e4e7" },
  { tag: t.function(t.variableName), color: "#f4f4f5" },
  { tag: t.definition(t.variableName), color: "#f4f4f5" },
  { tag: t.typeName, color: "#a1a1aa" },
  { tag: t.propertyName, color: "#d4d4d8" },
  { tag: t.operator, color: "#a1a1aa" },
  { tag: t.heading, color: "#f4f4f5", fontWeight: "500" },
  { tag: t.link, color: "#93c5fd" },
  { tag: t.processingInstruction, color: "#71717a" },
]);

function languageExtension(path: string) {
  const lang = languageFromPath(path);
  if (lang === "typescript") return javascript({ typescript: true, jsx: path.endsWith("x") });
  if (lang === "javascript") return javascript({ jsx: path.endsWith("x") });
  if (lang === "json") return json();
  if (lang === "markdown") return markdown();
  if (lang === "python") return python();
  if (lang === "html") return html();
  if (lang === "css") return css();
  return [];
}

export function CodePane() {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValue = useRef("");
  const pathRef = useRef<string | null>(null);
  const langConf = useRef(new Compartment()).current;
  const listenerConf = useRef(new Compartment()).current;
  const ghostConf = useRef(new Compartment()).current;

  const activePath = useWorkspace((s) => s.activePath);
  const value = useWorkspace((s) => (s.activePath ? (s.files[s.activePath] ?? "") : ""));
  const writeFile = useWorkspace((s) => s.writeFile);
  const setSelection = useWorkspace((s) => s.setSelection);
  const { account } = useAccount();
  const tabOn = Boolean(account?.tab);

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return;

    const view = new EditorView({
      parent: parentRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          foldGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightSelectionMatches(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          theme,
          syntaxHighlighting(highlight),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          langConf.of(languageExtension(activePath ?? "")),
          listenerConf.of([]),
          ghostConf.of([]),
          EditorView.lineWrapping,
        ],
      }),
    });
    viewRef.current = view;
    lastValue.current = value;
    pathRef.current = activePath;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: listenerConf.reconfigure(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const next = update.state.doc.toString();
            lastValue.current = next;
            const path = pathRef.current;
            if (path) writeFile(path, next);
          }
          if (update.selectionSet) {
            const sel = update.state.selection.main;
            const fromLine = update.state.doc.lineAt(sel.from);
            const toLine = update.state.doc.lineAt(sel.to);
            const text = sel.empty
              ? fromLine.text
              : update.state.doc.sliceString(sel.from, sel.to);
            const path = pathRef.current;
            if (path) {
              setSelection({
                path,
                text,
                fromLine: fromLine.number,
                toLine: toLine.number,
              });
            }
          }
        }),
      ),
    });
  }, [setSelection, writeFile]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: ghostConf.reconfigure(tabOn ? ghostText(() => pathRef.current) : []),
    });
  }, [ghostConf, tabOn]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activePath) return;
    pathRef.current = activePath;
    view.dispatch({ effects: langConf.reconfigure(languageExtension(activePath)) });
    if (value !== lastValue.current) {
      lastValue.current = value;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [activePath, value]);

  if (!activePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg text-muted">
        <FileCode className="size-8 text-subtle" strokeWidth={1.4} />
        <p className="text-sm">Open a file from the sidebar</p>
      </div>
    );
  }

  return <div ref={parentRef} className="h-full min-h-0 bg-bg" />;
}
