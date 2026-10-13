import assert from "node:assert/strict";
import test from "node:test";
import { HOOKS_PATH } from "./hooks.ts";
import { sha256 } from "./sha256.ts";
import { checksMatch, verificationId, verificationMaterial } from "./verify-id.ts";

const edit = (path: string, newText: string) => ({ path, newText });

test("sha256 matches the known vectors", () => {
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("the id changes when the staged text, the base, the scripts, the lockfile or the hooks change", () => {
  const files = {
    "src/a.ts": "export const a = 1;\n",
    "package.json": JSON.stringify({ scripts: { test: "node old.js" } }),
    "package-lock.json": "{}\n",
    [HOOKS_PATH]: JSON.stringify({ hooks: [{ run: "test", on: ["stage"], files: ["src/**"] }] }),
  };
  const edits = [edit("src/a.ts", "export const a = 2;\n")];
  const id = verificationId({ runtime: "browser", files, edits });
  assert.equal(id, verificationId({ runtime: "browser", files, edits }));
  assert.notEqual(id, verificationId({ runtime: "browser", files, edits: [edit("src/a.ts", "export const a = 3;\n")] }));
  assert.notEqual(id, verificationId({ runtime: "browser", files: { ...files, "src/a.ts": "export const a = 0;\n" }, edits }));
  assert.notEqual(
    id,
    verificationId({
      runtime: "browser",
      files: { ...files, "package.json": JSON.stringify({ scripts: { test: "node next.js" } }) },
      edits,
    }),
  );
  assert.notEqual(id, verificationId({ runtime: "browser", files: { ...files, "package-lock.json": "{1}\n" }, edits }));
  assert.notEqual(
    id,
    verificationId({
      runtime: "browser",
      files: { ...files, [HOOKS_PATH]: JSON.stringify({ hooks: [{ run: "lint", on: ["stage"] }] }) },
      edits,
    }),
  );
  assert.notEqual(id, verificationId({ runtime: "node", files, edits }));
});

test("a staged package.json rewrite is in the id, and the applied hooks file is what counts", () => {
  const files = {
    "src/a.ts": "export const a = 1;\n",
    "package.json": JSON.stringify({ scripts: { "check:api": "node old.js" } }),
    [HOOKS_PATH]: JSON.stringify([{ run: "check:api", on: ["stage"], files: ["src/**"] }]),
  };
  const rewritten = [edit("src/a.ts", "export const a = 2;\n"), edit("package.json", JSON.stringify({ scripts: { "check:api": "node rewritten.js" } }))];
  const other = [edit("src/a.ts", "export const a = 2;\n"), edit("package.json", JSON.stringify({ scripts: { "check:api": "node other.js" } }))];
  assert.notEqual(
    verificationId({ runtime: "browser", files, edits: rewritten }),
    verificationId({ runtime: "browser", files, edits: other }),
  );
  const material = verificationMaterial({ runtime: "browser", files, edits: rewritten });
  assert.match(material, /node rewritten\.js/);
  const stagedMaterial = verificationMaterial({
    runtime: "browser",
    files,
    edits: [...rewritten, edit(HOOKS_PATH, JSON.stringify([{ run: "gone", on: ["stage"] }]))],
  });
  assert.match(stagedMaterial, /"hookScripts":\[\["check:api","node rewritten\.js"\]\]/);
});

test("Apply matches only the id the checks settled on", () => {
  const files = { "src/a.ts": "export const a = 1;\n" };
  const edits = [edit("src/a.ts", "export const a = 2;\n")];
  const id = verificationId({ runtime: "browser", files, edits });
  assert.equal(checksMatch(id, files, edits), true);
  assert.equal(checksMatch(id, files, [edit("src/a.ts", "export const a = 9;\n")]), false);
  assert.equal(checksMatch(undefined, files, edits), false);
});
