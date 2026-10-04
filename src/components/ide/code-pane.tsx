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
import { toast } from "sonner";
import { applyHeldBecause } from "@/lib/workspace/checks";
import { collectMarks, lineMarkEffect, lineMarkExtension, placeMark, shownMarks } from "@/lib/editor/marks";
import { firstHunkPos, pendingDiff } from "@/lib/editor/pending-diff";
import { gotoImport } from "@/lib/editor/goto-import";
import { jumpReview } from "@/lib/editor/review-jump";
import { ED, SYN } from "@/lib/editor/theme";
import { clampSession, loadSession, saveSession } from "@/lib/editor/session";
import { stickyScroll } from "@/lib/editor/sticky-scroll";
import { minimapScrollTo, paintMinimap } from "@/lib/editor/minimap";
import { useIdeUi } from "@/lib/ui-store";
import { FileCode } from "lucide-react";

const theme = EditorView.theme(
  {
    "&": {
      backgroundColor: SYN.bg,
      color: SYN.fg,
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
    ".cm-content": { caretColor: SYN.caret, padding: "8px 0" },
    ".cm-gutters": {
      backgroundColor: SYN.gutter,
      color: SYN.gutterFg,
      border: "none",
      borderRight: `1px solid ${ED.elevated}`,
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.2rem",
      padding: "0 8px 0 6px",
    },
    ".cm-activeLine": { backgroundColor: SYN.activeLine },
    ".cm-activeLineGutter": { backgroundColor: SYN.activeLine, color: ED.activeLineGutter },
    ".cm-cursor": { borderLeftColor: SYN.caret, borderLeftWidth: "2px" },
    ".cm-selectionBackground": { backgroundColor: ED.selectionInactive },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: ED.selection },
    ".cm-selectionMatch": { backgroundColor: ED.wordRead },
    "&.cm-focused .cm-selectionMatch": { backgroundColor: ED.wordRead },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: ED.wordWrite,
      outline: `1px solid ${ED.matchBorder}`,
    },
    ".cm-nonmatchingBracket": { color: ED.danger, outline: `1px solid ${ED.danger}` },
    ".cm-foldPlaceholder": {
      background: ED.elevated,
      border: "none",
      color: ED.muted,
    },
    ".cm-tooltip": {
      backgroundColor: ED.elevated,
      border: `1px solid ${ED.border}`,
      color: SYN.fg,
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      background: ED.paletteFocus,
    },
    ".cm-inlayHint, .cm-aperture-inlay": {
      background: ED.inlayBg,
      color: ED.inlayFg,
      fontStyle: "italic",
      padding: "0 5px",
      borderRadius: "4px",
    },
    ".cm-searchMatch": { backgroundColor: ED.wordRead },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: ED.wordWrite },
    ".cm-panels": {
      backgroundColor: ED.peekBg,
      borderTop: `1px solid ${ED.peekBorder}`,
      color: ED.fg,
    },
    ".cm-lintRange-error": { textDecoration: `underline wavy ${ED.squiggleError}` },
    ".cm-lintRange-warning": { textDecoration: `underline wavy ${ED.squiggleWarn}` },
    ".cm-aperture-checkGutter .cm-gutterElement": { width: "10px", display: "flex", alignItems: "center", justifyContent: "center" },
    ".cm-aperture-check-dot": { display: "block", width: "7px", height: "7px", borderRadius: "50%", cursor: "pointer" },
    ".cm-aperture-check-error": { background: ED.squiggleError },
    ".cm-aperture-check-warning": { background: ED.squiggleWarn },
    ".cm-tooltip.cm-tooltip-hover": { maxWidth: "min(480px, 90vw)" },
    ".cm-aperture-check-tip": { padding: "4px 8px", fontSize: "12px", lineHeight: 1.5, whiteSpace: "pre-wrap" },
    ".cm-textfield": {
      background: ED.bg,
      border: `1px solid ${ED.border}`,
      color: ED.fg,
      borderRadius: "6px",
      padding: "2px 8px",
    },
    ".cm-button": {
      background: ED.elevated,
      border: `1px solid ${ED.border}`,
      color: ED.fg,
      borderRadius: "6px",
    },
    ".cm-panel.cm-search label": { fontSize: "11px", color: ED.muted },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: SYN.keyword },
  { tag: t.controlKeyword, color: SYN.keyword },
  { tag: t.moduleKeyword, color: SYN.keyword },
  { tag: t.comment, color: SYN.comment, fontStyle: "italic" },
  { tag: t.lineComment, color: SYN.comment, fontStyle: "italic" },
  { tag: t.string, color: SYN.string },
  { tag: t.number, color: SYN.number },
  { tag: t.bool, color: SYN.number },
  { tag: t.null, color: SYN.number },
  { tag: t.function(t.variableName), color: SYN.fn },
  { tag: t.function(t.propertyName), color: SYN.fn },
  { tag: t.definition(t.variableName), color: SYN.fn },
  { tag: t.definition(t.function(t.variableName)), color: SYN.fn },
  { tag: t.typeName, color: SYN.type },
  { tag: t.className, color: SYN.type },
  { tag: t.propertyName, color: SYN.property },
  { tag: t.operator, color: SYN.operator },
  { tag: t.punctuation, color: SYN.operator },
  { tag: t.tagName, color: SYN.tag },
  { tag: t.angleBracket, color: SYN.operator },
  { tag: t.attributeName, color: SYN.fn },
  { tag: t.heading, color: SYN.fg, fontWeight: "500" },
  { tag: t.link, color: SYN.keyword },
  { tag: t.url, color: SYN.keyword },
  { tag: t.processingInstruction, color: SYN.comment },
  { tag: t.meta, color: SYN.comment },
  { tag: t.invalid, color: SYN.invalid },
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
  const paintRef = useRef<(() => void) | null>(null);
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
  const tscFindings = useIdeUi((s) => s.tscFindings);
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
    const staging = pendingEdit?.path === activePath;
    // While a change is staged, real tsc has the last word on its types once it has run.
    const types =
      staging && tscFindings?.after[activePath]
        ? { after: tscFindings.after[activePath], before: tscFindings.before[activePath] ?? [] }
        : undefined;
    return collectMarks(activePath, staged, { ...files, [activePath]: staged }, staging ? files : undefined, types);
  }, [activePath, pendingEdit, value, files, tscFindings]);

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return;

    const view = new EditorView({
      parent: parentRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          // First, so its dots sit left of the line numbers.
          lineMarkExtension(),
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
          gotoImport(
            () => pathRef.current,
            () => useWorkspace.getState().files,
            (path) => useWorkspace.getState().openFile(path),
          ),
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
    paintRef.current?.();
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
          apply: (edit) => {
            const held = applyHeldBecause(useIdeUi.getState().checkHint?.state, useWorkspace.getState().agentRunning);
            if (held) {
              toast(held);
              return;
            }
            applyRef.current(edit);
          },
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
        shownMarks(view.state),
      );
    };
    paintRef.current = paint;
    paint();
    scroller.addEventListener("scroll", paint, { passive: true });
    const ro = new ResizeObserver(paint);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", paint);
      ro.disconnect();
      if (paintRef.current === paint) paintRef.current = null;
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
