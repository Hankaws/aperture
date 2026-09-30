import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEME_PRESETS,
  findRule,
  formatTokens,
  newRuleSelector,
  parseComputed,
  parseCss,
  pickTargetRule,
  presetValues,
  readTokens,
  ruleValues,
  setDeclarations,
  setTokens,
  toHex,
  tokenKind,
  tokenRef,
  tokenRole,
} from "./design-styles.ts";
import { STARTER_PREVIEW_CSS } from "./design-mode.ts";

test("parseCss finds rules, their declarations, and rules inside @media", () => {
  const css = `/* a { color: red } */\n.a, .b { color: red; background: url("x;y") }\n@media (max-width: 600px) {\n  .a { color: blue; }\n}\n@import "z.css";\n.c{}`;
  const rules = parseCss(css);
  assert.deepEqual(
    rules.map((r) => [r.selector, r.atRule]),
    [
      [".a, .b", null],
      [".a", "@media (max-width: 600px)"],
      [".c", null],
    ],
  );
  assert.deepEqual(ruleValues(rules[0]!), { color: "red", background: 'url("x;y")' });
});

test("setDeclarations replaces a value in place and keeps the file's formatting", () => {
  const next = setDeclarations(STARTER_PREVIEW_CSS, ".cta", { "border-radius": "12px" });
  assert.match(
    next,
    /\.cta \{\n {2}border: 0;\n {2}background: var\(--accent\);[\s\S]*? {2}border-radius: 12px;\n/,
  );
  assert.equal(next.length, STARTER_PREVIEW_CSS.length + 1, "8px → 12px, nothing else");
  assert.equal(ruleValues(findRule(next, ".cta"))["border-radius"], "12px");
});

test("setDeclarations appends a new declaration with the rule's indentation", () => {
  const next = setDeclarations(STARTER_PREVIEW_CSS, ".cta", { "font-size": "16px" });
  assert.match(next, / {2}cursor: pointer;\n {2}font-size: 16px;\n\}/);
});

test("setDeclarations removes a declaration with null, line and all", () => {
  const next = setDeclarations(STARTER_PREVIEW_CSS, ".cta", { cursor: null });
  assert.doesNotMatch(
    findRule(next, ".cta")
      ? next.slice(findRule(next, ".cta")!.open, findRule(next, ".cta")!.close)
      : "",
    /cursor/,
  );
  assert.match(next, /padding: 8px 12px;\n\}/);
});

test("setDeclarations adds a missing rule at the end, and handles one-line rules", () => {
  const added = setDeclarations("a { color: red }\n", ".new", { color: "blue", padding: "4px" });
  assert.equal(added, "a { color: red }\n\n.new {\n  color: blue;\n  padding: 4px;\n}\n");
  const oneLine = setDeclarations("a { color: red }", "a", { padding: "4px" });
  assert.equal(oneLine, "a { color: red; padding: 4px; }");
  const noSemi = setDeclarations("a {\n  color: red\n}\n", "a", { padding: "4px" });
  assert.equal(noSemi, "a {\n  color: red;\n  padding: 4px;\n}\n");
  assert.equal(setDeclarations("", ".x", { color: "red" }), ".x {\n  color: red;\n}\n");
});

test("findRule compares selectors ignoring spacing and skips @media copies", () => {
  const css = ".card  button{color:red}\n@media (min-width: 1px) { .card button { color: blue } }";
  assert.equal(ruleValues(findRule(css, ".card button")).color, "red");
});

test("readTokens reads :root custom properties with their kind", () => {
  const tokens = readTokens(STARTER_PREVIEW_CSS);
  assert.deepEqual(
    tokens.map((t) => [t.name, t.kind]),
    [
      ["--bg", "color"],
      ["--card", "color"],
      ["--line", "color"],
      ["--fg", "color"],
      ["--muted", "color"],
      ["--accent", "color"],
    ],
  );
  assert.deepEqual(
    readTokens(
      ":root { --radius: 8px; --font: Inter, system-ui, sans-serif; --shadow: 0 1px 2px #0003; }",
    ).map((t) => t.kind),
    ["length", "font", "other"],
  );
});

