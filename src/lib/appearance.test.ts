import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { defaultDensity, parseTheme, resolveTheme, THEME_BOOT_SCRIPT } from "./appearance.ts";

test("themes: stored values parse, anything else is the default", () => {
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("system"), "system");
  assert.equal(parseTheme("claude"), "claude");
  assert.equal(parseTheme("neon"), "cursor");
  assert.equal(parseTheme(null), "cursor");
});

test("system resolves to light or the cool dark theme; the others are themselves", () => {
  assert.equal(resolveTheme("system", true), "light");
  assert.equal(resolveTheme("system", false), "cursor");
  assert.equal(resolveTheme("claude", true), "claude");
  assert.equal(resolveTheme("light", false), "light");
});

/** Runs the inline head script the way a browser would, and reports the theme it set. */
function boot(stored: string | null, prefersLight: boolean): string | undefined {
  const attrs: Record<string, string> = {};
  vm.runInNewContext(THEME_BOOT_SCRIPT, {
    localStorage: { getItem: (key: string) => (key === "aperture-theme" ? stored : null) },
    matchMedia: () => ({ matches: prefersLight }),
    document: { documentElement: { setAttribute: (name: string, value: string) => (attrs[name] = value) } },
  });
  return attrs["data-theme"];
}

test("the head script picks the same theme as resolveTheme, before React loads", () => {
  for (const stored of ["cursor", "claude", "light", "system"] as const) {
    for (const light of [true, false]) {
      assert.equal(boot(stored, light), resolveTheme(stored, light), `${stored}, prefers light: ${light}`);
    }
  }
  // Nothing stored, or something unknown: the stylesheet's default theme stands.
  assert.equal(boot(null, true), undefined);
  assert.equal(boot("<script>", false), undefined);
});

/** The density the head script sets, before React loads. */
function bootDensity(stored: string | null, touch: boolean): string | undefined {
  const attrs: Record<string, string> = {};
  vm.runInNewContext(THEME_BOOT_SCRIPT, {
    localStorage: { getItem: (key: string) => (key === "aperture-density" ? stored : null) },
    matchMedia: (query: string) => ({ matches: query.includes("coarse") ? touch : false }),
    document: { documentElement: { setAttribute: (name: string, value: string) => (attrs[name] = value) } },
  });
  return attrs["data-density"];
}

test("a touch screen starts comfortable unless a density was chosen, and the head script agrees", () => {
  assert.equal(defaultDensity(true), "comfortable");
  assert.equal(defaultDensity(false), "compact");
  assert.equal(bootDensity(null, true), "comfortable");
  assert.equal(bootDensity(null, false), undefined, "the stylesheet's compact default stands");
  assert.equal(bootDensity("compact", true), "compact", "a chosen density wins");
});
