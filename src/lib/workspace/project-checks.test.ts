import assert from "node:assert/strict";
import { test } from "node:test";
import { changeChecks } from "./checks.ts";
import {
  CHECKS_PATH,
  CHECKS_TEMPLATE,
  checkFindings,
  checkFromMistakePrompt,
  mistakeRow,
  newCheckProblems,
  parseChecks,
  projectChecksRow,
} from "./project-checks.ts";
import { safetyFindings } from "./safety.ts";
import type { ProposedEdit } from "./types.ts";

// The mistake Agent Check caught in a real Copilot pull request: `await test(...)` in a describe callback that is not async.
const AWAIT_CHECK = {
  name: "no await test inside describe",
  files: ["**/*.test.ts"],
  forbid: "^\\s+await (?:test|it)\\(",
  example: '    await test("getIsCI can be disabled", async () => {',
  why: "describe callbacks are not async: declare the test without await.",
};
const config = (...checks: object[]) => JSON.stringify({ checks }, null, 2);

const TEST_FILE = [
  'import { describe, test } from "node:test";',
  'describe("ci", () => {',
  '  test("reads the env", () => {});',
  "});",
  "",
].join("\n");

function edit(path: string, newText: string, oldText = ""): ProposedEdit {
  return { id: `e:${path}`, path, oldText, newText, description: "change", status: "pending" };
}

test("parseChecks reads each check and names the first broken one", () => {
  const ok = parseChecks(config(AWAIT_CHECK, { ...AWAIT_CHECK, name: "soft", level: "look" }));
  assert.equal(ok.error, null);
  assert.deepEqual(
    ok.checks.map((c) => [c.name, c.level, c.files]),
    [
      ["no await test inside describe", "red", ["**/*.test.ts"]],
      ["soft", "look", ["**/*.test.ts"]],
    ],
  );
  assert.equal(parseChecks(CHECKS_TEMPLATE).error, null);
  assert.equal(parseChecks(undefined).checks.length, 0);
  assert.match(parseChecks("{").error!, /not valid JSON/);
  assert.match(parseChecks(config({ ...AWAIT_CHECK, forbid: "(" })).error!, /not a valid pattern/);
  assert.match(
    parseChecks(config({ ...AWAIT_CHECK, why: "" })).error!,
    /"why" must say what to do instead/,
  );
  assert.match(
    parseChecks(config({ ...AWAIT_CHECK, flags: "g" })).error!,
    /may only use i, m, s and u/,
  );
  // The broken one is left out; the rest still hold.
  assert.equal(parseChecks(config({ ...AWAIT_CHECK, forbid: "" }, AWAIT_CHECK)).checks.length, 1);
});

test("a check reads only the lines a change adds, in the files it names", () => {
  const { checks } = parseChecks(config(AWAIT_CHECK));
  const files = { "src/ci.test.ts": TEST_FILE, "src/ci.ts": "export const ci = 1;\n" };
  const bad = TEST_FILE.replace('  test("reads the env"', '  await test("reads the env"');
  assert.deepEqual(checkFindings(checks, files, [{ path: "src/ci.test.ts", newText: bad }]), [
    {
      level: "red",
      path: "src/ci.test.ts",
      line: 3,
      check: "no await test inside describe",
      why: "describe callbacks are not async: declare the test without await.",
    },
  ]);
  // A file the check does not name, a line the project already had, and a deletion are not judged.
  assert.deepEqual(
    checkFindings(checks, files, [{ path: "src/ci.ts", newText: "  await test(x);\n" }]),
    [],
  );
  const already = { "src/ci.test.ts": bad };
  assert.deepEqual(
    checkFindings(checks, already, [{ path: "src/ci.test.ts", newText: `${bad}// more\n` }]),
    [],
  );
  assert.deepEqual(
    checkFindings(checks, already, [{ path: "src/ci.test.ts", newText: "", deleted: true }]),
    [],
  );
});

test("the Project checks row holds Apply on a broken check, and is absent where there are none", () => {
  const bad = TEST_FILE.replace('  test("reads the env"', '  await test("reads the env"');
  const files = { [CHECKS_PATH]: config(AWAIT_CHECK), "src/ci.test.ts": TEST_FILE };
  const rows = changeChecks({
    files,
    edits: [edit("src/ci.test.ts", bad, TEST_FILE)],
    render: null,
  });
  const row = rows.find((r) => r.id === "project")!;
  assert.equal(row.status, "fail");
  assert.equal(row.label, "Project checks");
  assert.equal(
    row.detail,
    'src/ci.test.ts: breaks the project check "no await test inside describe" at line 3: describe callbacks are not async: declare the test without await.',
  );
  assert.equal(row.path, "src/ci.test.ts");
  assert.match(row.evidence!, /do not change or remove a check to get past it/);
  // Fixed, it passes; a project with no checks file has no row at all.
  const fine = changeChecks({
    files,
    edits: [edit("src/ci.test.ts", `${TEST_FILE}// ok\n`, TEST_FILE)],
    render: null,
  });
  assert.equal(
    fine.find((r) => r.id === "project")!.detail,
    "Nothing this change adds breaks the project's check.",
  );
  const none = changeChecks({
    files: { "src/ci.test.ts": TEST_FILE },
    edits: [edit("src/ci.test.ts", bad, TEST_FILE)],
    render: null,
  });
  assert.equal(
    none.some((r) => r.id === "project"),
    false,
  );
});

