import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LAYOUT_PREFS,
  effectiveDock,
  panelSizesKey,
  parseLayoutPrefs,
  restorableLayout,
} from "./layout-prefs.ts";

test("parseLayoutPrefs falls back to defaults for missing or broken input", () => {
  assert.deepEqual(parseLayoutPrefs(null), DEFAULT_LAYOUT_PREFS);
  assert.deepEqual(parseLayoutPrefs("not json"), DEFAULT_LAYOUT_PREFS);
  assert.deepEqual(parseLayoutPrefs("[1,2]"), DEFAULT_LAYOUT_PREFS);
  assert.deepEqual(parseLayoutPrefs("null"), DEFAULT_LAYOUT_PREFS);
});

test("parseLayoutPrefs keeps valid fields and repairs the rest one by one", () => {
  const prefs = parseLayoutPrefs(
    JSON.stringify({ sidebarOpen: false, chatOpen: "yes", previewDock: "bottom", swapSides: true }),
  );
  assert.deepEqual(prefs, { sidebarOpen: false, chatOpen: true, previewDock: "bottom", swapSides: true });
  assert.equal(parseLayoutPrefs(JSON.stringify({ previewDock: "left" })).previewDock, "right");
});

test("parseLayoutPrefs never hands out the shared default object", () => {
  const a = parseLayoutPrefs(null);
  a.sidebarOpen = false;
  assert.equal(DEFAULT_LAYOUT_PREFS.sidebarOpen, true);
});

test("effectiveDock maximizes on phones and shows code under a maximized preview on request", () => {
  assert.equal(effectiveDock("right", { desktop: true, codePeek: false }), "right");
  assert.equal(effectiveDock("bottom", { desktop: true, codePeek: true }), "bottom");
  assert.equal(effectiveDock("right", { desktop: false, codePeek: false }), "full");
  assert.equal(effectiveDock("full", { desktop: true, codePeek: false }), "full");
  assert.equal(effectiveDock("full", { desktop: true, codePeek: true }), "bottom");
  assert.equal(effectiveDock("right", { desktop: false, codePeek: true }), "bottom");
});

test("panelSizesKey separates groups and panel sets", () => {
  assert.notEqual(panelSizesKey("editor", ["code", "preview"]), panelSizesKey("editor", ["code"]));
  assert.notEqual(panelSizesKey("editor-h", ["code", "preview"]), panelSizesKey("editor-v", ["code", "preview"]));
});

test("restorableLayout accepts only a complete, sane layout for the expected panels", () => {
  const ids = ["files", "editor", "agent"];
  assert.deepEqual(restorableLayout({ files: 20, editor: 54, agent: 26 }, ids), { files: 20, editor: 54, agent: 26 });
  assert.equal(restorableLayout({ files: 20, editor: 80 }, ids), null, "missing panel");
  assert.equal(restorableLayout({ files: 20, editor: 50, agent: 20, extra: 10 }, ids), null, "extra panel");
  assert.equal(restorableLayout({ files: 20, editor: 50, agent: 20 }, ids), null, "does not sum to 100");
  assert.equal(restorableLayout({ files: -5, editor: 80, agent: 25 }, ids), null, "negative size");
  assert.equal(restorableLayout({ files: "20", editor: 54, agent: 26 }, ids), null, "string size");
  assert.equal(restorableLayout([20, 54, 26], ids), null);
  assert.equal(restorableLayout(null, ids), null);
});
