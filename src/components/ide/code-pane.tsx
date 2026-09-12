import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment, Annotation } from "@codemirror/state";
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
import { pendingEditFor } from "@/lib/workspace/edits";
import { useAccount } from "@/lib/billing/use-account";
import { ghostText } from "@/lib/editor/ghost-text";
import { firstHunkPos, pendingDiff } from "@/lib/editor/pending-diff";
import { SYNTAX } from "@/lib/editor/theme";
import { useIdeUi } from "@/lib/ui-store";
import { FileCode } from "lucide-react";

const theme = EditorView.theme(
  {
    "&": {
      backgroundColor: SYNTAX.bg,
      color: SYNTAX.fg,
      height: "100%",
      fontSize: "14px",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
      lineHeight: "1.7",
    },
    ".cm-content": { caretColor: SYNTAX.caret, padding: "12px 0" },
    ".cm-gutters": {
      backgroundColor: SYNTAX.gutter,
      color: SYNTAX.gutterFg,
      border: "none",
      borderRight: "1px solid #18181b",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.6rem",
      padding: "0 10px 0 8px",
    },
    ".cm-activeLine": { backgroundColor: SYNTAX.activeLine },
    ".cm-activeLineGutter": { backgroundColor: SYNTAX.activeLine, color: "#c4c4cc" },
    ".cm-cursor": { borderLeftColor: SYNTAX.caret, borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "color-mix(in oklab, var(--color-ok) 34%, transparent)",
    },
    ".cm-selectionMatch": { backgroundColor: SYNTAX.match },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: SYNTAX.match,
      outline: "1px solid #8bb4e3",
    },
    ".cm-foldPlaceholder": {
      background: "#18181b",
      border: "none",
      color: "#a1a1aa",
    },
    ".cm-tooltip": {
      backgroundColor: "#18181b",
      border: "1px solid #27272a",
      color: SYNTAX.fg,
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: SYNTAX.keyword },
  { tag: t.controlKeyword, color: SYNTAX.keyword },
  { tag: t.moduleKeyword, color: SYNTAX.keyword },
  { tag: t.comment, color: SYNTAX.comment, fontStyle: "italic" },
  { tag: t.lineComment, color: SYNTAX.comment, fontStyle: "italic" },
  { tag: t.string, color: SYNTAX.string },
  { tag: t.number, color: SYNTAX.number },
  { tag: t.bool, color: SYNTAX.number },
  { tag: t.null, color: SYNTAX.number },
  { tag: t.function(t.variableName), color: SYNTAX.fn },
  { tag: t.function(t.propertyName), color: SYNTAX.fn },
  { tag: t.definition(t.variableName), color: SYNTAX.fn },
  { tag: t.definition(t.function(t.variableName)), color: SYNTAX.fn },
  { tag: t.typeName, color: SYNTAX.type },
  { tag: t.className, color: SYNTAX.type },
  { tag: t.propertyName, color: SYNTAX.property },
  { tag: t.operator, color: SYNTAX.operator },
  { tag: t.punctuation, color: SYNTAX.operator },
  { tag: t.tagName, color: SYNTAX.tag },
  { tag: t.angleBracket, color: SYNTAX.operator },
  { tag: t.attributeName, color: SYNTAX.fn },
  { tag: t.heading, color: SYNTAX.fg, fontWeight: "500" },
  { tag: t.link, color: SYNTAX.keyword },
  { tag: t.url, color: SYNTAX.keyword },
  { tag: t.processingInstruction, color: SYNTAX.comment },
  { tag: t.meta, color: SYNTAX.comment },
  { tag: t.invalid, color: SYNTAX.invalid },
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

const syncAnn = Annotation.define<boolean>();

export function CodePane() {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValue = useRef("");
  const pathRef = useRef<string | null>(null);
  const writeFileRef = useRef(useWorkspace.getState().writeFile);
  const setSelectionRef = useRef(useWorkspace.getState().setSelection);
  const applyRef = useRef(useWorkspace.getState().applyEdit);
  const rejectRef = useRef(useWorkspace.getState().rejectEdit);
  const langConf = useRef(new Compartment()).current;
  const listenerConf = useRef(new Compartment()).current;
  const ghostConf = useRef(new Compartment()).current;
  const diffConf = useRef(new Compartment()).current;
  const scrolledFor = useRef<string | null>(null);
  const jumpedFor = useRef<string | null>(null);

  const activePath = useWorkspace((s) => s.activePath);
  const value = useWorkspace((s) => (s.activePath ? (s.files[s.activePath] ?? "") : ""));
  const pendingEdit = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
  const writeFile = useWorkspace((s) => s.writeFile);
  const setSelection = useWorkspace((s) => s.setSelection);
  const applyEdit = useWorkspace((s) => s.applyEdit);
  const rejectEdit = useWorkspace((s) => s.rejectEdit);
  const { account } = useAccount();
  const tabOn = Boolean(account?.tab) && !pendingEdit;
  writeFileRef.current = writeFile;
  setSelectionRef.current = setSelection;
  applyRef.current = applyEdit;
  rejectRef.current = rejectEdit;

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
          listenerConf.of(
            EditorView.updateListener.of((update) => {
              if (update.transactions.some((tr) => tr.annotation(syncAnn))) {
                if (update.docChanged) lastValue.current = update.state.doc.toString();
                return;
              }
              if (update.docChanged) {
                const next = update.state.doc.toString();
                lastValue.current = next;
                const path = pathRef.current;
                if (path) writeFileRef.current(path, next);
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
                  setSelectionRef.current({
                    path,
                    text,
                    fromLine: fromLine.number,
                    toLine: toLine.number,
                    empty: sel.empty,
                  });
                }
              }
            }),
          ),
          ghostConf.of([]),
          diffConf.of([]),
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
      effects: ghostConf.reconfigure(tabOn ? ghostText(() => pathRef.current) : []),
      annotations: syncAnn.of(true),
    });
  }, [tabOn]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activePath) return;
    pathRef.current = activePath;
    const effects = [langConf.reconfigure(languageExtension(activePath))];
    if (value !== lastValue.current) {
      lastValue.current = value;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        effects,
        annotations: syncAnn.of(true),
      });
      return;
    }
    view.dispatch({
      effects,
      annotations: syncAnn.of(true),
    });
  }, [activePath, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: diffConf.reconfigure(
        pendingDiff(pendingEdit, {
          apply: (edit) => applyRef.current(edit),
          reject: (id) => rejectRef.current(id),
        }),
      ),
      annotations: syncAnn.of(true),
    });
  }, [pendingEdit]);

  useEffect(() => {
    if (!pendingEdit) {
      scrolledFor.current = null;
      return;
    }
    if (pendingEdit.id === scrolledFor.current) return;
    if (value !== pendingEdit.oldText) return;
    const id = pendingEdit.id;
    const timer = window.setTimeout(() => {
      const live = viewRef.current;
      if (!live) return;
      const still = pendingEditFor(useWorkspace.getState().messages, pathRef.current);
      if (!still || still.id !== id) return;
      const pos = firstHunkPos(still, live.state.doc.lines, (n) => live.state.doc.line(n).from);
      if (pos == null) return;
      scrolledFor.current = id;
      live.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 36 }),
        annotations: syncAnn.of(true),
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pendingEdit, value]);

  useEffect(() => {
    if (!pendingEdit) {
      jumpedFor.current = null;
      return;
    }
    if (jumpedFor.current === pendingEdit.id) return;
    jumpedFor.current = pendingEdit.id;
    useIdeUi.getState().setMobilePane("editor");
  }, [pendingEdit]);

  return (
    <div className="relative h-full min-h-0 bg-bg">
      {!activePath && (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
          <FileCode className="size-8 text-subtle" strokeWidth={1.4} />
          <div>
            <p className="text-sm font-medium text-fg">Open a file to start</p>
            <p className="mt-1 max-w-xs text-sm text-pretty text-muted">
              Click a file on the left. Or ask Agent on the right — it plans first, then waits.
            </p>
          </div>
        </div>
      )}
      <div ref={parentRef} className={activePath ? "h-full min-h-0" : "hidden"} />
    </div>
  );
}
