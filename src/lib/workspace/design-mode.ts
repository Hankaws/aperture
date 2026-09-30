import { collectImports } from "./module-graph.ts";
import { formatTokens, readTokens, type DesignToken, type MatchedRule } from "./design-styles.ts";

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
  /** The element's own classes and id, for picking the rule a style edit goes to. */
  classes?: string[];
  elementId?: string | null;
  /** The nearest ancestor's class or id (`.card`), to scope a new rule for a classless element. */
  scope?: string | null;
  /** Rules in the project's stylesheets that match the element, in cascade order. */
  rules?: MatchedRule[];
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

/**
 * Strip what the preview must never run or navigate to.
 *
 * `keepScripts` is the opt-in half of Design Mode's "Run scripts" switch. It
 * relaxes exactly one thing — script execution — and does so uniformly, since
 * an `onclick` attribute and a `<script>` block are the same capability. The
 * embedding and navigation blocks stay on either way: they are what keeps the
 * picker's view of the document honest, and `<base>` would silently repoint
 * every relative URL.
 *
 * The frame itself is the real boundary. It is `sandbox="allow-scripts"`
 * *without* `allow-same-origin`, so anything running here sits in an opaque
 * origin with no reach into Aperture's storage, cookies or DOM.
 */
export function sanitizePreviewHtml(
  html: string,
  options: { keepScripts?: boolean } = {},
): string {
  const base = options.keepScripts
    ? html
    : html
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<script\b[^>]*\/?>/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/javascript:/gi, "");
  return base
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed|applet|form)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*['"]?refresh[^>]*>/gi, "");
}

export function isDesignPayload(value: unknown): value is Omit<DesignCapture, "id" | "path" | "source" | "note"> {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  const bounds = o.bounds as Record<string, unknown> | undefined;
  return (
    typeof o.selector === "string" &&
    o.selector.length <= 240 &&
    typeof o.tag === "string" &&
    o.tag.length <= 40 &&
    typeof o.text === "string" &&
    o.text.length <= 240 &&
    typeof o.html === "string" &&
    o.html.length <= 8000 &&
    typeof o.neighborhood === "string" &&
    o.neighborhood.length <= 8000 &&
    typeof o.css === "string" &&
    o.css.length <= 4000 &&
    Boolean(bounds) &&
    typeof bounds!.x === "number" &&
    typeof bounds!.y === "number" &&
    typeof bounds!.w === "number" &&
    typeof bounds!.h === "number" &&
    (o.screenshot === null || typeof o.screenshot === "string") &&
    (o.classes === undefined || (Array.isArray(o.classes) && o.classes.length <= 40 && o.classes.every((c) => typeof c === "string" && c.length <= 120))) &&
    (o.elementId === undefined || o.elementId === null || (typeof o.elementId === "string" && o.elementId.length <= 120)) &&
    (o.scope === undefined || o.scope === null || (typeof o.scope === "string" && o.scope.length <= 200)) &&
    (o.rules === undefined ||
      (Array.isArray(o.rules) &&
        o.rules.length <= 40 &&
        o.rules.every((r) => {
          const rule = r as Record<string, unknown> | null;
          return Boolean(rule) && typeof rule!.from === "string" && rule!.from.length <= 300 && typeof rule!.selector === "string" && rule!.selector.length <= 400;
        })))
  );
}

/**
 * Whether a module can run inlined into the document.
 *
 * An inlined `type="module"` resolves its relative imports against
 * `about:srcdoc`, where they cannot be found. Running it anyway would raise a
 * module-resolution error that says nothing about the user's code — a false
 * failure reported to the agent is worse than no signal at all.
 */
function moduleCanInline(path: string, source: string): boolean {
  return !collectImports(path, source).some((ref) => ref.spec.startsWith("."));
}

function inlineScripts(html: string, files: Record<string, string>, entry: string): string {
  return html.replace(/<script\b[^>]*>/gi, (tag) => {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src) return tag; // An inline script already carries its own body.
    const path = resolveRel(entry, src);
    // A remote script is left for a later, deliberate decision; today it is
    // dropped rather than fetched, which is what the preview already did.
    if (!path || files[path] === undefined) return "<script>";
    const source = files[path]!;
    if (/\btype\s*=\s*["']module["']/i.test(tag) && !moduleCanInline(path, source)) {
      return "<script>";
    }
    const opened = tag.replace(/\s*\bsrc\s*=\s*["'][^"']*["']/i, "");
    return `${opened.replace(/>$/, "")} data-from="${path}">\n${source}\n`;
  });
}

export function assembleHtmlPreview(
  files: Record<string, string>,
  entry: string,
  options: { runScripts?: boolean } = {},
): string {
  const runScripts = options.runScripts === true;
  let html = sanitizePreviewHtml(files[entry] ?? "", { keepScripts: runScripts });
  if (!html.trim()) html = STARTER_PREVIEW_HTML;
  if (runScripts) html = inlineScripts(html, files, entry);
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
  // `\u002f` keeps the literal `</script>` sequence out of this source, so the
  // tag cannot close early if this module is ever inlined into a document.
  const script = `<script>${PICKER_SCRIPT}<\u002fscript>`;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : `${html}${script}`;
  // The error reporter goes first: the page's own scripts run before the
  // picker at the end, and an error they throw while loading would be missed.
  return injectFirst(html, `<script>${ERROR_REPORTER_SCRIPT}<\u002fscript>`);
}

