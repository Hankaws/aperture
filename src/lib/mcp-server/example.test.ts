import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { staticChangeChecks } from "../workspace/static-checks.ts";
import { EXAMPLE } from "./example.ts";
import { checkResult } from "./protocol.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));

test("the example on /agents is what check_change answers today", () => {
  const rows = staticChangeChecks({
    tsc: ts,
    readLib: (name) => {
      try {
        return readFileSync(join(libDir, name), "utf8");
      } catch {
        return undefined;
      }
    },
    cache: new Map(),
    before: EXAMPLE.files,
    changes: EXAMPLE.changes,
    tests: {
      state: "unsupported",
      reason: "this server does not run code. Run the project's tests before you apply the change.",
    },
  });
  const answer = checkResult(rows, Object.keys(EXAMPLE.changes).length).content[0]!.text;
  assert.equal(
    answer,
    EXAMPLE.answer,
    "check_change answers differently now: update EXAMPLE.answer in example.ts",
  );
});
