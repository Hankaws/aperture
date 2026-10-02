import { useEffect, useMemo, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment, Annotation } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, bracketMatching, foldGutter, indentOnInput, defaultHighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
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
import { pendingForRun } from "@/lib/workspace/copies";
import { useAccount } from "@/lib/billing/use-account";
import { ghostText } from "@/lib/editor/ghost-text";
import { workspaceComplete } from "@/lib/editor/workspace-complete";
import { collectMarks, lineMarkEffect, lineMarkExtension, placeMark } from "@/lib/editor/marks";
import { firstHunkPos, pendingDiff } from "@/lib/editor/pending-diff";
import { jumpReview } from "@/lib/editor/review-jump";
import { EDITOR, SYNTAX } from "@/lib/editor/theme";
import { clampSession, loadSession, saveSession } from "@/lib/editor/session";
import { stickyScroll } from "@/lib/editor/sticky-scroll";
import { minimapScrollTo, paintMinimap } from "@/lib/editor/minimap";
import { useIdeUi } from "@/lib/ui-store";
import { FileCode } from "lucide-react";

const theme = EditorView.theme(
  {
    "&": {
      backgroundColor: SYNTAX.bg,
      color: SYNTAX.fg,
      height: "100%",
      fontSize: "13px",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "var(--font-mono)",
      fontKerning: "none",
      fontVariantLigatures: "none",
      fontFeatureSettings: '"liga" 0, "calt" 0, "kern" 0',
      lineHeight: "1.5",
      tabSize: 2,
    },
    ".cm-content": { caretColor: SYNTAX.caret, padding: "8px 0" },
    ".cm-gutters": {
      backgroundColor: SYNTAX.gutter,
      color: SYNTAX.gutterFg,
      border: "none",
      borderRight: `1px solid ${EDITOR.elevated}`,
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.2rem",
      padding: "0 8px 0 6px",
    },
    ".cm-activeLine": { backgroundColor: SYNTAX.activeLine },
    ".cm-activeLineGutter": { backgroundColor: SYNTAX.activeLine, color: EDITOR.activeLineGutter },
    ".cm-cursor": { borderLeftColor: SYNTAX.caret, borderLeftWidth: "2px" },
    ".cm-selectionBackground": { backgroundColor: EDITOR.selectionInactive },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: EDITOR.selection },
    ".cm-selectionMatch": { backgroundColor: EDITOR.wordRead },
    "&.cm-focused .cm-selectionMatch": { backgroundColor: EDITOR.wordRead },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: EDITOR.wordWrite,
      outline: `1px solid ${EDITOR.matchBorder}`,
    },
    ".cm-nonmatchingBracket": { color: EDITOR.danger, outline: `1px solid ${EDITOR.danger}` },
    ".cm-foldPlaceholder": {
      background: EDITOR.elevated,
      border: "none",
      color: EDITOR.muted,
    },
    ".cm-tooltip": {
      backgroundColor: EDITOR.elevated,
      border: `1px solid ${EDITOR.border}`,
      color: SYNTAX.fg,
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      background: EDITOR.paletteFocus,
    },
    ".cm-inlayHint, .cm-aperture-inlay": {
      background: EDITOR.inlayBg,
      color: EDITOR.inlayFg,
      fontStyle: "italic",
      padding: "0 5px",
      borderRadius: "4px",
    },
    ".cm-searchMatch": { backgroundColor: EDITOR.wordRead },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: EDITOR.wordWrite },
    ".cm-panels": {
      backgroundColor: EDITOR.peekBg,
      borderTop: `1px solid ${EDITOR.peekBorder}`,
      color: EDITOR.fg,
    },
    ".cm-lintRange-error": { textDecoration: `underline wavy ${EDITOR.squiggleError}` },
    ".cm-lintRange-warning": { textDecoration: `underline wavy ${EDITOR.squiggleWarn}` },
    ".cm-textfield": {
      background: EDITOR.bg,
      border: `1px solid ${EDITOR.border}`,
      color: EDITOR.fg,
      borderRadius: "6px",
      padding: "2px 8px",
    },
    ".cm-button": {
      background: EDITOR.elevated,
      border: `1px solid ${EDITOR.border}`,
      color: EDITOR.fg,
      borderRadius: "6px",
    },
    ".cm-panel.cm-search label": { fontSize: "11px", color: EDITOR.muted },
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

function languageKey(path: string) {
  const lang = languageFromPath(path);
  return `${lang}:${path.endsWith("x") ? "x" : ""}`;
}

function pendingKeyOf(edit: { id: string; newText: string; oldText: string; notes?: unknown[] } | null) {
  if (!edit) return "";
  return `${edit.id}:${edit.oldText.length}:${edit.newText.length}:${edit.notes?.length ?? 0}`;
}

const syncAnn = Annotation.define<boolean>();

