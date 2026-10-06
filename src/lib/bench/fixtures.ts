/**
 * Two more projects for the benchmark, unlike the first two in shape: a React
 * shop UI in TypeScript that imports through barrel files and is tested with
 * Vitest, and a plain JavaScript CLI in CommonJS tested with Jest. Every test
 * in both passes before any edit.
 */

const TSCONFIG = JSON.stringify(
  { compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true } },
  null,
  2,
);

export const SHOP_UI: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "shop-ui",
      private: true,
      type: "module",
      scripts: { test: "vitest run" },
      dependencies: { react: "^19.0.0" },
      devDependencies: { vitest: "^3.2.0" },
    },
    null,
    2,
  ),
  "tsconfig.json": TSCONFIG,
  "src/format.ts": `/** Cents as a price: 1999 → "$19.99". */
export function formatPrice(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return \`\${sign}$\${Math.floor(abs / 100)}.\${String(abs % 100).padStart(2, "0")}\`;
}
`,
  "src/cart.ts": `export type Item = { sku: string; name: string; cents: number; quantity: number };
export type Cart = { items: Item[]; coupon: string | null };

export const emptyCart: Cart = { items: [], coupon: null };

export type Action =
  | { type: "add"; item: Omit<Item, "quantity"> }
  | { type: "remove"; sku: string }
  | { type: "coupon"; code: string | null };

export function cartReducer(cart: Cart, action: Action): Cart {
  switch (action.type) {
    case "add": {
      const found = cart.items.find((item) => item.sku === action.item.sku);
      const items = found
        ? cart.items.map((item) => (item.sku === action.item.sku ? { ...item, quantity: item.quantity + 1 } : item))
        : [...cart.items, { ...action.item, quantity: 1 }];
      return { ...cart, items };
    }
    case "remove": {
      const items = cart.items
        .map((item) => (item.sku === action.sku ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0);
      return { ...cart, items };
    }
    case "coupon":
      return { ...cart, coupon: action.code };
  }
}

/** The total in cents, after a coupon: SAVE10 takes 10% off. */
export function cartTotal(cart: Cart): number {
  const sum = cart.items.reduce((total, item) => total + item.cents * item.quantity, 0);
  return cart.coupon === "SAVE10" ? Math.round(sum * 0.9) : sum;
}
`,
  "src/index.ts": `export * from "./format";
export { cartReducer, cartTotal, emptyCart } from "./cart";
export type { Action, Cart, Item } from "./cart";
`,
  "src/components/PriceTag.tsx": `import React from "react";
import { formatPrice } from "../index";

export function PriceTag({ cents, sale = false }: { cents: number; sale?: boolean }) {
  return <span className={sale ? "price price-sale" : "price"}>{formatPrice(cents)}</span>;
}
`,
  "src/components/CartSummary.tsx": `import React from "react";
import { cartTotal, type Cart } from "../index";
import { PriceTag } from "./PriceTag";

export function CartSummary({ cart }: { cart: Cart }) {
  const count = cart.items.reduce((n, item) => n + item.quantity, 0);
  return (
    <p className="cart-summary">
      {count} {count === 1 ? "item" : "items"} · <PriceTag cents={cartTotal(cart)} />
    </p>
  );
}
`,
  "src/components/index.ts": `export { CartSummary } from "./CartSummary";
export { PriceTag } from "./PriceTag";
`,
  "src/cart.test.ts": `import { describe, expect, it } from "vitest";
import { cartReducer, cartTotal, emptyCart } from "./index";

const shirt = { sku: "tee", name: "T-shirt", cents: 1500 };
const mug = { sku: "mug", name: "Mug", cents: 900 };

describe("cart", () => {
  it("adds a second of the same item as quantity, not a new line", () => {
    const cart = cartReducer(cartReducer(emptyCart, { type: "add", item: shirt }), { type: "add", item: shirt });
    expect(cart.items).toEqual([{ ...shirt, quantity: 2 }]);
  });

  it("removes one at a time and drops the line at zero", () => {
    let cart = cartReducer(emptyCart, { type: "add", item: mug });
    cart = cartReducer(cart, { type: "add", item: mug });
    cart = cartReducer(cart, { type: "remove", sku: "mug" });
    expect(cart.items[0]?.quantity).toBe(1);
    cart = cartReducer(cart, { type: "remove", sku: "mug" });
    expect(cart.items).toEqual([]);
  });

  it("totals in cents and applies SAVE10", () => {
    let cart = cartReducer(emptyCart, { type: "add", item: shirt });
    cart = cartReducer(cart, { type: "add", item: mug });
    expect(cartTotal(cart)).toBe(2400);
    expect(cartTotal(cartReducer(cart, { type: "coupon", code: "SAVE10" }))).toBe(2160);
  });
});
`,
  "src/format.test.ts": `import { expect, it } from "vitest";
import { formatPrice } from "./format";

it("formats cents as dollars", () => {
  expect(formatPrice(1999)).toBe("$19.99");
  expect(formatPrice(5)).toBe("$0.05");
  expect(formatPrice(-250)).toBe("-$2.50");
});
`,
};

