import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assembleHtmlPreview,
  formatDesignCaptures,
  htmlFiles,
  pickHtmlEntry,
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

test("formatDesignCaptures names selector and html", () => {
  const cap: DesignCapture = {
    id: "1",
    path: "preview.html",
    selector: "button.cta",
    tag: "button",
    text: "Go",
    html: `<button class="cta">Go</button>`,
    css: "display: inline-block",
    bounds: { x: 8, y: 8, w: 80, h: 32 },
    screenshot: null,
  };
  const text = formatDesignCaptures([cap]);
  assert.match(text, /Design Mode capture from preview.html/);
  assert.match(text, /selector: button\.cta/);
  assert.match(text, /<button class="cta">Go<\/button>/);
});