test("a level look check is amber and holds nothing", () => {
  const files = {
    [CHECKS_PATH]: config({ ...AWAIT_CHECK, level: "look" }),
    "src/ci.test.ts": TEST_FILE,
  };
  const bad = TEST_FILE.replace('  test("reads the env"', '  await test("reads the env"');
  const row = projectChecksRow(files, [edit("src/ci.test.ts", bad, TEST_FILE)])!;
  assert.equal(row.status, "warn");
  assert.match(row.detail, /^Worth a look: src\/ci\.test\.ts: breaks the project check/);
});

test("a new check proves itself: it must catch its example, and says what in the project it already matches", () => {
  const project = {
    "src/ci.test.ts": TEST_FILE,
    "src/old.test.ts": '  await it("legacy", () => {});\n',
  };
  // Catches its example; one old line already matches, said and kept.
  assert.deepEqual(newCheckProblems(undefined, config(AWAIT_CHECK), project), [
    {
      level: "look",
      text: 'The check "no await test inside describe" already matches 1 line in the project (first: src/old.test.ts at line 1). Those stay; only new ones are held. If that is more than the mistake, narrow the pattern.',
    },
  ]);
  // A pattern that misses its own example is red.
  const wrong = { ...AWAIT_CHECK, forbid: "^await test\\(" };
  assert.deepEqual(
    newCheckProblems(undefined, config(wrong), { "src/ci.test.ts": TEST_FILE }).map((p) => p.level),
    ["red"],
  );
  // No example: worth a look, since nothing proves it.
  const { example: _example, ...bare } = AWAIT_CHECK;
  assert.match(newCheckProblems(undefined, config(bare), {})[0]!.text, /has no "example"/);
  // A check that was already there is not tried again.
  assert.deepEqual(newCheckProblems(config(wrong), config(wrong), project), []);
  // A broken file is red.
  assert.match(newCheckProblems(undefined, "{", {})[0]!.text, /not valid JSON/);
});

test("staging a new check shows its proof on the row", () => {
  const files = { "src/ci.test.ts": TEST_FILE };
  const added = projectChecksRow(files, [edit(CHECKS_PATH, config(AWAIT_CHECK))])!;
  assert.equal(added.status, "pass");
  assert.equal(added.detail, "Nothing this change adds breaks the project's check.");
  const broken = projectChecksRow(files, [
    edit(CHECKS_PATH, config({ ...AWAIT_CHECK, forbid: "nope" })),
  ])!;
  assert.equal(broken.status, "fail");
  assert.equal(broken.path, CHECKS_PATH);
  assert.match(broken.detail, /does not catch its own example/);
});

test("Safety: removing or changing a project check is worth a look; adding one is not", () => {
  const was = config(AWAIT_CHECK);
  const safety = (after: string) =>
    safetyFindings({ [CHECKS_PATH]: was }, [{ path: CHECKS_PATH, newText: after }]).map((f) => [
      f.level,
      f.what,
    ]);
  assert.deepEqual(safety(config(AWAIT_CHECK, { ...AWAIT_CHECK, name: "another" })), []);
  assert.deepEqual(safety(config()), [
    ["look", 'removes the project check "no await test inside describe"'],
  ]);
  assert.deepEqual(safety(config({ ...AWAIT_CHECK, forbid: "nothing" })), [
    ["look", 'changes the project check "no await test inside describe"'],
  ]);
});

test("Make it a check asks for one proven entry, from a red row a line can show", () => {
  const rows = [
    { id: "parse", label: "Parses", status: "pass", detail: "1 file parses." },
    {
      id: "preview",
      label: "Preview renders",
      status: "fail",
      detail: "The staged page renders blank.",
    },
    {
      id: "types",
      label: "Types",
      status: "fail",
      detail:
        "src/ci.test.ts: TS1308 at line 22: 'await' expressions are only allowed within async functions.",
      evidence:
        "src/ci.test.ts: TS1308 at line 22: 'await' expressions are only allowed within async functions.\n> 22 |     await test(\"x\", async () => {",
    },
  ];
  // A blank page is not a line; the type error is.
  assert.equal(mistakeRow(rows)?.id, "types");
  assert.equal(mistakeRow(rows.slice(0, 2)), null);
  const prompt = checkFromMistakePrompt(rows[2]!, undefined);
  assert.match(prompt, /^Turn this mistake into a project check/);
  assert.match(prompt, /> 22 \| {5}await test\("x", async \(\) => \{/);
  assert.match(
    prompt,
    /\.aperture\/checks\.json with propose_edit \(the file does not exist yet: create it\)/,
  );
  assert.match(prompt, /Do not fix the mistake in this turn/);
  assert.match(
    checkFromMistakePrompt(rows[2]!, "{}"),
    /keeping every check already there exactly as it is/,
  );
});

test("Aperture's own checks parse, and each one catches its own example", async () => {
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(new URL("../../../.aperture/checks.json", import.meta.url), "utf8");
  const parsed = parseChecks(raw);
  assert.equal(parsed.error, null);
  assert.ok(parsed.checks.length >= 6);
  for (const check of parsed.checks) {
    assert.ok(check.example, `${check.name} has an example`);
    assert.ok(check.forbid.test(check.example!), `${check.name} catches its example`);
  }
});
