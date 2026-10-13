#!/usr/bin/env node
/**
 * Count one repository the way the editor and Agent Check do, and write
 * src/lib/bench/large-repo.json. /benchmark publishes that file.
 *
 *   node scripts/measure-large-repo.mjs /path/to/clone
 *
 * With no path, clones nestjs/nest (shallow) under /tmp and counts that.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filesAt } from "../packages/agent-check/src/git.ts";
import { isRelevant, LOAD_LIMITS } from "../packages/agent-check/src/project.ts";
import { isTsPath } from "../src/lib/workspace/tsc-core.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const name = "nestjs/nest";
const url = "https://github.com/nestjs/nest";

function clone() {
  const dest = "/tmp/nestjs-nest";
  mkdirSync("/tmp", { recursive: true });
  execFileSync("git", ["clone", "--depth", "1", "--quiet", `${url}.git`, dest], { stdio: "inherit" });
  return dest;
}

const cwd = process.argv[2] ?? clone();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
const commitDate = execFileSync("git", ["log", "-1", "--format=%cs"], { cwd, encoding: "utf8" }).trim();
const files = filesAt("HEAD", cwd);
const relevant = files.filter((file) => isRelevant(file.path) && file.bytes <= LOAD_LIMITS.fileBytes);
const ts = files.filter((file) => isTsPath(file.path));
const sum = (list) => list.reduce((n, file) => n + file.bytes, 0);
const measured = new Date().toISOString().slice(0, 10);
const out = {
  name,
  url,
  commit,
  commitDate,
  measured,
  relevantFiles: relevant.length,
  relevantBytes: sum(relevant),
  tsFiles: ts.length,
  tsBytes: sum(ts),
};
const dest = join(root, "src/lib/bench/large-repo.json");
writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(dest);
console.log(JSON.stringify(out, null, 2));
