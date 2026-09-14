export type DesignCapture = {
  id: string;
  path: string;
  selector: string;
  tag: string;
  text: string;
  html: string;
  neighborhood: string;
  css: string;
  bounds: { x: number; y: number; w: number; h: number };
  screenshot: string | null;
  source: string | null;
  note: string;
};

export const PREVIEW_HTML_PATH = "preview.html";
export const PREVIEW_CSS_PATH = "preview.css";

export const STARTER_PREVIEW_CSS = `:root {
  --bg: #0b0b0e;
  --card: #121214;
  --line: #1f1f24;
  --fg: #e8e8ed;
  --muted: #8b8b93;
  --accent: #3b9eff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 14px/1.45 ui-sans-serif, system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}
.cta {
  border: 0;
  background: var(--accent);
  color: #061018;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.list { margin: 0; padding: 16px; display: grid; gap: 10px; }
.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.card button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}
`;

export const STARTER_PREVIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>harbor-api</title>
    <link rel="stylesheet" href="preview.css" />
  </head>
  <body>
    <header class="top">
      <strong>harbor-api</strong>
      <button class="cta" type="button">Create task</button>
    </header>
    <ul class="list">
      <li class="card"><span>Fix listTasks off-by-one</span><button type="button">Done</button></li>
      <li class="card"><span>Return 404 from getTask</span><button type="button">Done</button></li>
      <li class="card"><span>Reject long titles</span><button type="button">Done</button></li>
    </ul>
  </body>
</html>
`;

export function htmlFiles(files: Record<string, string>): string[] {
  return Object.keys(files)
    .filter((path) => /\.html?$/i.test(path))
    .sort();
}

export function pickHtmlEntry(files: Record<string, string>, activePath: string | null): string | null {
  const list = htmlFiles(files);
  if (list.length === 0) return null;
  if (activePath && list.includes(activePath)) return activePath;
  const index = list.find((path) => /index\.html?$/i.test(path) || path === PREVIEW_HTML_PATH);
  return index ?? list[0]!;
}

export function guessSource(files: Record<string, string>, selector: string): string | null {
  const id = /#([A-Za-z0-9_-]+)/.exec(selector)?.[1];
  const cls = /\.([A-Za-z0-9_-]+)/.exec(selector)?.[1];
  const needles = [id ? `#${id}` : "", cls ? `.${cls}` : "", cls ?? ""].filter(Boolean);
  if (needles.length === 0) return null;
  for (const [path, body] of Object.entries(files)) {
    if (!/\.(html?|css|tsx?|jsx?)$/i.test(path)) continue;
    const lines = body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (needles.some((n) => lines[i]!.includes(n))) return `${path}:${i + 1}`;
    }
  }
  return null;
}

