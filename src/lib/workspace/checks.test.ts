import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_FIX_WINDOW_MS, canApply, changeChecks, checksReady, checkStripState, inTurnCheckPrompt, lookPrompt, newIssues, renderEntry, shouldAutoFix, shouldLookAgain, verifyForPending, type BrowserTests, type CheckRow } from "./checks.ts";
import { RENDER_PROBE_SCRIPT, renderProbeDocument } from "./design-mode.ts";
import type { ProposedEdit, VerifyReport } from "./types.ts";

function edit(path: string, newText: string, oldText = ""): ProposedEdit {
  return { id: `e_${path}`, path, oldText, newText, description: "", status: "pending" };
}

const FILES = {
  "src/a.ts": 'import { b } from "./b";\nexport const a = b + 1;\n',
  "src/b.ts": "export const b = 1;\n",
  "index.html": "<!doctype html><html><head></head><body><h1>Hi</h1></body></html>",
  "style.css": "h1 { color: red; }",
};

function row(rows: CheckRow[], id: CheckRow["id"]): CheckRow {
  return rows.find((r) => r.id === id)!;
}

test("inTurnCheckPrompt is empty when the staged file parses, and names a red check when it does not", () => {
  assert.equal(inTurnCheckPrompt(FILES, [edit("src/a.ts", FILES["src/a.ts"])]), null);
  const prompt = inTurnCheckPrompt(FILES, [edit("src/a.ts", "export const a = ;\n")]);
  assert.ok(prompt);
  assert.match(prompt ?? "", /Parses/);
  assert.match(prompt ?? "", /propose_edit/);
});

test("a failed parse counts while tests are still running", () => {
  assert.equal(
    checkStripState([
      { status: "fail" },
      { status: "running" },
    ]),
    "failed",
  );
  assert.equal(checkStripState([{ status: "running" }]), "running");
  assert.equal(checkStripState([{ status: "pass" }]), "clear");
  assert.equal(canApply("clear"), true);
  assert.equal(canApply("failed"), false);
  assert.equal(canApply("running"), false);
  assert.equal(canApply(null), false);
});

test("five rows, always in the same order", () => {
  const rows = changeChecks({ files: FILES, edits: [edit("src/a.ts", FILES["src/a.ts"])], render: null });
  assert.deepEqual(
    rows.map((r) => r.id),
    ["parse", "imports", "types", "preview", "tests"],
  );
});

test("a clean script change parses and resolves its imports", () => {
  const rows = changeChecks({
    files: FILES,
    edits: [edit("src/a.ts", 'import { b } from "./b";\nexport const a = b + 2;\n')],
    render: null,
  });
  assert.equal(row(rows, "parse").status, "pass");
  assert.equal(row(rows, "imports").status, "pass");
  assert.equal(row(rows, "preview").status, "skip");
});

test("a syntax error fails Parses, names the file, and holds the import check", () => {
  const rows = changeChecks({ files: FILES, edits: [edit("src/a.ts", "export const a = (1;\n")], render: null });
  const parse = row(rows, "parse");
  assert.equal(parse.status, "fail");
  assert.equal(parse.path, "src/a.ts");
  assert.match(parse.detail, /^src\/a\.ts: /);
  assert.equal(row(rows, "imports").status, "skip");
});

test("a type error fails Types", () => {
  const rows = changeChecks({
    files: FILES,
    edits: [edit("src/a.ts", "const title: string = 1;\n")],
    render: null,
  });
  assert.equal(row(rows, "parse").status, "pass");
  const types = row(rows, "types");
  assert.equal(types.status, "fail");
  assert.equal(types.path, "src/a.ts");
  assert.match(types.detail, /line 1/);
});

