/**
 * Design Mode's direct edits: read and rewrite CSS rules and design tokens in
 * the project's own stylesheets, so a picked element can be restyled and a
 * theme retuned without a model. Every change is a plain edit to the source
 * file the rule lives in, never an inline style the project would not keep.
 *
 * Pure: the design pane and the tests import it.
 */

export type CssDeclaration = { prop: string; value: string; start: number; end: number };

export type CssRule = {
  /** The selector text as written, trimmed. */
  selector: string;
  /** Set when the rule sits inside an @media (or other) block. */
  atRule: string | null;
  /** Offsets of the `{` and the matching `}`. */
  open: number;
  close: number;
  declarations: CssDeclaration[];
};

/** Collapses whitespace and comma spacing so `.a ,  .b` and `.a, .b` compare equal. */
export function normalizeSelector(selector: string): string {
  return selector
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([,>+~])\s*/g, "$1")
    .trim();
}

/** Skips a comment or string starting at i; returns the index after it, or i when there is none. */
function skip(css: string, i: number): number {
  if (css[i] === "/" && css[i + 1] === "*") {
    const end = css.indexOf("*/", i + 2);
    return end < 0 ? css.length : end + 2;
  }
  const q = css[i];
  if (q === '"' || q === "'") {
    let j = i + 1;
    while (j < css.length && css[j] !== q) j += css[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  return i;
}

function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const after = skip(css, i);
    if (after !== i) {
      i = after - 1;
      continue;
    }
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i;
  }
  return css.length;
}

function parseDeclarations(css: string, from: number, to: number): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  let start = from;
  let i = from;
  while (i <= to) {
    const after = i < to ? skip(css, i) : i;
    if (after !== i) {
      i = after;
      continue;
    }
    if (i === to || css[i] === ";") {
      const raw = css.slice(start, i);
      const colon = raw.indexOf(":");
      if (colon > 0) {
        const prop = raw
          .slice(0, colon)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim()
          .toLowerCase();
        const value = raw.slice(colon + 1).trim();
        const lead = raw.length - raw.trimStart().length;
        // The last declaration may have no `;`: it ends where its text does, not at the `}`.
        if (prop)
          out.push({
            prop,
            value,
            start: start + lead,
            end: i < to ? i + 1 : start + lead + raw.trim().length,
          });
      }
      start = i + 1;
    }
    i++;
  }
  return out;
}

/** Every style rule in a stylesheet, including those one level inside @media and friends. */
export function parseCss(
  css: string,
  from = 0,
  to = css.length,
  atRule: string | null = null,
): CssRule[] {
  const rules: CssRule[] = [];
  let start = from;
  for (let i = from; i < to; i++) {
    const after = skip(css, i);
    if (after !== i) {
      i = after - 1;
      continue;
    }
    const c = css[i];
    if (c === ";") {
      start = i + 1; // @import, @charset
    } else if (c === "{") {
      const head = css
        .slice(start, i)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      const close = matchingBrace(css, i);
      if (head.startsWith("@")) {
        if (/^@(media|supports|layer|container)\b/.test(head))
          rules.push(...parseCss(css, i + 1, close, head));
      } else if (head) {
        rules.push({
          selector: head,
          atRule,
          open: i,
          close,
          declarations: parseDeclarations(css, i + 1, close),
        });
      }
      i = close;
      start = close + 1;
    }
  }
  return rules;
}

/** The last top-level rule with this selector, as the cascade would let it win. */
export function findRule(css: string, selector: string): CssRule | null {
  const want = normalizeSelector(selector);
  const hits = parseCss(css).filter(
    (r) => r.atRule === null && normalizeSelector(r.selector) === want,
  );
  return hits.at(-1) ?? null;
}

/** Declared values of a rule, last one winning. */
export function ruleValues(rule: CssRule | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of rule?.declarations ?? []) out[d.prop] = d.value;
  return out;
}

function indentOf(css: string, rule: CssRule): string {
  const first = rule.declarations[0];
  if (first) {
    const lineStart = css.lastIndexOf("\n", first.start) + 1;
    const lead = css.slice(lineStart, first.start);
    if (/^\s*$/.test(lead)) return lead;
  }
  return "  ";
}

/**
 * Sets, replaces or (with null) removes declarations in the rule for
 * `selector`, keeping the file's formatting. A rule that does not exist is
 * added at the end of the file.
 */
