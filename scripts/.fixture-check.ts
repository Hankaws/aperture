import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import ts from "typescript";
import { buildBundle } from "../src/lib/runner/bundle.ts";
import { executeBundle } from "../src/lib/runner/node-exec.ts";
import { planBrowserRun } from "../src/lib/runner/plan.ts";
import { checkProject, compilerOptions, libFilesFor, tscIssue } from "../src/lib/workspace/tsc-core.ts";
import { isTsPath } from "../src/lib/workspace/tsc-core.ts";
import { NOTES_CLI, SHOP_UI } from "../src/lib/bench/fixtures.ts";
const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (n: string) => { try { return readFileSync(join(libDir, n), "utf8"); } catch { return undefined; } };
for (const [name, files] of Object.entries({ "shop-ui": SHOP_UI, "notes-cli": NOTES_CLI })) {
  const plan = planBrowserRun(files);
  if (!plan.ok) { console.log(name, "PLAN", plan.reason); continue; }
  const bundle = buildBundle(files, plan.entries, plan);
  if (!bundle.ok) { console.log(name, "BUNDLE", bundle.reason); continue; }
  const done = await executeBundle(bundle.code, 10000);
  console.log(name, "tests:", done.passed ? "PASS" : "FAIL", `pass=${done.pass} fail=${done.fail}`, done.firstFailure ?? "", done.unsupported ?? "");
  const tsPaths = Object.keys(files).filter(isTsPath);
  if (tsPaths.length) {
    const opts = compilerOptions(ts, files);
    const r = checkProject(ts, files, tsPaths, libFilesFor(ts, opts, readLib), opts);
    console.log(name, "tsc:", r.ok ? JSON.stringify(Object.fromEntries(Object.entries(r.diagnostics).filter(([, v]) => v.length).map(([k, v]) => [k, v.map(tscIssue)]))) : r.reason);
  }
}