function resolveRel(from: string, href: string): string | null {
  const clean = href.split("?")[0]!.split("#")[0]!.trim();
  if (!clean || clean.startsWith("data:") || /^[a-z]+:/i.test(clean)) return null;
  const stripped = clean.replace(/^\.\//, "");
  if (stripped.startsWith("/")) return stripped.slice(1);
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const parts = (dir ? `${dir}/${stripped}` : stripped).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

export function assembleHtmlPreview(files: Record<string, string>, entry: string): string {
  let html = files[entry] ?? "";
  if (!html.trim()) html = STARTER_PREVIEW_HTML;
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) return tag;
    const path = resolveRel(entry, href);
    if (!path || files[path] === undefined) return tag;
    return `<style data-from="${path}">\n${files[path]}\n</style>`;
  });
  if (!/<body[\s>]/i.test(html)) {
    html = `<!doctype html><html><body>${html}</body></html>`;
  }
  const script = `<script>${PICKER_SCRIPT}<\/script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
  return `${html}${script}`;
}

export function previewMarkupKey(html: string): string {
  return html.replace(/<style data-from="[^"]*">[\s\S]*?<\/style>/gi, "<style/>");
}

export function cssFromPreview(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<style data-from="([^"]+)">([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) out[match[1]!] = match[2]!.trim();
  return out;
}

export function hotReloadStyles(doc: { querySelectorAll: (sel: string) => Iterable<{ getAttribute: (n: string) => string | null; textContent: string | null }> }, html: string): boolean {
  const next = cssFromPreview(html);
  let changed = false;
  for (const el of doc.querySelectorAll("style[data-from]")) {
    const path = el.getAttribute("data-from");
    if (!path || next[path] === undefined) continue;
    if ((el.textContent ?? "").trim() !== next[path]) {
      el.textContent = next[path]!;
      changed = true;
    }
  }
  return changed;
}

export function formatDesignCaptures(captures: DesignCapture[]): string {
  if (captures.length === 0) return "";
  return captures
    .map((c) => {
      const shot =
        c.screenshot && c.screenshot.length < 14000
          ? `screenshot:\n${c.screenshot}`
          : `screenshot: ${c.bounds.w}×${c.bounds.h} crop (bytes omitted)`;
      return [
        `Design Mode capture from ${c.path}`,
        `selector: ${c.selector}`,
        `tag: ${c.tag}`,
        c.source ? `source: ${c.source}` : null,
        `text: ${c.text}`,
        c.note ? `intent: ${c.note}` : null,
        `bounds: ${c.bounds.w}×${c.bounds.h} at (${c.bounds.x}, ${c.bounds.y})`,
        `html:\n${c.html}`,
        c.neighborhood ? `neighborhood:\n${c.neighborhood}` : null,
        `css:\n${c.css}`,
        shot,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export const PICKER_SCRIPT = `(() => {
  document.documentElement.style.cursor = "crosshair";
  const box = document.createElement("div");
  box.setAttribute("data-aperture-picker", "1");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b9eff;background:rgba(59,158,255,.14);display:none;";
  document.documentElement.appendChild(box);
  const keys = ["display","position","top","left","right","bottom","width","height","margin","padding","color","background-color","background-image","font-family","font-size","font-weight","line-height","border","border-radius","flex","gap","align-items","justify-content","text-align","opacity","overflow","box-shadow","z-index"];
  function hit(e) {
    box.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    box.style.display = "block";
    if (!el || el === box || el === document.documentElement || el === document.body) return null;
    return el;
  }
  function selector(el) {
    if (el.id) return el.tagName.toLowerCase() + "#" + el.id;
    const raw = typeof el.className === "string" ? el.className.trim() : "";
    const cls = raw ? "." + raw.split(/\\s+/).slice(0, 3).join(".") : "";
    return el.tagName.toLowerCase() + cls;
  }
  function css(el) {
    const s = getComputedStyle(el);
    return keys.map((k) => k + ": " + s.getPropertyValue(k)).join("; ");
  }
  function snap(el, done) {
    try {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.min(480, Math.round(r.width)));
      const h = Math.max(1, Math.min(280, Math.round(r.height)));
      const clone = el.cloneNode(true);
      const s = getComputedStyle(el);
      clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      clone.style.cssText = "margin:0;position:static;width:" + r.width + "px;height:" + r.height + "px;background:" + s.backgroundColor + ";color:" + s.color + ";font:" + s.font + ";border:" + s.border + ";border-radius:" + s.borderRadius + ";display:" + s.display + ";align-items:" + s.alignItems + ";justify-content:" + s.justifyContent + ";padding:" + s.padding + ";";
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' + new XMLSerializer().serializeToString(clone) + "</foreignObject></svg>";
      const img = new Image();
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) { done(null); return; }
        ctx.fillStyle = s.backgroundColor || "#111";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try { done(c.toDataURL("image/jpeg", 0.7)); } catch (err) { done(null); }
      };
      img.onerror = function () { done(null); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } catch (err) { done(null); }
  }
  window.addEventListener("mousemove", (e) => {
    const el = hit(e);
    if (!el) { box.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left + "px";
    box.style.top = r.top + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
  }, true);
  window.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = hit(e);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const wrap = el.parentElement && el.parentElement !== document.body ? el.parentElement : null;
    const payload = {
      selector: selector(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 160),
      html: (el.outerHTML || "").slice(0, 4000),
      neighborhood: wrap ? (wrap.outerHTML || "").slice(0, 4000) : "",
      css: css(el),
      bounds: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      screenshot: null
    };
    snap(el, (shot) => {
      payload.screenshot = shot;
      parent.postMessage({ type: "aperture-design-pick", payload }, "*");
    });
  }, true);
})();
`;