export function setDeclarations(
  css: string,
  selector: string,
  values: Record<string, string | null>,
): string {
  const rule = findRule(css, selector);
  const entries = Object.entries(values);
  if (!rule) {
    const add = entries.filter(([, v]) => v !== null && v !== "");
    if (add.length === 0) return css;
    const body = add.map(([p, v]) => `  ${p}: ${v};`).join("\n");
    const sep = css.length === 0 || css.endsWith("\n") ? "" : "\n";
    return `${css}${sep}${css.trim() ? "\n" : ""}${selector} {\n${body}\n}\n`;
  }
  let next = css;
  const indent = indentOf(css, rule);
  // Edit from the end so earlier offsets stay valid.
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const appended: string[] = [];
  for (const [prop, value] of entries) {
    const existing = rule.declarations.filter((d) => d.prop === prop);
    const last = existing.at(-1);
    if (value === null || value === "") {
      for (const d of existing) edits.push({ ...wholeLine(css, d.start, d.end), text: "" });
    } else if (last) {
      edits.push({ start: last.start, end: last.end, text: `${prop}: ${value};` });
    } else {
      appended.push(`${indent}${prop}: ${value};`);
    }
  }
  if (appended.length) {
    const before = css.slice(rule.open + 1, rule.close);
    const multiline = before.includes("\n");
    if (multiline) {
      const closeLineStart = css.lastIndexOf("\n", rule.close - 1) + 1;
      const onOwnLine = /^\s*$/.test(css.slice(closeLineStart, rule.close));
      const insertAt = onOwnLine ? closeLineStart : rule.close;
      // `color: red` with no `;` before the new line would run into it.
      const last = rule.declarations.at(-1);
      if (last && needsSemicolon(css, rule))
        edits.push({ start: last.end, end: last.end, text: ";" });
      const lead = onOwnLine ? "" : "\n";
      edits.push({ start: insertAt, end: insertAt, text: `${lead}${appended.join("\n")}\n` });
    } else {
      // A one-line rule: `a { color: red }` becomes `a { color: red; padding: 4px; }`.
      const inner = before.trim().replace(/;?$/, before.trim() ? ";" : "");
      const text = ` ${[inner, ...appended.map((a) => a.trim())].filter(Boolean).join(" ")} `;
      edits.push({ start: rule.open + 1, end: rule.close, text });
    }
  }
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) next = next.slice(0, e.start) + e.text + next.slice(e.end);
  return next;
}

/** The declaration's span, widened to its whole line when it is alone on it. */
function wholeLine(css: string, start: number, end: number): { start: number; end: number } {
  const lineStart = css.lastIndexOf("\n", start - 1) + 1;
  const nl = css.indexOf("\n", end);
  const lineEnd = nl < 0 ? css.length : nl;
  const alone = /^\s*$/.test(css.slice(lineStart, start)) && /^\s*$/.test(css.slice(end, lineEnd));
  return alone && nl >= 0 ? { start: lineStart, end: nl + 1 } : { start, end };
}

function needsSemicolon(css: string, rule: CssRule): boolean {
  const body = css
    .slice(rule.open + 1, rule.close)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trimEnd();
  return body.length > 0 && !body.endsWith(";") && !body.endsWith("{");
}

// ---- tokens -----------------------------------------------------------------

export type TokenKind = "color" | "length" | "font" | "other";
export type DesignToken = { name: string; value: string; kind: TokenKind };

const COLOR_FN = /^(#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color-mix\()/i;

const NAMED_COLORS = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "gray",
  "grey",
  "orange",
  "yellow",
  "purple",
  "pink",
  "teal",
  "navy",
  "silver",
  "maroon",
  "olive",
  "lime",
  "aqua",
  "fuchsia",
  "brown",
  "gold",
  "indigo",
  "violet",
  "crimson",
  "coral",
  "salmon",
  "tomato",
  "khaki",
  "beige",
  "ivory",
  "lavender",
  "plum",
  "orchid",
  "tan",
  "chocolate",
  "cyan",
  "magenta",
]);

export function tokenKind(value: string): TokenKind {
  const v = value.trim();
  if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch)?$/.test(v)) return "length";
  if (COLOR_FN.test(v) || NAMED_COLORS.has(v.toLowerCase())) return "color";
  if (/(sans|serif|mono|system-ui)/i.test(v)) return "font";
  return "other";
}

/** Custom properties declared in top-level `:root` rules: the project's design tokens. */
export function readTokens(css: string): DesignToken[] {
  const out = new Map<string, DesignToken>();
  for (const rule of parseCss(css)) {
    if (rule.atRule !== null || !/(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selector)) continue;
    for (const d of rule.declarations) {
      if (d.prop.startsWith("--"))
        out.set(d.prop, { name: d.prop, value: d.value, kind: tokenKind(d.value) });
    }
  }
  return [...out.values()];
}

/** Sets tokens in the `:root` rule that declares them (or the last `:root`). */
export function setTokens(css: string, values: Record<string, string>): string {
  const roots = parseCss(css).filter(
    (r) => r.atRule === null && /^:root$/.test(normalizeSelector(r.selector)),
  );
  const selector = roots.length ? roots.at(-1)!.selector : ":root";
  return setDeclarations(css, selector, values);
}

// ---- colours -----------------------------------------------------------------

/** `#abc`, `#aabbcc`, `rgb(…)`: the #rrggbb an <input type="color"> needs, or null. */
export function toHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v);
  if (rgb)
    return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
  return null;
}

/** `var(--accent)` → `--accent`. */
export function tokenRef(value: string): string | null {
  return /^var\(\s*(--[\w-]+)\s*(,[^)]*)?\)$/.exec(value.trim())?.[1] ?? null;
}

// ---- themes ------------------------------------------------------------------

export type ThemeRole = "bg" | "surface" | "border" | "text" | "muted" | "accent";

