import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

const DECL =
  /^\s*(export\s+)?(default\s+)?(async\s+)?(function\*?|class|const|let|var|type|interface|enum|def|async def)\b/;

export function stickyLine(
  doc: { lines: number; line: (n: number) => { number: number; text: string } },
  fromLine: number,
): { number: number; text: string } | null {
  const floor = Math.max(1, fromLine - 80);
  for (let n = fromLine; n >= floor; n -= 1) {
    const line = doc.line(n);
    if (DECL.test(line.text)) return { number: line.number, text: line.text.trimEnd() };
  }
  return null;
}

export function stickyScroll() {
  return ViewPlugin.fromClass(
    class {
      readonly dom: HTMLDivElement;
      readonly onScroll: () => void;
      raf = 0;
      constructor(readonly view: EditorView) {
        this.dom = document.createElement("div");
        this.dom.className = "cm-aperture-sticky";
        this.dom.hidden = true;
        this.dom.setAttribute("aria-hidden", "true");
        view.dom.appendChild(this.dom);
        this.onScroll = () => this.schedule(view);
        view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
        this.schedule(view);
      }
      update(update: ViewUpdate) {
        if (update.viewportChanged || update.docChanged || update.geometryChanged) this.schedule(update.view);
      }
      schedule(view: EditorView) {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(() => this.sync(view));
      }
      sync(view: EditorView) {
        const height = view.scrollDOM.scrollTop + 4;
        const block = view.lineBlockAtHeight(height);
        const vis = view.state.doc.lineAt(block.from);
        const found = stickyLine(view.state.doc, vis.number);
        if (!found || found.number >= vis.number) {
          this.dom.hidden = true;
          this.dom.textContent = "";
          return;
        }
        this.dom.hidden = false;
        this.dom.textContent = found.text;
      }
      destroy() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.dom.remove();
      }
    },
  );
}