test("setTokens rewrites the :root that declares them", () => {
  const next = setTokens(STARTER_PREVIEW_CSS, { "--accent": "#ff7a59" });
  assert.match(next, /--accent: #ff7a59;/);
  assert.equal(readTokens(next).find((t) => t.name === "--accent")!.value, "#ff7a59");
});

test("theme presets set every colour token whose role is known", () => {
  const values = presetValues(
    readTokens(STARTER_PREVIEW_CSS),
    THEME_PRESETS.find((p) => p.id === "paper")!,
  );
  assert.deepEqual(Object.keys(values).sort(), [
    "--accent",
    "--bg",
    "--card",
    "--fg",
    "--line",
    "--muted",
  ]);
  assert.equal(values["--bg"], "#fafaf7");
  assert.equal(tokenRole("--color-primary"), "accent");
  assert.equal(tokenRole("--text-muted"), "muted");
  assert.equal(tokenRole("--radius"), null);
});

test("colour helpers", () => {
  assert.equal(toHex("#abc"), "#aabbcc");
  assert.equal(toHex("rgb(59, 158, 255)"), "#3b9eff");
  assert.equal(toHex("rgba(0,0,0,0.5)"), "#000000");
  assert.equal(toHex("var(--x)"), null);
  assert.equal(tokenRef("var(--accent)"), "--accent");
  assert.equal(tokenRef("var( --a , red)"), "--a");
  assert.equal(tokenKind("tomato"), "color");
  assert.equal(tokenKind("bold"), "other");
});

test("the edit goes to the rule that names the element's own class", () => {
  const rules = [
    { from: "site.css", selector: "button" },
    { from: "site.css", selector: ".cta" },
    { from: "site.css", selector: ".top > *" },
  ];
  assert.deepEqual(pickTargetRule(rules, ["cta"], null), { from: "site.css", selector: ".cta" });
  assert.equal(pickTargetRule(rules, [], null), null, ".top > * styles every child, not this one");
  assert.deepEqual(pickTargetRule(rules, [], null, "button"), {
    from: "site.css",
    selector: "button",
  });
  assert.deepEqual(
    pickTargetRule([...rules, { from: "site.css", selector: ".card button" }], [], null, "button"),
    { from: "site.css", selector: ".card button" },
  );
  assert.equal(
    pickTargetRule(
      [
        { from: "a.css", selector: "*" },
        { from: "a.css", selector: "body" },
      ],
      [],
      null,
      "body",
    ),
    null,
  );
  assert.equal(
    pickTargetRule([{ from: "a.css", selector: "buttons-x" }], [], null, "button"),
    null,
  );
  assert.deepEqual(pickTargetRule([{ from: "a.css", selector: ".md\\:flex" }], ["md:flex"], null), {
    from: "a.css",
    selector: ".md\\:flex",
  });
  assert.equal(pickTargetRule([], ["x"], null), null);
  assert.equal(newRuleSelector("button", ["cta", "big"], null), ".cta");
  assert.equal(newRuleSelector("h1", [], "title"), "#title");
  assert.equal(newRuleSelector("h1", [], null), "h1");
  assert.equal(newRuleSelector("span", [], null, ".card"), ".card span");
  assert.equal(newRuleSelector("div", ["md:flex"], null), ".md\\:flex");
});

test("parseComputed and formatTokens", () => {
  assert.deepEqual(parseComputed("color: rgb(1, 2, 3); padding: 8px 12px"), {
    color: "rgb(1, 2, 3)",
    padding: "8px 12px",
  });
  assert.match(
    formatTokens(readTokens(STARTER_PREVIEW_CSS)),
    /^Design tokens[\s\S]*--accent: #3b9eff/,
  );
  assert.equal(formatTokens([]), "");
});