/** Puts `script` before anything the page runs: first in <head>, else first in <body>. */
function injectFirst(html: string, script: string): string {
  if (/<head(\s[^>]*)?>/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}${script}`);
  if (/<body(\s[^>]*)?>/i.test(html)) return html.replace(/<body(\s[^>]*)?>/i, (tag) => `${tag}${script}`);
  return `${script}${html}`;
}

/** Tells the editor about script errors in the live preview, once each. */
export const ERROR_REPORTER_SCRIPT = `(() => {
  var seen = [];
  function report(msg) {
    msg = String(msg || "Script error").slice(0, 180);
    if (seen.indexOf(msg) >= 0 || seen.length >= 20) return;
    seen.push(msg);
    try { parent.postMessage({ type: "aperture-preview-error", message: msg }, "*"); } catch (e) {}
  }
  window.addEventListener("error", function (e) { if (e instanceof ErrorEvent) report(e.message); });
  window.addEventListener("unhandledrejection", function (e) { report(e.reason && e.reason.message ? e.reason.message : e.reason); });
})();`;

/**
 * Reports how the page went, once: the script errors it threw and whether it
 * rendered anything at all. Goes first in the document so errors thrown by the
 * page's own scripts are caught; resource errors are ignored, because relative
 * URLs cannot load in a srcdoc frame and would fail every page with an image.
 */
export const RENDER_PROBE_SCRIPT = `(() => {
  var errors = [];
  function add(msg) { msg = String(msg || "Script error").slice(0, 180); if (errors.indexOf(msg) < 0 && errors.length < 8) errors.push(msg); }
  window.addEventListener("error", function (e) { if (e instanceof ErrorEvent) add(e.message); });
  window.addEventListener("unhandledrejection", function (e) { add(e.reason && e.reason.message ? e.reason.message : e.reason); });
  function finish() {
    var body = document.body;
    var text = body ? (body.innerText || "").trim().length : 0;
    var media = body ? body.querySelectorAll("img,svg,canvas,video,input,button,select,textarea").length : 0;
    try { parent.postMessage({ type: "aperture-render-probe", errors: errors, blank: text === 0 && media === 0 }, "*"); } catch (e) {}
  }
  function later() { setTimeout(finish, 300); }
  if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();`;

/** The staged page as the preview would show it, plus the probe that reports back. */
export function renderProbeDocument(
  files: Record<string, string>,
  entry: string,
  options: { runScripts?: boolean } = {},
): string {
  return injectFirst(assembleHtmlPreview(files, entry, options), `<script>${RENDER_PROBE_SCRIPT}<\u002fscript>`);
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

/** Every design token the captured pages' stylesheets declare, for Composer. */
function pageTokens(captures: DesignCapture[], files: Record<string, string>): string {
  const seen = new Set<string>();
  const tokens: DesignToken[] = [];
  for (const path of new Set(captures.map((c) => c.path))) {
    if (files[path] === undefined) continue;
    for (const css of Object.values(cssFromPreview(assembleHtmlPreview(files, path)))) {
      for (const t of readTokens(css)) {
        if (seen.has(t.name)) continue;
        seen.add(t.name);
        tokens.push(t);
      }
    }
  }
  return formatTokens(tokens);
}

export function formatDesignCaptures(captures: DesignCapture[], files?: Record<string, string>): string {
  if (captures.length === 0) return "";
  const tokens = files ? pageTokens(captures, files) : "";
  const text = captures
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
        c.rules?.length ? `styled by: ${c.rules.map((r) => `${r.selector} (${r.from})`).join(", ")}` : null,
        `css:\n${c.css}`,
        shot,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
  return tokens ? `${text}\n\n${tokens}` : text;
}

export const PICKER_SCRIPT = `(() => {
  document.documentElement.style.cursor = "crosshair";
  const box = document.createElement("div");
  box.setAttribute("data-aperture-picker", "1");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b9eff;background:rgba(59,158,255,.14);display:none;";
  document.documentElement.appendChild(box);
  const keys = ["display","position","top","left","right","bottom","width","height","margin","padding","color","background-color","background-image","font-family","font-size","font-weight","line-height","letter-spacing","border","border-color","border-width","border-radius","flex","gap","align-items","justify-content","text-align","opacity","overflow","box-shadow","z-index"];
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
  function scope(el) {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (a.id) return "#" + CSS.escape(a.id);
      const c = typeof a.className === "string" ? a.className.trim().split(/\\s+/)[0] : "";
      if (c) return "." + CSS.escape(c);
    }
    return null;
  }
  // The project's own rules that style this element: only stylesheets inlined from workspace files carry data-from.
  function matched(el) {
    const out = [];
    for (const sheet of Array.from(document.styleSheets)) {
      const node = sheet.ownerNode;
      const from = node && node.getAttribute ? node.getAttribute("data-from") : null;
      if (!from || !/\\.css$/i.test(from)) continue;
      let list;
      try { list = sheet.cssRules; } catch (err) { continue; }
      for (const r of Array.from(list)) {
        if (r.type !== 1 || !r.selectorText) continue;
        try { if (el.matches(r.selectorText)) out.push({ from, selector: r.selectorText }); } catch (err) {}
      }
    }
    return out.slice(-20);
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
      screenshot: null,
      classes: typeof el.className === "string" ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 20) : [],
      elementId: el.id || null,
      scope: scope(el),
      rules: matched(el)
    };
    snap(el, (shot) => {
      payload.screenshot = shot;
      parent.postMessage({ type: "aperture-design-pick", payload }, "*");
    });
  }, true);
})();
`;
