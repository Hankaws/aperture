import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PAGES, pageHead, pageTitle, type PageKey } from "./page-head.ts";

const keys = Object.keys(PAGES) as PageKey[];
const ROOT_TITLE = "Aperture: an AI code editor that checks its own work";

test("every page has its own title, and none is the root's", () => {
  const titles = keys.map(pageTitle);
  assert.equal(new Set(titles).size, titles.length, "titles repeat");
  for (const title of titles) {
    assert.notEqual(title, ROOT_TITLE);
    assert.match(title, / · Aperture$/);
    assert.ok(title.length <= 60, `${title} is too long for a tab`);
  }
});

test("every description is a sentence of a sensible length, and none repeats", () => {
  const descriptions = keys.map((key) => PAGES[key].description);
  assert.equal(new Set(descriptions).size, descriptions.length);
  for (const text of descriptions) {
    assert.ok(text.length >= 30 && text.length <= 200, text);
    assert.match(text, /[.]$/);
  }
});

test("pageHead gives a title and a description meta", () => {
  const head = pageHead("pricing");
  assert.deepEqual(head.meta[0], { title: "Pricing · Aperture" });
  assert.equal(head.meta[1]?.name, "description");
});

test("every page route sets its own head, so no tab falls back to the root title", () => {
  const dir = new URL("../routes/", import.meta.url);
  const missing: string[] = [];
  for (const file of readdirSync(dir)) {
    // The home page keeps the root title: it is the one the root route describes.
    if (!file.endsWith(".tsx") || file.startsWith("__") || file === "index.tsx") continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    // Redirect-only routes never render a page.
    if (/throw redirect\(/.test(source) && !/component:/.test(source)) continue;
    if (!/head: .*pageHead\(/.test(source)) missing.push(file);
  }
  assert.deepEqual(missing, [], "these routes show the root title");
});

test("the root route has a not-found page of its own", () => {
  const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /notFoundComponent: NotFound/);
});