/** Which role a token plays, read from its name. */
export function tokenRole(name: string): ThemeRole | null {
  const n = name.toLowerCase();
  if (/(accent|primary|brand|link)/.test(n)) return "accent";
  if (/(muted|subtle|secondary|dim)/.test(n)) return "muted";
  if (/(border|line|stroke|divider|outline)/.test(n)) return "border";
  if (/(card|surface|panel|elevated|raised)/.test(n)) return "surface";
  if (/(^--(bg|background|base|canvas)$|-bg$|background$)/.test(n)) return "bg";
  if (/(^--(fg|text|ink|foreground)$|-fg$|-text$|foreground$)/.test(n)) return "text";
  return null;
}

export type ThemePreset = { id: string; name: string; colors: Record<ThemeRole, string> };

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      bg: "#0b0b0e",
      surface: "#121214",
      border: "#1f1f24",
      text: "#e8e8ed",
      muted: "#8b8b93",
      accent: "#3b9eff",
    },
  },
  {
    id: "paper",
    name: "Paper",
    colors: {
      bg: "#fafaf7",
      surface: "#ffffff",
      border: "#e6e4dd",
      text: "#1d1c19",
      muted: "#6b6960",
      accent: "#2f6fdb",
    },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      bg: "#0f1512",
      surface: "#16201b",
      border: "#24332b",
      text: "#e3efe7",
      muted: "#8aa596",
      accent: "#3fbf7f",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      bg: "#1a1216",
      surface: "#241a1f",
      border: "#3a2a31",
      text: "#f5e8ec",
      muted: "#b0959e",
      accent: "#ff7a59",
    },
  },
  {
    id: "grape",
    name: "Grape",
    colors: {
      bg: "#120f1a",
      surface: "#1b1726",
      border: "#2c2640",
      text: "#ece8f7",
      muted: "#9d95b5",
      accent: "#a674ff",
    },
  },
];

/** The token values a preset sets, for the colour tokens whose role it knows. */
export function presetValues(tokens: DesignToken[], preset: ThemePreset): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tokens) {
    if (t.kind !== "color") continue;
    const role = tokenRole(t.name);
    if (role) out[t.name] = preset.colors[role];
  }
  return out;
}

// ---- the picked element --------------------------------------------------------

/** The computed styles the picker sends ("color: rgb(…); padding: 8px"), as a map. */
export function parseComputed(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of css.split(/;\s*/)) {
    const colon = part.indexOf(":");
    if (colon > 0) out[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return out;
}

export type MatchedRule = { from: string; selector: string };

/** Selectors that style far more than the picked element: never a default edit target. */
const BROAD = /^(\*|html|body|:root)$/;

/** A class or id as it has to be written in a selector (`md:flex` → `md\:flex`). */
function escapeIdent(name: string): string {
  return name.replace(/[^\w-]/g, (ch) => `\\${ch}`).replace(/^(\d)/, "\\3$1 ");
}

/**
 * The rule a style edit should go to: the last matching rule in a project
 * stylesheet whose selector ends in one of the element's own classes or its
 * id, else the last one that ends in its tag (`.card button`), else none, and
 * a new rule is added. Broad rules (`*`, `body`) are never picked: an edit
 * there would restyle the whole page.
 */
export function pickTargetRule(
  rules: MatchedRule[],
  classes: string[],
  id: string | null,
  tag = "",
): MatchedRule | null {
  const lasts = (r: MatchedRule) =>
    normalizeSelector(r.selector)
      .split(",")
      .map(
        (part) =>
          part
            .trim()
            .split(/[ >+~]/)
            .at(-1) ?? "",
      );
  const own = rules.filter((r) =>
    lasts(r).some(
      (last) =>
        classes.some((c) => last.includes(`.${escapeIdent(c)}`) || last.includes(`.${c}`)) ||
        (id !== null && (last.includes(`#${escapeIdent(id)}`) || last.includes(`#${id}`))),
    ),
  );
  if (own.length) return own.at(-1)!;
  const byTag = tag
    ? rules.filter((r) =>
        lasts(r).some(
          (last) =>
            !BROAD.test(last) &&
            new RegExp(`^${tag.replace(/[^\w-]/g, "")}(?![\\w-])`, "i").test(last),
        ),
      )
    : [];
  return byTag.at(-1) ?? null;
}

/**
 * A selector for a new rule: the first class, else the id, else the tag
 * scoped to the nearest ancestor with a class or id (`.card span`), so a
 * classless element does not restyle every element of its kind.
 */
export function newRuleSelector(
  tag: string,
  classes: string[],
  id: string | null,
  scope: string | null = null,
): string {
  if (classes[0]) return `.${escapeIdent(classes[0])}`;
  if (id) return `#${escapeIdent(id)}`;
  return scope ? `${scope} ${tag}` : tag;
}

/** Tokens as a short block for Composer, so a model reuses them instead of hard-coding values. */
export function formatTokens(tokens: DesignToken[]): string {
  if (tokens.length === 0) return "";
  return [
    "Design tokens (use these with var(--name); do not hard-code their values):",
    ...tokens.slice(0, 40).map((t) => `${t.name}: ${t.value}`),
  ].join("\n");
}
