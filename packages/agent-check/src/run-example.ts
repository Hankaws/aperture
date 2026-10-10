/**
 * The run shown on /agent-check: a change to a small project, and what
 * Aperture Agent Check says about it, word for word. `run-example.test.ts`
 * builds this repository, runs the tool on it, and requires these rows and
 * annotations, so the page cannot drift from what the action prints.
 *
 * The project is the action repository's example/.
 */

/** What a workflow writes to use the action. */
export const ACTION_USES = "hankaws/aperture-agent-check@v1.1";
export const ACTION_REPO = "https://github.com/Hankaws/aperture-agent-check";

export const RUN_EXAMPLE = {
  base: {
    "package.json":
      '{\n  "name": "aperture-agent-check-example",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "test": "node --experimental-strip-types --test \'test/**/*.test.ts\'"\n  }\n}\n',
    "tsconfig.json":
      '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "strict": true,\n    "noEmit": true,\n    "allowImportingTsExtensions": true\n  }\n}\n',
    "src/price.ts":
      '/** Cents as a price: 1999 → "$19.99". */\nexport function formatPrice(cents: number): string {\n  return `$${(cents / 100).toFixed(2)}`;\n}\n',
    "src/cart.ts":
      'import { formatPrice } from "./price.ts";\n\nexport type Item = { name: string; cents: number; quantity: number };\n\nexport function cartTotal(items: Item[]): number {\n  return items.reduce((total, item) => total + item.cents * item.quantity, 0);\n}\n\nexport function cartLabel(items: Item[]): string {\n  const count = items.reduce((n, item) => n + item.quantity, 0);\n  return `${count} ${count === 1 ? "item" : "items"} · ${formatPrice(cartTotal(items))}`;\n}\n',
    "test/cart.test.ts":
      'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { cartLabel, cartTotal } from "../src/cart.ts";\n\nconst items = [\n  { name: "Tee", cents: 1500, quantity: 2 },\n  { name: "Mug", cents: 900, quantity: 1 },\n];\n\ntest("the total counts every item\'s quantity", () => {\n  assert.equal(cartTotal(items), 3900);\n});\n\ntest("the label says how many items and what they cost", () => {\n  assert.equal(cartLabel(items), "3 items · $39.00");\n});\n',
  } as Record<string, string>,
  change: {
    "src/price.ts":
      '/** Cents as a price, in any currency. */\nexport function formatPrice(cents: number, currency: string): string {\n  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);\n}\n',
  } as Record<string, string>,
  headline: "Aperture Agent Check: 2 checks red on 1 changed file. Do not merge this as it is.",
  rows: [
    {
      status: "pass",
      label: "Parses",
      detail: "1 file parses.",
    },
    {
      status: "pass",
      label: "Imports resolve",
      detail: "Every import in 1 script resolves.",
    },
    {
      status: "fail",
      label: "Types",
      detail: "src/cart.ts: TS2554 at line 11: Expected 2 arguments, but got 1.",
    },
    {
      status: "fail",
      label: "Tests pass",
      detail:
        "npm run test fails on this runner: not ok 2 - the label says how many items and what they cost",
    },
  ] as Array<{ status: "pass" | "fail" | "warn" | "skip"; label: string; detail: string }>,
  annotations: [
    "::error file=src/cart.ts,line=11,title=Aperture Agent Check%3A Types::TS2554 at line 11: Expected 2 arguments, but got 1.",
  ],
};
