// Bundles Aperture Bot as CommonJS: dist/index.cjs (the command line) and
// dist/action.cjs (the GitHub Action), sharing one chunk with the agent loop,
// Aperture Agent Check and the TypeScript compiler, and the compiler's library
// files beside them in dist/lib.
//
//   npm run build:aperture-bot
//
// CommonJS for the same reason as Agent Check's bundle (see its build.mjs).
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
rmSync(dist, { recursive: true, force: true });

await build({
  input: { index: join(here, "src/cli.ts"), action: join(here, "src/action-entry.ts") },
  platform: "node",
  // The agent loop uses the app's `@/` paths, which the root tsconfig maps.
  cwd: join(here, "../.."),
  output: {
    dir: dist,
    format: "cjs",
    entryFileNames: "[name].cjs",
    chunkFileNames: "[name]-[hash].cjs",
  },
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
  `Built packages/aperture-bot/dist/index.cjs and action.cjs with ${copied} library files.`,
);
