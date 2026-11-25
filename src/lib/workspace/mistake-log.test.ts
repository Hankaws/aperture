import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_LOG,
  mistakeKinds,
  parseMistakeLog,
  quietMistake,
  recordMistakes,
  repeatedMistake,
} from "./mistake-log.ts";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 25);

const typesRow = (path: string, prop: string) => ({
  id: "types",
  status: "fail",
  detail: `${path}: TS2339 at line 4: Property '${prop}' does not exist on type 'Cart'. (+1 more)`,
  evidence: `${path}: TS2339 at line 4: Property '${prop}' does not exist on type 'Cart'.\n${path}: TS2554 at line 9: Expected 1 arguments, but got 2.`,
});

test("a red row becomes the kinds of mistake in it, specifics taken out", () => {
  assert.deepEqual(mistakeKinds(typesRow("src/a.ts", "total")), [
    { key: "types:TS2339", label: "TS2339: Property 'total' does not exist on type 'Cart'." },
    { key: "types:TS2554", label: "TS2554: Expected 1 arguments, but got 2." },
  ]);
  assert.deepEqual(
    mistakeKinds({
      id: "imports",
      status: "fail",
      detail: 'src/a.ts: imports "./gone" at line 1, which does not exist in the project',
    }),
    [{ key: "imports:missing-file", label: "imports a file that does not exist" }],
  );
  assert.deepEqual(
    mistakeKinds({
      id: "tests",
      status: "fail",
      detail:
        "Not counted as a pass: this change skips 1 test in tests/a.test.ts; calls process.exit in tests/b.test.ts.",
    }).map((k) => k.key),
    ["tests:skips", "tests:exit"],
  );
  assert.deepEqual(
    mistakeKinds({
      id: "safety",
      status: "fail",
      detail: "src/keys.ts: adds a GitHub token at line 3",
      evidence:
        "src/keys.ts: adds a GitHub token at line 3\nDo not write keys, tokens or passwords into the code or a .env file: read them from the environment.",
    }),
    [{ key: "safety:adds a GitHub token", label: "adds a GitHub token" }],
  );
  // Failing tests are not a mistake one line shows, and a row that passed is nothing.
  assert.deepEqual(
    mistakeKinds({ id: "tests", status: "fail", detail: "npm test fails: expected 2, got 3" }),
    [],
  );
  assert.deepEqual(mistakeKinds({ ...typesRow("a.ts", "x"), status: "pass" }), []);
});

test("the third change with the same kind of mistake within a week offers a check", () => {
  let log = EMPTY_LOG;
  log = recordMistakes(log, [typesRow("src/a.ts", "total")], "change-1", T0);
  // The same change seen again (an auto-fix check, a re-render) counts once.
  log = recordMistakes(log, [typesRow("src/a.ts", "total")], "change-1", T0 + 1000);
  log = recordMistakes(log, [typesRow("src/b.ts", "sum")], "change-2", T0 + DAY);
  assert.equal(repeatedMistake(log, ["types:TS2339"], T0 + DAY), null);
  log = recordMistakes(log, [typesRow("src/c.ts", "count")], "change-3", T0 + 2 * DAY);
  assert.deepEqual(repeatedMistake(log, ["types:TS2339"], T0 + 2 * DAY), {
    key: "types:TS2339",
    label: "TS2339: Property 'count' does not exist on type 'Cart'.",
    times: 3,
    days: 7,
  });
  // Older than a week does not count.
  assert.equal(repeatedMistake(log, ["types:TS2339"], T0 + 8 * DAY), null);
});

test("Not now or Make it a check keeps the offer away for a month", () => {
  let log = EMPTY_LOG;
  for (const [i, change] of ["a", "b", "c"].entries())
    log = recordMistakes(log, [typesRow(`src/${change}.ts`, "x")], change, T0 + i * 1000);
  assert.ok(repeatedMistake(log, ["types:TS2339"], T0 + 5000));
  log = quietMistake(log, "types:TS2339", T0 + 5000);
  assert.equal(repeatedMistake(log, ["types:TS2339"], T0 + 6000), null);
  // Another kind is still offered.
  assert.ok(repeatedMistake(log, ["types:TS2554"], T0 + 6000));
});

test("the stored log survives a reload, and a broken one reads as empty", () => {
  const log = recordMistakes(EMPTY_LOG, [typesRow("src/a.ts", "x")], "c1", T0);
  assert.deepEqual(parseMistakeLog(JSON.stringify(log)), log);
  assert.deepEqual(parseMistakeLog("{"), EMPTY_LOG);
  assert.deepEqual(parseMistakeLog(null), EMPTY_LOG);
  assert.deepEqual(
    parseMistakeLog(JSON.stringify({ entries: [{ key: 1 }], dismissed: { a: "x" } })),
    EMPTY_LOG,
  );
  // Entries older than a month are let go on the next note.
  const later = recordMistakes(log, [], "c2", T0 + 31 * DAY);
  assert.equal(later.entries.length, 0);
});