export function CodePane() {
  const parentRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValue = useRef("");
  const pathRef = useRef<string | null>(null);
  const chunksRef = useRef(useWorkspace.getState().chunks);
  const writeFileRef = useRef(useWorkspace.getState().writeFile);
  const setSelectionRef = useRef(useWorkspace.getState().setSelection);
  const applyRef = useRef(useWorkspace.getState().applyEdit);
  const rejectRef = useRef(useWorkspace.getState().rejectEdit);
  const langConf = useRef(new Compartment()).current;
  const listenerConf = useRef(new Compartment()).current;
  const ghostConf = useRef(new Compartment()).current;
  const diffConf = useRef(new Compartment()).current;
  const wrapConf = useRef(new Compartment()).current;
  const narrowRef = useRef(false);
  const scrolledFor = useRef<string | null>(null);
  const jumpedFor = useRef<string | null>(null);
  const langKeyRef = useRef("");
  const ghostOnRef = useRef(false);
  const diffKeyRef = useRef("");

  const activePath = useWorkspace((s) => s.activePath);
  const chunks = useWorkspace((s) => s.chunks);
  const value = useWorkspace((s) => (s.activePath ? (s.files[s.activePath] ?? "") : ""));
  const pendingEdit = useWorkspace((s) => {
    const visible = pendingForRun(
      s.messages.flatMap((m) => m.edits ?? []),
      undefined,
      s.activeCopyId,
    );
    const ids = new Set(visible.map((edit) => edit.id));
    return pendingEditFor(
      s.messages.map((m) => ({ ...m, edits: m.edits?.filter((edit) => ids.has(edit.id)) })),
      s.activePath,
    );
  });
  const writeFile = useWorkspace((s) => s.writeFile);
  const files = useWorkspace((s) => s.files);
  const setSelection = useWorkspace((s) => s.setSelection);
  const applyEdit = useWorkspace((s) => s.applyEdit);
  const rejectEdit = useWorkspace((s) => s.rejectEdit);
  const pendingRef = useRef(pendingEdit);
  const { account } = useAccount();
  const reveal = useIdeUi((s) => s.reveal);
  const findTick = useIdeUi((s) => s.findTick);
  const tabOn = Boolean(account?.tab) && !pendingEdit;
  chunksRef.current = chunks;
  writeFileRef.current = writeFile;
  setSelectionRef.current = setSelection;
  applyRef.current = applyEdit;
  rejectRef.current = rejectEdit;
  pendingRef.current = pendingEdit;
  const lintMarks = useMemo(() => {
    if (!activePath) return [];
    const staged = pendingEdit?.path === activePath ? pendingEdit.newText : value;
    return collectMarks(activePath, staged, { ...files, [activePath]: staged });
  }, [activePath, pendingEdit, value, files]);

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
          autocompletion({ activateOnTyping: true }),
          workspaceComplete(() => chunksRef.current, () => pathRef.current),
          highlightSelectionMatches({ highlightWordAroundCursor: true }),
          stickyScroll(),
          lineMarkExtension(),
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
          wrapConf.of(
            (parentRef.current?.clientWidth ?? 9999) < 480 || languageFromPath(activePath ?? "") === "markdown"
              ? EditorView.lineWrapping
              : [],
          ),
        ],
      }),
    });
    viewRef.current = view;
    lastValue.current = value;
    pathRef.current = activePath;
    langKeyRef.current = languageKey(activePath ?? "");
    narrowRef.current = (parentRef.current?.clientWidth ?? 9999) < 480;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const apply = (width: number) => {
      const narrow = width > 0 && width < 480;
      if (narrowRef.current === narrow) return;
      narrowRef.current = narrow;
      const view = viewRef.current;
      if (!view) return;
      const path = pathRef.current ?? "";
      view.dispatch({
        effects: wrapConf.reconfigure(
          narrow || languageFromPath(path) === "markdown" ? EditorView.lineWrapping : [],
        ),
        annotations: syncAnn.of(true),
      });
    };
    apply(parent.clientWidth);
    const observer = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? 0));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [wrapConf]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (ghostOnRef.current === tabOn) return;
    ghostOnRef.current = tabOn;
    view.dispatch({
      effects: ghostConf.reconfigure(tabOn ? ghostText(() => pathRef.current) : []),
      annotations: syncAnn.of(true),
    });
  }, [tabOn, ghostConf]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activePath) return;
    const prev = pathRef.current;
    const pathChanged = Boolean(prev && prev !== activePath);
    if (pathChanged && prev) {
      const sel = view.state.selection.main;
      saveSession(prev, { anchor: sel.anchor, head: sel.head, scrollTop: view.scrollDOM.scrollTop });
    }
    pathRef.current = activePath;
    const nextLang = languageKey(activePath);
    const langChanged = langKeyRef.current !== nextLang;
    if (langChanged) langKeyRef.current = nextLang;
    const wrap =
      narrowRef.current || languageFromPath(activePath) === "markdown" ? EditorView.lineWrapping : [];
    const effects = langChanged
      ? [langConf.reconfigure(languageExtension(activePath)), wrapConf.reconfigure(wrap)]
      : [];
    if (value !== lastValue.current) {
      lastValue.current = value;
      const current = view.state.selection.main;
      const saved = pathChanged ? loadSession(activePath) : undefined;
      const sel = clampSession(
        saved ?? {
          anchor: pathChanged ? 0 : current.anchor,
          head: pathChanged ? 0 : current.head,
          scrollTop: pathChanged ? 0 : view.scrollDOM.scrollTop,
        },
        value.length,
      );
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        selection: { anchor: sel.anchor, head: sel.head },
        effects,
        annotations: syncAnn.of(true),
      });
      if (saved) {
        requestAnimationFrame(() => {
          if (viewRef.current === view) view.scrollDOM.scrollTop = sel.scrollTop;
        });
      }
      return;
    }
    if (effects.length === 0) return;
    view.dispatch({
      effects,
      annotations: syncAnn.of(true),
    });
  }, [activePath, value, langConf, wrapConf]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activePath) return;
    const doc = view.state.doc.toString();
    const staged = pendingEdit?.path === activePath ? pendingEdit.newText : doc;
    const shown =
      doc === staged
        ? lintMarks
        : pendingEdit && doc === pendingEdit.oldText
          ? lintMarks.flatMap((mark) => {
              const place = placeMark(pendingEdit.oldText, pendingEdit.newText, mark.line);
              return place && "oldLine" in place ? [{ ...mark, line: place.oldLine }] : [];
            })
          : [];
    view.dispatch({ effects: lineMarkEffect(shown), annotations: syncAnn.of(true) });
  }, [lintMarks, pendingEdit, activePath, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const key = `${pendingKeyOf(pendingEdit)}:${lintMarks.map((mark) => `${mark.line}:${mark.message}`).join("|")}`;
    if (diffKeyRef.current === key) return;
    diffKeyRef.current = key;
    view.dispatch({
      effects: diffConf.reconfigure(
        pendingDiff(pendingEdit, {
          apply: (edit) => applyRef.current(edit),
          reject: (id) => rejectRef.current(id),
          keep: () => jumpReview(1),
          drop: (line) => {
            const edit = pendingRef.current;
            if (!edit) return;
            useWorkspace.getState().dropHunkAt(edit.id, line);
            jumpReview(1);
          },
        }, lintMarks),
      ),
      annotations: syncAnn.of(true),
    });
  }, [pendingEdit, lintMarks, diffConf]);

  useEffect(() => {
    if (!pendingEdit) {
      jumpedFor.current = null;
      return;
    }
    if (jumpedFor.current === pendingEdit.id) return;
    jumpedFor.current = pendingEdit.id;
    const ui = useIdeUi.getState();
    if (ui.mobilePane !== "editor") ui.setMobilePane("editor");
  }, [pendingEdit]);

  useEffect(() => {
    const view = viewRef.current;
    const host = miniRef.current;
    if (!view || !host || !activePath) return;
    const scroller = view.scrollDOM;
    const paint = () => {
      paintMinimap(
        host,
        view.state.doc.toString(),
        scroller.scrollTop,
        scroller.clientHeight,
        scroller.scrollHeight,
      );
    };
    paint();
    scroller.addEventListener("scroll", paint, { passive: true });
    const ro = new ResizeObserver(paint);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", paint);
      ro.disconnect();
    };
  }, [activePath, value]);

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
      const ws = useWorkspace.getState();
      const visible = pendingForRun(
        ws.messages.flatMap((m) => m.edits ?? []),
        undefined,
        ws.activeCopyId,
      );
      const still = visible.find((edit) => edit.id === id);
      if (!still) return;
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
    const view = viewRef.current;
    if (!view || !reveal || reveal.path !== activePath) return;
    const line = Math.min(Math.max(1, reveal.line), view.state.doc.lines);
    const pos = view.state.doc.line(line).from;
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
      annotations: syncAnn.of(true),
    });
    useIdeUi.getState().setReveal(null);
  }, [reveal, activePath]);

  useEffect(() => {
    if (!findTick) return;
    const view = viewRef.current;
    if (view) openSearchPanel(view);
  }, [findTick]);

  return (
    <div className="editor-stage relative flex h-full min-h-0 bg-bg">
      {!activePath && (
        <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted">
          <FileCode className="size-8 text-subtle" strokeWidth={1.4} />
          <div>
            <p className="text-sm font-medium text-fg">Open a file to start</p>
            <p className="mt-1 max-w-xs text-sm text-pretty text-muted">
              Click a file on the left. Or ask Composer on the right — it plans first, then waits.
            </p>
          </div>
        </div>
      )}
      <div ref={parentRef} className={activePath ? "h-full min-h-0 min-w-0 flex-1" : "hidden"} />
      {activePath ? (
        <div
          ref={miniRef}
          className="aperture-minimap hidden h-full w-10 shrink-0 cursor-pointer border-l border-border md:block"
          aria-hidden="true"
          onPointerDown={(e) => {
            const view = viewRef.current;
            const host = miniRef.current;
            if (!view || !host) return;
            view.scrollDOM.scrollTop = minimapScrollTo(host, e.clientY, view.scrollDOM.scrollHeight);
          }}
        />
      ) : null}
    </div>
  );
}