test("an issue the file already had is amber, does not block Apply, and is not sent back", () => {
  // The checker cannot see this name's declaration, which is the case for real
  // projects too: an edit elsewhere in the file must not be blocked by it.
  const before = "export const a = ghost + 1;\n";
  const files = { ...FILES, "src/a.ts": before };
  const rows = changeChecks({
    files,
    edits: [edit("src/a.ts", "// A comment above.\nexport const a = ghost + 2;\n", before)],
    render: null,
  });
  const types = row(rows, "types");
  assert.equal(types.status, "warn");
  assert.match(types.detail, /^Already there before this change: src\/a\.ts: .*cannot find name ghost/);
  assert.equal(checkStripState(rows.filter((r) => r.id !== "tests" && r.id !== "preview")), "clear");
  assert.equal(inTurnCheckPrompt(files, [edit("src/a.ts", "// A comment above.\nexport const a = ghost + 2;\n", before)]), null);
});

test("a second use of a name the file already lacked is still new", () => {
  const before = "export const a = ghost + 1;\n";
  const rows = changeChecks({
    files: { ...FILES, "src/a.ts": before },
    edits: [edit("src/a.ts", "export const a = ghost + 1;\nexport const c = ghost;\n", before)],
    render: null,
  });
  assert.equal(row(rows, "types").status, "fail");
});

test("an unresolved import the file already had is amber; a new one is red", () => {
  const before = 'import { x } from "./gone";\nexport const a = x;\n';
  const files = { ...FILES, "src/a.ts": before };
  const kept = changeChecks({
    files,
    edits: [edit("src/a.ts", 'import { x } from "./gone";\nexport const a = x + 1;\n', before)],
    render: null,
  });
  assert.equal(row(kept, "imports").status, "warn");
  const added = changeChecks({
    files,
    edits: [edit("src/a.ts", 'import { x } from "./gone";\nimport { y } from "./also-gone";\nexport const a = x + y;\n', before)],
    render: null,
  });
  assert.equal(row(added, "imports").status, "fail");
  assert.match(row(added, "imports").detail, /also-gone/);
});

test("newIssues compares without line numbers, and counts repeats", () => {
  const before = ["type error at line 3: cannot find name ghost"];
  assert.deepEqual(newIssues(["type error at line 9: cannot find name ghost"], before), []);
  assert.deepEqual(
    newIssues(["type error at line 9: cannot find name ghost", "type error at line 12: cannot find name ghost"], before),
    ["type error at line 12: cannot find name ghost"],
  );
  assert.deepEqual(newIssues(['imports "./x" at line 4, which does not exist in the project'], ['imports "./x" at line 1, which does not exist in the project']), []);
});

test("an import of a file that does not exist fails Imports resolve", () => {
  const rows = changeChecks({
    files: FILES,
    edits: [edit("src/a.ts", 'import { c } from "./c";\nexport const a = c;\n')],
    render: null,
  });
  assert.equal(row(rows, "parse").status, "pass");
  const imports = row(rows, "imports");
  assert.equal(imports.status, "fail");
  assert.equal(imports.path, "src/a.ts");
  assert.match(imports.detail, /\.\/c/);
});

test("an import of a file staged in the same change resolves", () => {
  const rows = changeChecks({
    files: FILES,
    edits: [
      edit("src/a.ts", 'import { c } from "./c";\nexport const a = c;\n'),
      edit("src/c.ts", "export const c = 3;\n"),
    ],
    render: null,
  });
  assert.equal(row(rows, "imports").status, "pass");
});

test("a change with nothing checkable skips rather than passes", () => {
  const rows = changeChecks({ files: FILES, edits: [edit("README.md", "# hi")], render: null });
  for (const r of rows) assert.equal(r.status, "skip", r.id);
});

test("the preview row reads the staged render, never assumes it", () => {
  const edits = [edit("style.css", "h1 { color: blue; }")];
  const at = (render: Parameters<typeof changeChecks>[0]["render"]) =>
    row(changeChecks({ files: FILES, edits, render }), "preview");
  assert.equal(at({ state: "pending" }).status, "running");
  assert.equal(at({ state: "done", errors: [], blank: false }).status, "pass");
  assert.equal(at({ state: "done", errors: [], blank: true }).status, "fail");
  assert.equal(at({ state: "timeout" }).status, "fail");
  const failed = at({ state: "done", errors: ["ReferenceError: x is not defined", "second"], blank: false });
  assert.equal(failed.status, "fail");
  assert.equal(failed.detail, "ReferenceError: x is not defined (+1 more)");
});

