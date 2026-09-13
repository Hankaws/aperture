#!/usr/bin/env node
/** Nitro hashed pglite assets; the server looks for unhashed names. */
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const assets = join(root, ".vercel/output/static/assets");
const libs = join(root, ".vercel/output/functions/__server.func/_libs");
if (!existsSync(assets) || !existsSync(libs)) process.exit(0);

const files = readdirSync(assets);
function copy(pattern, destName) {
  const src = files.find((name) => pattern.test(name));
  if (!src) return;
  copyFileSync(join(assets, src), join(libs, destName));
}

copy(/^pglite-.*\.data$/, "pglite.data");
copy(/^pglite-.*\.wasm$/, "pglite.wasm");
copy(/^initdb-.*\.wasm$/, "initdb.wasm");
