/**
 * The bot's modules for its tests. They import the agent loop, which uses the
 * app's `@/` paths that Node cannot resolve by itself, so tests load them from
 * a bundle built once per test process. It is written under the package's
 * dist/ (gitignored) so the bundle finds TypeScript in the repo's
 * node_modules, and removed when the process exits.
 */
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

type Main = typeof import("./main.ts");
type Run = typeof import("./run.ts");
type Action = typeof import("./action.ts");
type Bundle = { main: Main; run: Run; action: Action };

let loaded: Promise<Bundle> | null = null;

export function bundled(): Promise<Bundle> {
  loaded ??= (async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const out = join(here, "../dist", `test-${process.pid}`);
    process.on("exit", () => rmSync(out, { recursive: true, force: true }));
    await build({
      input: {
        main: join(here, "main.ts"),
        run: join(here, "run.ts"),
        action: join(here, "action.ts"),
      },
      platform: "node",
      cwd: join(here, "../../.."),
      external: ["typescript"],
      output: {
        dir: out,
        format: "cjs",
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name]-[hash].cjs",
      },
      logLevel: "silent",
    });
    const load = createRequire(join(out, "main.cjs"));
    return {
      main: load("./main.cjs") as Main,
      run: load("./run.cjs") as Run,
      action: load("./action.cjs") as Action,
    };
  })();
  return loaded;
}
