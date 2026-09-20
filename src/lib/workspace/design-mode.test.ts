import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assembleHtmlPreview,
  cssFromPreview,
  formatDesignCaptures,
  guessSource,
  hotReloadStyles,
  htmlFiles,
  isDesignPayload,
  pickHtmlEntry,
  previewMarkupKey,
  sanitizePreviewHtml,
  type DesignCapture,
} from "./design-mode.ts";

const files = {
  "preview.html": `<html><head><link rel="stylesheet" href="preview.css"></head><body><button class="cta">Go</button></body></html>`,
  "preview.css": `.cta { color: red; }`,
  "src/index.ts": "export {}",
};

test("htmlFiles lists html only", () => {
  assert.deepEqual(htmlFiles(files), ["preview.html"]);
});

test("pickHtmlEntry prefers preview.html", () => {
  assert.equal(pickHtmlEntry(files, "src/index.ts"), "preview.html");
});

test("assembleHtmlPreview inlines css and injects picker", () => {
  const html = assembleHtmlPreview(files, "preview.html");
  assert.match(html, /data-from="preview.css"/);
  assert.match(html, /\.cta \{ color: red; \}/);
  assert.match(html, /aperture-design-pick/);
  assert.doesNotMatch(html, /<link rel="stylesheet" href="preview.css">/);
});

test("sanitizePreviewHtml strips scripts and handlers", () => {
  const dirty = `<p onclick="steal()">x</p><script>alert(1)</script><a href="javascript:alert(2)">y</a>`;
  const clean = sanitizePreviewHtml(dirty);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.match(clean, /<p>x<\/p>/);
});