test("the tests row reports the agent's run as it happened", () => {
  const at = (verify: VerifyReport | null) =>
    row(changeChecks({ files: FILES, edits: [edit("src/b.ts", "export const b = 2;\n")], render: null, verify }), "tests");
  assert.equal(at(null).status, "skip");
  assert.match(at(null).detail, /Not run/);
  const passed = at({ script: "test", status: "passed", detail: "npm run test passed." });
  assert.deepEqual([passed.status, passed.label], ["pass", "Tests pass"]);
  const lint = at({ script: "lint", status: "passed", detail: "" });
  assert.equal(lint.label, "lint passes");
  const failed = at({ script: "test", status: "failed", detail: "AssertionError: nope", rechecked: true });
  assert.equal(failed.status, "fail");
  assert.equal(failed.detail, "npm run test failed after the agent's fix: AssertionError: nope");
  const notRun = at({ script: "test", status: "not_run", detail: "No sandbox is configured, so this project cannot be run here." });
  assert.equal(notRun.status, "skip");
  assert.equal(notRun.label, "Tests");
  assert.match(notRun.detail, /^Not run: No sandbox/);
});

test("renderEntry: only a change that can alter the page is rendered", () => {
  assert.equal(renderEntry(FILES, [edit("src/a.ts", "")]), null);
  assert.equal(renderEntry(FILES, [edit("style.css", "")]), "index.html");
  assert.equal(renderEntry(FILES, [edit("app.js", "")]), null, "scripts off: a script cannot change the page");
  assert.equal(renderEntry(FILES, [edit("app.js", "")], { runScripts: true }), "index.html");
  assert.equal(renderEntry({ "style.css": "" }, [edit("style.css", "")]), null, "no page to render");
  const pages = { ...FILES, "about.html": "<p>about</p>" };
  assert.equal(renderEntry(pages, [edit("about.html", "<p>new</p>")]), "about.html", "the edited page wins");
});

test("verifyForPending takes the latest message that still has pending edits", () => {
  const passed: VerifyReport = { script: "test", status: "passed", detail: "" };
  const failed: VerifyReport = { script: "test", status: "failed", detail: "x" };
  const applied = { ...edit("a.ts", ""), status: "applied" as const };
  assert.equal(
    verifyForPending([{ edits: [edit("a.ts", "")], verify: failed }, { edits: [applied], verify: passed }]),
    failed,
  );
  assert.equal(verifyForPending([{ edits: [edit("a.ts", "")] }]), null);
  assert.equal(verifyForPending([]), null);
});

test("the probe goes first in the page, so it sees the page's own errors", () => {
  const doc = renderProbeDocument(FILES, "index.html");
  const probeAt = doc.indexOf("aperture-render-probe");
  assert.ok(probeAt > doc.indexOf("<head>") && probeAt < doc.indexOf("<h1>"));
  const header = renderProbeDocument({ "p.html": "<header>x</header>" }, "p.html");
  assert.ok(header.indexOf("aperture-render-probe") < header.indexOf("<header>"), "<header> is not <head>");
  assert.doesNotMatch(RENDER_PROBE_SCRIPT, /<\/script>/i);
});

