import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EDITOR_LIMITS,
  editorRules,
  fileWindow,
  findPath,
  peekLine,
  replyComposer,
  replyReads,
  validEditorContext,
  withEditor,
  type EditorContext,
} from "./editor-context.ts";
import { privateMessages } from "./private-chat.ts";

const CONTEXT: EditorContext = {
  project: "shop",
  files: 12,
  path: "src/cart.ts",
  text: "export const total = (items: number[]) =>\n  items.reduce((a, b) => a + b, 0);",
  fromLine: 1,
  lines: 2,
  selection: { fromLine: 2, toLine: 2, text: "  items.reduce((a, b) => a + b, 0);" },
  problems: [{ line: 1, message: "Unused export", severity: "warning" }],
  tree: [],
  extra: [],
  missing: [],
};

test("what the editor shows goes under the person's words, fenced, with its place", () => {
  const said = withEditor("Why the warning?", CONTEXT);
  assert.ok(said.startsWith("Why the warning?\n\n"));
  assert.match(
    said,
    /\[In the editor: project "shop", 12 files\. Open file: src\/cart\.ts, 2 lines\.\]/,
  );
  assert.match(said, /Selected, line 2:\n```ts\n {2}items\.reduce/);
  assert.match(said, /Problems in the file:\n- line 1 \(warning\): Unused export/);
  // Whole: no "lines x–y of z".
  assert.match(said, /The file:\n```ts\nexport const total/);

  // A file that holds a fence of its own gets a longer one.
  const fenced = withEditor("", { ...CONTEXT, selection: null, text: "a\n```\nb", problems: [] });
  assert.ok(fenced.startsWith("Look at what I have open."));
  assert.match(fenced, /````ts\na\n```\nb\n````/);

  // Cut, it says which lines; a secret file sends none.
  assert.match(
    withEditor("x", { ...CONTEXT, text: "b\nc", fromLine: 40, lines: 90 }),
    /The file, lines 40–41 of 90:/,
  );
  assert.match(withEditor("x", { ...CONTEXT, text: "", selection: null }), /holds secrets/);
  assert.match(
    withEditor("x", { ...CONTEXT, path: null, text: "", lines: 0, selection: null }),
    /No file is open\.\]$/,
  );
});

test("a long file is cut around the selection, never past the limit", () => {
  const text = Array.from({ length: 2000 }, (_, i) => `line ${i + 1} ${"x".repeat(30)}`).join("\n");
  const around = fileWindow(text, { fromLine: 1000, toLine: 1004 });
  assert.ok(around.text.length <= EDITOR_LIMITS.text);
  assert.equal(around.lines, 2000);
  assert.ok(around.fromLine > 1 && around.fromLine < 1000);
  assert.ok(around.text.includes("line 1002 "));
  // Lines whole, from the start of one.
  assert.ok(around.text.startsWith(`line ${around.fromLine} `));

  const top = fileWindow(text, null);
  assert.equal(top.fromLine, 1);
  assert.ok(top.text.startsWith("line 1 "));

  const small = fileWindow("a\nb", { fromLine: 2, toLine: 2 });
  assert.deepEqual(small, { text: "a\nb", fromLine: 1, lines: 2 });

  // One line longer than the limit: its start.
  const one = fileWindow("y".repeat(EDITOR_LIMITS.text + 50), null);
  assert.equal(one.text.length, EDITOR_LIMITS.text);
});

test("what a page sends is checked and held to the limits", () => {
  assert.deepEqual(validEditorContext(CONTEXT), CONTEXT);
  assert.equal(validEditorContext(null), null);
  assert.equal(validEditorContext({ ...CONTEXT, files: -1 }), null);
  assert.equal(validEditorContext({ ...CONTEXT, path: 4 }), null);
  assert.equal(validEditorContext({ ...CONTEXT, fromLine: 0 }), null);
  assert.equal(validEditorContext({ ...CONTEXT, problems: "none" }), null);
  assert.equal(validEditorContext({ ...CONTEXT, problems: [{ line: 0, message: "x" }] }), null);

  const big = validEditorContext({
    ...CONTEXT,
    text: "z".repeat(EDITOR_LIMITS.text + 10),
    selection: { fromLine: 9, toLine: 3, text: "s".repeat(EDITOR_LIMITS.selection + 10) },
    problems: Array.from({ length: 50 }, (_, i) => ({
      line: i + 1,
      message: `${"m".repeat(400)}\nwhy`,
      severity: "nonsense",
    })),
  });
  assert.ok(big);
  assert.equal(big.text.length, EDITOR_LIMITS.text);
  assert.equal(big.selection?.text.length, EDITOR_LIMITS.selection);
  // A selection never ends before it starts.
  assert.equal(big.selection?.toLine, 9);
  assert.equal(big.problems.length, EDITOR_LIMITS.problems);
  assert.equal(big.problems[0]!.message.length, EDITOR_LIMITS.problem);
  assert.equal(big.problems[0]!.severity, "error");
});

test("a reply's Composer line becomes its button, and goes from the text", () => {
  const reply =
    "Rename it and update the callers.\n\n[[composer: Rename total to cartTotal in src/cart.ts and its callers.]]\n[[ask: Why rename it?]]";
  const out = replyComposer(reply);
  assert.equal(out.instruction, "Rename total to cartTotal in src/cart.ts and its callers.");
  assert.equal(out.text, "Rename it and update the callers.\n\n[[ask: Why rename it?]]");
  // Only the first; none: nothing changes.
  assert.equal(replyComposer("a [[composer: one]] b\n[[composer: two]]").instruction, "one");
  assert.equal(replyComposer("a [[composer: one]] b").text, "a  b");
  assert.deepEqual(replyComposer("Plain answer."), { text: "Plain answer.", instruction: null });
  assert.equal(replyComposer("[[composer:   ]]").instruction, null);
});

test("the bot is told about the editor only when it is in it", () => {
  const turns = [{ role: "user" as const, text: "Why the warning?" }];
  const plain = privateMessages(turns, "2026-11-20");
  assert.equal(plain.filter((m) => m.role === "system").length, 1);
  assert.equal(plain.at(-1)!.content, "Why the warning?");

  const inEditor = privateMessages(turns, "2026-11-20", null, null, undefined, CONTEXT);
  const systems = inEditor.filter((m) => m.role === "system");
  assert.equal(systems.length, 2);
  assert.equal(systems[1]!.content, editorRules());
  assert.match(editorRules(), /\[\[composer:/);
  assert.equal(inEditor.at(-1)!.content, withEditor("Why the warning?", CONTEXT));

  // Only the newest message carries it.
  const later = privateMessages(
    [...turns, { role: "assistant", text: "Because." }, { role: "user", text: "Fix it" }],
    "2026-11-20",
    null,
    null,
    undefined,
    CONTEXT,
  );
  assert.equal(later.at(-3)!.content, "Why the warning?");
  assert.match(String(later.at(-1)!.content), /^Fix it\n\n\[In the editor/);
});

test("the line under the box says what it sees", () => {
  const peek = { project: "shop", path: "src/lib/cart.ts", selection: null };
  assert.equal(peekLine(peek), "Sees cart.ts");
  assert.equal(
    peekLine({ ...peek, selection: { fromLine: 3, toLine: 3 } }),
    "Sees cart.ts, line 3",
  );
  assert.equal(
    peekLine({ ...peek, selection: { fromLine: 3, toLine: 9 } }),
    "Sees cart.ts, lines 3–9",
  );
  assert.equal(peekLine({ ...peek, path: null }), "Sees shop: no file open");
});

test("the rest of the project goes too: other files, what is missing, every path", () => {
  const said = withEditor("Where is Item defined?", {
    ...CONTEXT,
    files: 3,
    tree: ["src/cart.ts", "src/types.ts", "tests/cart.test.ts"],
    extra: [
      { path: "src/types.ts", text: "export type Item = { price: number };", why: "import" },
      { path: "tests/cart.test.ts", text: "test()", why: "asked" },
    ],
    missing: ["src/nope.ts"],
  });
  assert.match(
    said,
    /Also open, imported by src\/cart\.ts: src\/types\.ts\n```ts\nexport type Item/,
  );
  assert.match(said, /Also open, as you asked: tests\/cart\.test\.ts\n```ts\ntest\(\)/);
  assert.match(said, /Not in the project, so not sent: src\/nope\.ts/);
  assert.match(said, /Project files \(3\):\nsrc\/cart\.ts\nsrc\/types\.ts\ntests\/cart\.test\.ts$/);
  // A big project lists its first paths, and how many more.
  assert.match(
    withEditor("x", { ...CONTEXT, files: 900, tree: ["a.ts", "b.ts"] }),
    /Project files \(900\):\na\.ts\nb\.ts\n… and 898 more$/,
  );
  assert.match(editorRules(), /\[\[read: path\]\]/);
});

test("other files are held to the limits as well", () => {
  const out = validEditorContext({
    ...CONTEXT,
    tree: Array.from({ length: 900 }, (_, i) => `f${i}.ts`),
    extra: Array.from({ length: 9 }, (_, i) => ({
      path: `x${i}.ts`,
      text: "y".repeat(EDITOR_LIMITS.extraFile + 5),
      why: i === 0 ? "asked" : "whatever",
    })),
    missing: ["a", "b"],
  });
  assert.ok(out);
  assert.equal(out.tree.length, EDITOR_LIMITS.tree);
  assert.equal(out.extra.length, EDITOR_LIMITS.extra);
  assert.equal(out.extra[0]!.text.length, EDITOR_LIMITS.extraFile);
  assert.equal(out.extra[0]!.why, "asked");
  assert.equal(out.extra[1]!.why, "import");
  assert.ok(out.extra.reduce((n, f) => n + f.text.length, 0) <= EDITOR_LIMITS.extraTotal);
  assert.deepEqual(out.missing, ["a", "b"]);
  // Left out by an older page: none.
  const { tree: _t, extra: _e, missing: _m, ...older } = CONTEXT;
  assert.deepEqual(validEditorContext(older), CONTEXT);
  assert.equal(validEditorContext({ ...CONTEXT, tree: [1] }), null);
  assert.equal(validEditorContext({ ...CONTEXT, extra: [{ path: "a" }] }), null);
});

test("a reply that asks to read files says which, each once, at most three", () => {
  const out = replyReads(
    "Let me check the type first.\n[[read: src/types.ts]]\n[[read: ./src/util.ts, `lib/a.ts`]]\n[[read: src/types.ts]]\n[[read: d.ts]]",
  );
  assert.deepEqual(out.paths, ["src/types.ts", "src/util.ts", "lib/a.ts"]);
  assert.equal(out.text, "Let me check the type first.");
  assert.deepEqual(replyReads("No files here."), { text: "No files here.", paths: [] });
});

test("a path it asks for is found as written, or by its end when only one file has it", () => {
  const paths = ["src/types.ts", "src/cart.ts", "lib/types.ts", "README.md"];
  assert.equal(findPath("src/cart.ts", paths), "src/cart.ts");
  assert.equal(findPath("cart.ts", paths), "src/cart.ts");
  assert.equal(findPath("/README.md", paths), "README.md");
  // Two files end so: neither is guessed.
  assert.equal(findPath("types.ts", paths), null);
  assert.equal(findPath("art.ts", paths), null);
  assert.equal(findPath("nope.ts", paths), null);
});

test("the line under the box counts the imports that go along", () => {
  const peek = { project: "shop", path: "src/cart.ts", selection: null, imports: 2 };
  assert.equal(peekLine(peek), "Sees cart.ts and 2 imports");
  assert.equal(
    peekLine({ ...peek, imports: 1, selection: { fromLine: 4, toLine: 6 } }),
    "Sees cart.ts, lines 4–6, and 1 import",
  );
});