test("assembleHtmlPreview does not keep page scripts", () => {
  const html = assembleHtmlPreview(
    { "evil.html": `<body><button>Go</button><script>parent.postMessage({type:'aperture-design-pick'},'*')</script></body>` },
    "evil.html",
  );
  assert.equal((html.match(/<script/gi) ?? []).length, 1);
  assert.match(html, /aperture-design-pick/);
  assert.doesNotMatch(html, /parent\.postMessage\(\{type:'aperture-design-pick'\}/);
});

test("isDesignPayload rejects junk", () => {
  assert.equal(isDesignPayload(null), false);
  assert.equal(isDesignPayload({ selector: "a" }), false);
  assert.equal(
    isDesignPayload({
      selector: "button.cta",
      tag: "button",
      text: "Go",
      html: "<button>",
      neighborhood: "",
      css: "color: red",
      bounds: { x: 0, y: 0, w: 8, h: 8 },
      screenshot: null,
    }),
    true,
  );
});

test("guessSource finds class in css", () => {
  assert.equal(guessSource(files, "button.cta"), "preview.html:1");
});

test("css-only edit keeps markup key", () => {
  const a = assembleHtmlPreview(files, "preview.html");
  const b = assembleHtmlPreview({ ...files, "preview.css": ".cta { color: blue; }" }, "preview.html");
  assert.equal(previewMarkupKey(a), previewMarkupKey(b));
  assert.match(cssFromPreview(b)["preview.css"] ?? "", /blue/);
});

test("html edit changes markup key", () => {
  const a = assembleHtmlPreview(files, "preview.html");
  const b = assembleHtmlPreview({ ...files, "preview.html": files["preview.html"]!.replace("Go", "Next") }, "preview.html");
  assert.notEqual(previewMarkupKey(a), previewMarkupKey(b));
});

test("hotReloadStyles patches matching tags", () => {
  const el = { path: "preview.css", textContent: ".cta { color: red; }", getAttribute() { return this.path; } };
  const changed = hotReloadStyles({ querySelectorAll: () => [el] }, assembleHtmlPreview({ ...files, "preview.css": ".cta { color: blue; }" }, "preview.html"));
  assert.equal(changed, true);
  assert.match(el.textContent, /blue/);
});

test("formatDesignCaptures includes intent and neighborhood", () => {
  const cap: DesignCapture = {
    id: "1",
    path: "preview.html",
    selector: "button.cta",
    tag: "button",
    text: "Go",
    html: `<button class="cta">Go</button>`,
    neighborhood: `<header><button class="cta">Go</button></header>`,
    css: "display: inline-block",
    bounds: { x: 8, y: 8, w: 80, h: 32 },
    screenshot: null,
    source: "preview.css:1",
    note: "Make the CTA quieter",
  };
  const text = formatDesignCaptures([cap]);
  assert.match(text, /Design Mode capture from preview.html/);
  assert.match(text, /selector: button\.cta/);
  assert.match(text, /intent: Make the CTA quieter/);
  assert.match(text, /source: preview.css:1/);
  assert.match(text, /neighborhood:/);
  assert.match(text, /<button class="cta">Go<\/button>/);
});

test("scripts are stripped by default, exactly as before", () => {
  const files = {
    "index.html": '<html><body><h1>hi</h1><script src="./app.js"></script></body></html>',
    "app.js": "console.log('ran');",
  };
  const out = assembleHtmlPreview(files, "index.html");
  assert.doesNotMatch(out, /console\.log\('ran'\)/);
  assert.doesNotMatch(out, /app\.js/);
});

test("with scripts on, a workspace script is inlined", () => {
  const files = {
    "index.html": '<html><body><script src="./app.js"></script></body></html>',
    "app.js": "window.ran = true;",
  };
  const out = assembleHtmlPreview(files, "index.html", { runScripts: true });
  assert.match(out, /window\.ran = true;/);
  assert.match(out, /data-from="app\.js"/);
  // The src is consumed by the inline body, not left to fetch.
  assert.doesNotMatch(out, /src="\.\/app\.js"/);
});

test("with scripts on, an inline script survives", () => {
  const files = { "index.html": "<html><body><script>window.x = 1;</script></body></html>" };
  const out = assembleHtmlPreview(files, "index.html", { runScripts: true });
  assert.match(out, /window\.x = 1;/);
});

test("a remote script is dropped even with scripts on", () => {
  const files = {
    "index.html": '<html><body><script src="https://cdn.example.com/x.js"></script></body></html>',
  };
  const out = assembleHtmlPreview(files, "index.html", { runScripts: true });
  assert.doesNotMatch(out, /cdn\.example\.com/);
});

test("a module with relative imports is not inlined", () => {
  // Inlined, its `./util.js` would resolve against about:srcdoc and fail —
  // a module-resolution error that says nothing about the user's code.
  const files = {
    "index.html": '<html><body><script type="module" src="./main.js"></script></body></html>',
    "main.js": 'import { u } from "./util.js";\nu();',
    "util.js": "export function u() {}",
  };
  const out = assembleHtmlPreview(files, "index.html", { runScripts: true });
  assert.doesNotMatch(out, /import \{ u \}/);
});

test("a module without relative imports is inlined", () => {
  const files = {
    "index.html": '<html><body><script type="module" src="./main.js"></script></body></html>',
    "main.js": "document.title = 'ok';",
  };
  const out = assembleHtmlPreview(files, "index.html", { runScripts: true });
  assert.match(out, /document\.title = 'ok';/);
});

test("embedding and navigation stay blocked whether scripts run or not", () => {
  const files = {
    "index.html":
      '<html><body><iframe src="x"></iframe><base href="/evil/"><object data="x"></object>' +
      '<meta http-equiv="refresh" content="0"><form action="x"></form></body></html>',
  };
  for (const runScripts of [false, true]) {
    const out = assembleHtmlPreview(files, "index.html", { runScripts });
    assert.doesNotMatch(out, /<iframe/i, `iframe leaked (runScripts=${runScripts})`);
    assert.doesNotMatch(out, /<base/i, `base leaked (runScripts=${runScripts})`);
    assert.doesNotMatch(out, /<object/i, `object leaked (runScripts=${runScripts})`);
    assert.doesNotMatch(out, /http-equiv/i, `meta refresh leaked (runScripts=${runScripts})`);
    assert.doesNotMatch(out, /<form/i, `form leaked (runScripts=${runScripts})`);
  }
});

test("inline handlers and javascript: URLs follow the switch", () => {
  const files = {
    "index.html": '<html><body><a href="javascript:void(0)" onclick="go()">x</a></body></html>',
  };
  const off = assembleHtmlPreview(files, "index.html");
  assert.doesNotMatch(off, /onclick/i);
  assert.doesNotMatch(off, /javascript:/i);
  // With scripts on they are the same capability as a <script> block, so
  // stripping them would only be theatre.
  const on = assembleHtmlPreview(files, "index.html", { runScripts: true });
  assert.match(on, /onclick/i);
});
