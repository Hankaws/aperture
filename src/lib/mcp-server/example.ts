/**
 * The worked example on /agents: a change an agent might make, and what
 * `check_change` answers. `example.test.ts` runs the real checks on it and
 * requires `answer` word for word, so the page cannot drift from the server.
 */

/** Bad edits in the benchmark that check_change stops without running tests (protocol.test.ts holds it to this). */
export const AGENT_STOPS = 19;

export const EXAMPLE = {
  files: {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "ESNext",
        moduleResolution: "bundler",
        target: "ES2022",
      },
    }),
    "src/price.ts":
      "export function formatPrice(cents: number): string {\n  return `$${(cents / 100).toFixed(2)}`;\n}\n",
    "src/cart.ts":
      'import { formatPrice } from "./price";\n\nexport function cartLabel(items: number, cents: number): string {\n  return `${items} items · ${formatPrice(cents)}`;\n}\n',
  },
  changes: {
    "src/price.ts":
      'export function formatPrice(cents: number, currency: string): string {\n  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);\n}\n',
  },
  answer: [
    "Do not apply this change as it is: 1 check red on 1 changed file. Fix what it says and call check_change again.",
    "",
    "✓ Parses: 1 file parses.",
    "✓ Imports resolve: Every import in 1 script resolves.",
    "✗ Types: src/cart.ts: TS2554 at line 4: Expected 2 arguments, but got 1.",
    "    src/cart.ts: TS2554 at line 4: Expected 2 arguments, but got 1.",
    "    src/cart.ts:",
    "      2 | ",
    "      3 | export function cartLabel(items: number, cents: number): string {",
    "    > 4 |   return `${items} items · ${formatPrice(cents)}`;",
    "      5 | }",
    "      6 | ",
    "– Tests: Not run: this server does not run code. Run the project's tests before you apply the change.",
  ].join("\n"),
};
