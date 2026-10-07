#!/usr/bin/env node
// Runs a built Aperture Agent Check bundle the way the action does, on two
// throwaway repositories: a change that breaks a caller must fail the step
// with an annotation on the caller's line, and a correct one must pass.
//
//   node packages/agent-check/smoke.mjs packages/agent-check/dist/index.cjs
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const bundle = resolve(process.argv[2] ?? "packages/agent-check/dist/index.cjs");
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
};

function repo(change) {
  const dir = mkdtempSync(join(tmpdir(), "agent-check-smoke-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  const write = (files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "smoke@example.com");
  git("config", "user.name", "Smoke");
  write({
    "package.json": JSON.stringify({
      name: "smoke",
      private: true,
      scripts: { test: "node test.js" },
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: { strict: true, module: "ESNext", moduleResolution: "bundler" },
    }),
    "src/price.ts":
      "export function formatPrice(cents: number): string {\n  return String(cents);\n}\n",
    "src/cart.ts":
      'import { formatPrice } from "./price";\n\nexport const label = formatPrice(100);\n',
    "test.js": 'console.log("ok");\n',
  });
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  git("checkout", "-q", "-b", "change");
  write(change);
  git("add", "-A");
  git("commit", "-q", "-m", "change");
  return dir;
}

function run(dir) {
  const out = mkdtempSync(join(tmpdir(), "agent-check-smoke-out-"));
  writeFileSync(join(out, "summary.md"), "");
  writeFileSync(join(out, "output.txt"), "");
  const result = spawnSync(process.execPath, [bundle], {
    cwd: out,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      GITHUB_ACTIONS: "true",
      GITHUB_WORKSPACE: dir,
      INPUT_BASE: "main",
      GITHUB_STEP_SUMMARY: join(out, "summary.md"),
      GITHUB_OUTPUT: join(out, "output.txt"),
    },
  });
  return {
    ...result,
    summary: readFileSync(join(out, "summary.md"), "utf8"),
    output: readFileSync(join(out, "output.txt"), "utf8"),
  };
}

const broken = run(
  repo({
    "src/price.ts":
      "export function formatPrice(cents: number, currency: string): string {\n  return currency + cents;\n}\n",
  }),
);
check(broken.status === 1, `a change that breaks a caller fails the step (exit ${broken.status})`);
check(
  broken.stdout.includes(
    "::error file=src/cart.ts,line=3,title=Aperture Agent Check%3A Types::TS2554",
  ),
  "the caller's line gets an annotation",
);
check(/1 check red on 1 changed file/.test(broken.summary), "the run summary says what is red");
check(broken.output === "verdict=red\n", "the verdict output is red");
check(
  /Tests pass: npm run test passed on this runner/.test(broken.stdout),
  "the project's tests ran on the runner",
);

const fine = run(
  repo({
    "src/cart.ts":
      'import { formatPrice } from "./price";\n\nexport const label = formatPrice(250);\n',
  }),
);
check(fine.status === 0, `a correct change passes (exit ${fine.status})`);
check(fine.output === "verdict=clear\n", "the verdict output is clear");

if (failures.length > 0) {
  console.error(`\n${failures.length} bundle check(s) failed.\n${broken.stdout}\n${broken.stderr}`);
  process.exit(1);
}
console.log("\nThe bundle works.");
