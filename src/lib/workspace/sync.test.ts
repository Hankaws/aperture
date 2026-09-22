import assert from "node:assert/strict";
import test from "node:test";
import { applyStackMemory } from "../agent/stack.ts";
import { DEMO_FILES, DEMO_WORKSPACE_NAME } from "./demo-repo.ts";
import {
  checkSyncLimits,
  decideSync,
  hasUnsavedEdits,
  isDisposable,
  workspaceHash,
  type LocalSnapshot,
  type RemoteSnapshot,
} from "./sync.ts";

const files = (extra: Record<string, string> = {}) => ({ "a.ts": "export const a = 1;", ...extra });

/**
 * Synced against the baseline, so passing different `files` makes it dirty —
 * which is the state most of these cases are about. Hashing the overridden
 * files here instead would make "has unsaved edits" impossible to express.
 */
const BASE_NAME = "proj";
function local(over: Partial<LocalSnapshot> = {}): LocalSnapshot {
  return {
    name: BASE_NAME,
    files: files(),
    revision: 1,
    syncedHash: workspaceHash(BASE_NAME, files()),
    ...over,
  };
}

function remote(over: Partial<RemoteSnapshot> = {}): RemoteSnapshot {
  return { name: "proj", files: files(), revision: 1, ...over };
}

test("the hash ignores key order but tracks content and name", () => {
  assert.equal(workspaceHash("p", { a: "1", b: "2" }), workspaceHash("p", { b: "2", a: "1" }));
  assert.notEqual(workspaceHash("p", { a: "1" }), workspaceHash("p", { a: "2" }));
  assert.notEqual(workspaceHash("p", { a: "1" }), workspaceHash("q", { a: "1" }));
  // A path/content boundary that a naive concatenation would collide on.
  assert.notEqual(workspaceHash("p", { ab: "c" }), workspaceHash("p", { a: "bc" }));
});

test("unsaved edits are detected, and a never-synced copy always counts as dirty", () => {
  assert.equal(hasUnsavedEdits(local()), false);
  assert.equal(hasUnsavedEdits(local({ files: files({ "b.ts": "new" }) })), true);
  assert.equal(hasUnsavedEdits(local({ syncedHash: null })), true);
});

test("an empty or untouched-demo workspace is disposable", () => {
  const demo = files({ "demo.ts": "x" });
  const demoHash = workspaceHash("demo", demo);
  assert.equal(isDisposable(local({ files: {} }), demoHash), true);
  assert.equal(isDisposable(local({ name: "demo", files: demo }), demoHash), true);
  assert.equal(isDisposable(local(), demoHash), false);
  // With no demo hash known, real files are never disposable.
  assert.equal(isDisposable(local(), null), false);
});

test("nothing saved yet pushes real work and ignores a starter", () => {
  assert.equal(decideSync(local(), null).kind, "push");
  assert.equal(decideSync(local({ files: {} }), null).kind, "idle");
});

test("a starter workspace adopts whatever was saved", () => {
  const demo = files({ "demo.ts": "x" });
  const demoHash = workspaceHash("demo", demo);
  const decision = decideSync(local({ name: "demo", files: demo }), remote(), demoHash);
  assert.equal(decision.kind, "adopt");
});

test("same revision: push when dirty, idle when clean", () => {
  assert.equal(decideSync(local(), remote()).kind, "idle");
  const dirty = local({ files: files({ "b.ts": "new" }) });
  assert.equal(decideSync(dirty, remote()).kind, "push");
});

test("a newer saved copy is adopted only when this device is clean", () => {
  assert.equal(decideSync(local(), remote({ revision: 5 })).kind, "adopt");
  const dirty = local({ files: files({ "b.ts": "new" }) });
  assert.equal(decideSync(dirty, remote({ revision: 5 })).kind, "conflict");
});

test("a saved copy that went backwards is never overwritten", () => {
  // A restore, or a stale read. Either way the local revision cannot be trusted
  // as a base for a write.
  const decision = decideSync(local({ revision: 9 }), remote({ revision: 3 }));
  assert.equal(decision.kind, "conflict");
});

test("a never-synced device with real work does not clobber the saved copy", () => {
  const fresh = local({ revision: null, syncedHash: null, files: files({ "mine.ts": "local only" }) });
  assert.equal(decideSync(fresh, remote()).kind, "conflict");
});

test("a never-synced device holding an identical copy is simply in step", () => {
  const same = local({ revision: null, syncedHash: null });
  assert.equal(decideSync(same, remote()).kind, "idle");
});

test("a device with its own edits never loses them to a copy that moved on", () => {
  // The invariant worth asserting, over states that can actually occur: once
  // the saved copy has moved past what this device last synced, and this device
  // has edits of its own, neither side may be overwritten.
  //
  // Equal revisions are deliberately excluded — they mean the saved copy has
  // not moved since this device synced, so local edits on top are an ordinary
  // save, and the server's revision check is what catches a stale base.
  const mine = files({ "mine.ts": "local" });
  const theirs = files({ "theirs.ts": "server" });
  for (const revision of [null, 1, 2, 9]) {
    for (const remoteRevision of [1, 2, 9]) {
      if (revision === remoteRevision) continue;
      const decision = decideSync(
        local({ revision, syncedHash: revision === null ? null : "stale", files: mine }),
        remote({ files: theirs, revision: remoteRevision }),
      );
      assert.equal(
        decision.kind,
        "conflict",
        `rev=${revision} remote=${remoteRevision} gave ${decision.kind}`,
      );
    }
  }
});

test("equal revisions with local edits is an ordinary save", () => {
  const dirty = local({ files: files({ "mine.ts": "local" }), syncedHash: "stale" });
  assert.equal(decideSync(dirty, remote({ revision: 1 })).kind, "push");
});

test("limits reject a workspace too big to save", () => {
  assert.equal(checkSyncLimits(files()), null);
  const many: Record<string, string> = {};
  for (let i = 0; i < 200; i++) many[`f${i}.ts`] = "x";
  assert.match(checkSyncLimits(many)?.error ?? "", /Too many files/);
  assert.match(checkSyncLimits({ "big.ts": "x".repeat(3_000_000) })?.error ?? "", /too large/);
});

test("the disposable check must hash the workspace after seeding", () => {
  // Regression: the starter is seeded with stack memory on its way into state,
  // which rewrites the rules file. Hashing the raw demo therefore never matches
  // what a fresh editor actually holds, so a pristine workspace looked like
  // real work and took the conflict path instead of adopting the saved copy.
  const name = DEMO_WORKSPACE_NAME;
  const raw = { ...DEMO_FILES };
  const seeded = applyStackMemory({ ...raw }, name);
  assert.notEqual(
    workspaceHash(name, raw),
    workspaceHash(name, seeded),
    "seeding no longer changes the files — this guard can go",
  );
  const pristine = local({ name, files: seeded, revision: null, syncedHash: null });
  assert.equal(isDisposable(pristine, workspaceHash(name, seeded)), true);
  assert.equal(isDisposable(pristine, workspaceHash(name, raw)), false);
  assert.equal(decideSync(pristine, remote(), workspaceHash(name, seeded)).kind, "adopt");
});