test("the browser run fills the tests row when the sandbox did not run", () => {
  const at = (browser: BrowserTests, verify: VerifyReport | null = null) =>
    row(changeChecks({ files: FILES, edits: [edit("src/b.ts", "export const b = 2;\n")], render: null, verify, browser }), "tests");
  assert.equal(at({ state: "running", script: "test" }).status, "running");
  const passed = at({ state: "done", script: "test", passed: true, detail: "", pass: 3 });
  assert.deepEqual([passed.status, passed.detail], ["pass", "npm run test passed in the browser (3 tests)."]);
  const failed = at({ state: "done", script: "test", passed: false, detail: "Error: first item should be tsk_100" });
  assert.deepEqual([failed.status, failed.detail], ["fail", "npm run test fails in the browser: Error: first item should be tsk_100"]);
  const before = at({ state: "done", script: "test", passed: false, detail: "Error: x", preexisting: true });
  assert.deepEqual([before.status, before.label, before.detail], ["warn", "Tests", "Already failing before this change: Error: x"]);
  const unsupported = at({ state: "unsupported", reason: "`npm run test` runs vitest, which needs a real Node." });
  assert.equal(unsupported.status, "skip");
  assert.match(unsupported.detail, /^Not run: .*vitest/);
  // A real sandbox run is the stronger evidence and wins.
  const sandbox = at({ state: "done", script: "test", passed: false, detail: "x" }, { script: "test", status: "passed", detail: "" });
  assert.equal(sandbox.status, "pass");
  assert.match(sandbox.detail, /^npm run test passed\.$/);
  // A sandbox that never ran defers to the browser.
  const deferred = at({ state: "done", script: "test", passed: true, detail: "" }, { script: "test", status: "not_run", detail: "No sandbox." });
  assert.equal(deferred.status, "pass");
});

test("shouldAutoFix: one fix, for a fresh Composer change that broke the tests", () => {
  const now = 1_000_000;
  const message = { role: "assistant", createdAt: now - 1000, modelSource: "hosted", plan: [] };
  const failing: BrowserTests = { state: "done", script: "test", passed: false, detail: "x" };
  assert.equal(shouldAutoFix(message, failing, now), true);
  assert.equal(shouldAutoFix({ ...message, autoFixed: true }, failing, now), false, "only once");
  assert.equal(shouldAutoFix({ ...message, modelSource: undefined }, failing, now), false, "not an external agent's change");
  assert.equal(shouldAutoFix({ ...message, createdAt: now - AUTO_FIX_WINDOW_MS - 1 }, failing, now), false, "not an old change");
  assert.equal(shouldAutoFix(message, { ...failing, preexisting: true }, now), false, "not a failure it did not cause");
  assert.equal(shouldAutoFix(message, { ...failing, passed: true }, now), false);
  assert.equal(shouldAutoFix(message, { state: "running", script: "test" }, now), false);
  assert.equal(shouldAutoFix({ ...message, role: "user" }, failing, now), false);
  assert.equal(shouldAutoFix(null, failing, now), false);
});

test("shouldLookAgain: one look, after the preview has finished, and not on a replay", () => {
  const now = 1_000_000;
  const message = { role: "assistant", createdAt: now - 1000, modelSource: "hosted" };
  const red: CheckRow[] = [
    { id: "preview", label: "Preview renders", status: "fail", detail: "The staged page renders blank." },
  ];
  const clear: CheckRow[] = [
    { id: "preview", label: "Preview renders", status: "pass", detail: "The staged page renders with no errors." },
  ];
  assert.equal(checksReady({ state: "pending" }, null), false);
  assert.equal(checksReady({ state: "done", errors: [], blank: true }, { state: "running", script: "test" }), false);
  assert.equal(checksReady({ state: "done", errors: [], blank: true }, null), true);
  assert.equal(shouldLookAgain(message, red, now, { ready: true, replay: false }), true);
  assert.equal(shouldLookAgain(message, red, now, { ready: false, replay: false }), false, "still rendering");
  assert.equal(shouldLookAgain(message, red, now, { ready: true, replay: true }), false, "a replay cannot fix it");
  assert.equal(shouldLookAgain({ ...message, autoFixed: true }, red, now, { ready: true, replay: false }), false, "only once");
  assert.equal(shouldLookAgain(message, clear, now, { ready: true, replay: false }), false);
  assert.match(lookPrompt(red), /The staged page renders blank/);
});
