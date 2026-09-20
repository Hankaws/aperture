import assert from "node:assert/strict";
import { test } from "node:test";
import { collectClassNames, collectCssTokens, formatUiGraph, isUiTask, nearestUiFiles } from "./ui-graph.ts";

const files = {
  "preview.html": `<button class="cta">Go</button>`,
  "preview.css": `:root { --accent: #3b9eff; } .cta { color: var(--accent); }`,
  "src/store.ts": "export function listTasks() {}",
  "src/Card.tsx": "export function Card() { return <div className='card' />; }",
};

test("isUiTask matches design language", () => {
  assert.equal(isUiTask("Fix the off-by-one in listTasks"), false);
  assert.equal(isUiTask("Make the Create task button larger"), true);
  assert.equal(isUiTask("Update preview.html header"), true);
});

test("collects repo tokens and classes", () => {
  assert.ok(collectCssTokens(files).includes("--accent"));
  assert.ok(collectCssTokens(files).includes("#3b9eff"));
  assert.ok(collectClassNames(files).includes("cta"));
});

test("nearestUiFiles prefers html and query hits", () => {
  const near = nearestUiFiles(files, "button cta", "preview.html", 3);
  assert.ok(near.includes("preview.html"));
  assert.ok(near.includes("preview.css"));
});

test("formatUiGraph stays empty off UI tasks", () => {
  assert.equal(formatUiGraph(files, "Fix listTasks", "src/store.ts"), "");
});

test("formatUiGraph injects host tokens and nearest files", () => {
  const block = formatUiGraph(files, "Restyle the preview header button", "preview.html");
  assert.match(block, /Host tokens/);
  assert.match(block, /Button TabBar/);
  assert.match(block, /do not invent a palette/);
  assert.match(block, /preview\.html/);
  assert.match(block, /--accent/);
});