export const NOTES_CLI: Record<string, string> = {
  "package.json": JSON.stringify(
    { name: "notes-cli", private: true, bin: { notes: "bin/notes.js" }, scripts: { test: "jest" }, devDependencies: { jest: "^29.7.0" } },
    null,
    2,
  ),
  "src/parse.js": `/** "Buy milk #home #errand" → { text: "Buy milk", tags: ["home", "errand"] } */
function parseNote(line) {
  const tags = [];
  const words = [];
  for (const word of line.trim().split(/\\s+/)) {
    if (word.startsWith("#") && word.length > 1) tags.push(word.slice(1).toLowerCase());
    else if (word) words.push(word);
  }
  return { text: words.join(" "), tags };
}

/** The old format, "text | tag,tag". Kept for notes files written before 1.0. */
function parseLegacy(line) {
  const [text, tagList = ""] = line.split("|");
  return {
    text: text.trim(),
    tags: tagList
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  };
}

module.exports = { parseNote, parseLegacy };
`,
  "src/notes.js": `const { parseNote } = require("./parse");

/** Notes from a file's text, one per non-empty line. */
function readNotes(text) {
  return text
    .split("\\n")
    .filter((line) => line.trim())
    .map(parseNote);
}

/** Notes carrying every one of the tags. */
function withTags(notes, tags) {
  return notes.filter((note) => tags.every((tag) => note.tags.includes(tag)));
}

module.exports = { readNotes, withTags };
`,
  "bin/notes.js": `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const { readNotes, withTags } = require("../src/notes");

const [file, ...tags] = process.argv.slice(2);
if (!file) {
  console.log("Usage: notes <file> [tag ...]");
  process.exit(1);
}
for (const note of withTags(readNotes(readFileSync(file, "utf8")), tags)) {
  console.log(\`\${note.text}\${note.tags.length ? \`  #\${note.tags.join(" #")}\` : ""}\`);
}
`,
  "test/notes.test.js": `const { parseNote, parseLegacy } = require("../src/parse");
const { readNotes, withTags } = require("../src/notes");

test("parseNote splits text from tags and lower-cases the tags", () => {
  expect(parseNote("Buy milk #Home #errand")).toEqual({ text: "Buy milk", tags: ["home", "errand"] });
  expect(parseNote("  # not a tag ")).toEqual({ text: "# not a tag", tags: [] });
});

test("parseLegacy reads the pre-1.0 format", () => {
  expect(parseLegacy("Call Sam | work, Phone")).toEqual({ text: "Call Sam", tags: ["work", "phone"] });
});

test("readNotes skips blank lines and withTags needs every tag", () => {
  const notes = readNotes("Buy milk #home #errand\\n\\nShip release #work\\nPost parcel #errand\\n");
  expect(notes).toHaveLength(3);
  expect(withTags(notes, ["errand"]).map((note) => note.text)).toEqual(["Buy milk", "Post parcel"]);
  expect(withTags(notes, ["errand", "home"]).map((note) => note.text)).toEqual(["Buy milk"]);
});
`,
};
