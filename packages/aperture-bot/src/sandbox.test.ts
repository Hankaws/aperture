import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cannotRun, copyProject, dockerArgs } from "./sandbox.ts";

test("the container has no network, no environment of the runner's, and read-only packages", () => {
  const args = dockerArgs({
    work: "/tmp/w",
    modules: "/repo/node_modules",
    script: "test",
    image: "node:22-slim",
    name: "aperture-bot-x",
    user: "1001:1001",
  });
  assert.deepEqual(args.slice(args.indexOf("--network"), args.indexOf("--network") + 2), [
    "--network",
    "none",
  ]);
  const env = args.flatMap((arg, i) => (args[i - 1] === "-e" ? [arg.split("=")[0]] : []));
  assert.deepEqual(env, ["CI", "HOME", "FORCE_COLOR", "NO_COLOR"]);
  assert.ok(args.includes("/repo/node_modules:/work/node_modules:ro"));
  assert.ok(args.includes("/tmp/w:/work"));
  assert.deepEqual(args.slice(-4), ["node:22-slim", "npm", "run", "test"]);
  assert.ok(!args.includes("--privileged"));
});

test("a run works on a copy without .git or node_modules, with the agent's files over it", () => {
  const dir = mkdtempSync(join(tmpdir(), "aperture-bot-copy-"));
  mkdirSync(join(dir, ".git"));
  mkdirSync(join(dir, "node_modules/x"), { recursive: true });
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, ".git/config"), "secret remote");
  writeFileSync(join(dir, "src/a.ts"), "old");
  const work = copyProject(dir, { "src/a.ts": "new", "src/b.ts": "added" });
  assert.equal(readFileSync(join(work, "src/a.ts"), "utf8"), "new");
  assert.equal(readFileSync(join(work, "src/b.ts"), "utf8"), "added");
  assert.equal(existsSync(join(work, ".git")), false);
  assert.equal(existsSync(join(work, "node_modules")), false);
  assert.equal(readFileSync(join(dir, "src/a.ts"), "utf8"), "old", "the checkout is untouched");
});

test("a run says why it cannot start", () => {
  const dir = mkdtempSync(join(tmpdir(), "aperture-bot-pkg-"));
  assert.match(cannotRun(dir, "test", join(dir, "node_modules"))!, /no readable package\.json/);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { lint: "x" } }));
  assert.match(cannotRun(dir, "test", join(dir, "node_modules"))!, /no "test" script/);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ scripts: { test: "x" }, devDependencies: { vitest: "1" } }),
  );
  assert.match(cannotRun(dir, "test", join(dir, "node_modules"))!, /npm ci --ignore-scripts/);
  mkdirSync(join(dir, "node_modules"));
  assert.equal(cannotRun(dir, "test", join(dir, "node_modules")), null);
});
