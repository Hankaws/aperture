// Bundles Aperture Agent Check into one CommonJS file a GitHub Action runs
// with no install: dist/index.cjs, with the TypeScript compiler inside it and
// the compiler's library files beside it in dist/lib.
//
//   npm run build:agent-check
//
// CommonJS, not an ES module: the compiler reads __filename when it loads,
// which an ES module bundle does not have (the same reason the app's server
// build keeps TypeScript out of its bundle; see vite.config.ts).
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
rmSync(dist, { recursive: true, force: true });

await build({
  input: join(here, "src/cli.ts"),
  platform: "node",
  output: { file: join(dist, "index.cjs"), format: "cjs" },
  logLevel: "warn",
});

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
mkdirSync(join(dist, "lib"));
let copied = 0;
for (const name of readdirSync(libDir)) {
  if (!/^lib\..*\.d\.ts$|^lib\.d\.ts$/.test(name)) continue;
  copyFileSync(join(libDir, name), join(dist, "lib", name));
  copied += 1;
}
console.log(
  `Built ${join("packages/agent-check/dist", "index.cjs")} with ${copied} library files.`,
);
