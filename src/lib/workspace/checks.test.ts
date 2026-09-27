import { test } from "node:test";
import assert from "node:assert/strict";
import { changeChecks, renderEntry, verifyForPending, type CheckRow } from "./checks.ts";
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

test("four rows, always in the same order", () => {
  const rows = changeChecks({ files: FILES, edits: [edit("src/a.ts", FILES["src/a.ts"])], render: null });
  assert.deepEqual(
    rows.map((r) => r.id),
    ["parse", "imports", "preview", "tests"],
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
