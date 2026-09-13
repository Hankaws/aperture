import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { EDITOR, SYNTAX } from "./theme.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..", "..");
const html = readFileSync(join(root, "public/theme.html"), "utf8");

test("theme preview hardcodes the installed hex", () => {
  const hex = [
    EDITOR.bg,
    EDITOR.selection,
    EDITOR.selectionInactive,
    EDITOR.wordRead,
    EDITOR.wordWrite,
    EDITOR.ghost,
    EDITOR.inlayBg,
    EDITOR.stickyBg,
    EDITOR.listDrop,
    EDITOR.paletteFocus,
    EDITOR.ansi.magenta,
    EDITOR.ansi.brightCyan,
    SYNTAX.keyword,
    SYNTAX.string,
    SYNTAX.fn,
  ];
  for (const value of hex) {
    assert.ok(html.includes(value), `theme.html missing ${value}`);
  }
});
