import { test } from "node:test";
import assert from "node:assert/strict";
import {
  builtFrom,
  compareVersions,
  judgeAction,
  judgeApp,
  report,
  type ActionFacts,
} from "./release-verify.ts";

const BUILD = "Build dist from Hankaws/aperture@705962ccfe260fa9d9e416f49badd002a883ab46";

function action(over: Partial<ActionFacts> = {}): ActionFacts {
  return {
    name: "Aperture Agent Check",
    repo: "Hankaws/aperture-agent-check",
    latest: { tag: "v1.3", commit: "8314ee5aaaaaaaa" },
    major: { tag: "v1", commit: "8314ee5aaaaaaaa" },
    message: BUILD,
    staleFiles: [],
    against: "v0.28.0",
    ...over,
  };
}

test("a build commit names the Aperture commit it was built from", () => {
  assert.equal(builtFrom(BUILD), "705962ccfe260fa9d9e416f49badd002a883ab46");
  assert.equal(builtFrom("Merge pull request #4 from Hankaws/claude/x"), null);
  assert.equal(builtFrom(null), null);
});

test("versions sort newest first, numerically", () => {
  assert.deepEqual(["0.9.0", "0.28.0", "v0.27.1", "0.27.0"].sort(compareVersions), [
    "0.28.0",
    "v0.27.1",
    "0.27.0",
    "0.9.0",
  ]);
});

test("a release on its build, with v1 on it and nothing stale, is fine", () => {
  const r = report(judgeAction(action()));
  assert.equal(r.failed, false);
  assert.equal(
    r.text,
    "✓ Aperture Agent Check: v1.3 is a build of aperture@705962c, current with v0.28.0, and v1 is on it.",
  );
});

test("this week, Agent Check v1.3 was tagged before its build finished: on the merge commit", () => {
  const findings = judgeAction(
    action({
      latest: { tag: "v1.3", commit: "7cb35e7aaaaaaaa" },
      major: { tag: "v1", commit: "7cb35e7aaaaaaaa" },
      message: "Merge pull request #4 from Hankaws/claude/modest-albattani-qtkvuu",
      staleFiles: null,
    }),
  );
  assert.deepEqual(
    findings.map((f) => f.level),
    ["fail"],
  );
  assert.match(findings[0]!.text, /v1\.3 is on 7cb35e7, which is not a build commit/);
  assert.match(findings[0]!.text, /move v1\.3 to the commit "Build from Aperture" made/);
});

test("this week, Aperture Bot v1.15 was published by hand on the old build: stale, and v1 with it", () => {
  const findings = judgeAction(
    action({
      name: "Aperture Bot",
      latest: { tag: "v1.15", commit: "f14de01aaaaaaaa" },
      major: { tag: "v1", commit: "f14de01aaaaaaaa" },
      message: "Build dist from Hankaws/aperture@781d57b0000",
      staleFiles: ["src/lib/workspace/safety.ts", "src/lib/workspace/checks.ts"],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(
    findings[0]!.text,
    'Aperture Bot v1.15 was built from aperture@781d57b, and 2 files it bundles have changed by v0.28.0: src/lib/workspace/safety.ts, src/lib/workspace/checks.ts. Run "Build from Aperture" with that release and publish the next version.',
  );
});

test("v1 left behind the newest release is a failure, with the command that fixes it", () => {
  const findings = judgeAction(action({ major: { tag: "v1", commit: "86f8811aaaaaaaa" } }));
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.text, /v1 is on 86f8811, not on v1\.3 \(8314ee5\)/);
  assert.match(findings[0]!.text, /git tag -f v1 v1\.3 && git push -f origin v1$/);
  assert.match(judgeAction(action({ major: null }))[0]!.text, /there is no v1 tag/);
});

test("many stale files are counted, not all listed", () => {
  const files = Array.from({ length: 8 }, (_, i) => `src/lib/f${i}.ts`);
  assert.match(
    judgeAction(action({ staleFiles: files }))[0]!.text,
    /8 files it bundles have changed .*f4\.ts and 3 more\./,
  );
});

test("no release at all is said, not failed", () => {
  assert.deepEqual(judgeAction(action({ latest: null })), [
    { level: "warn", text: "Aperture Agent Check: no published release to check." },
  ]);
});

test("Aperture: a version skipped between published ones fails; merged and not yet published only warns", () => {
  const skipped = judgeApp({
    version: "0.28.0",
    changelog: ["0.28.0", "0.27.0", "0.26.0"],
    published: ["v0.28.0", "v0.26.0"],
    versionAtTag: {},
  });
  assert.deepEqual(
    skipped.map((f) => f.level),
    ["fail"],
  );
  assert.equal(
    skipped[0]!.text,
    "Aperture 0.27.0 was never published, though 0.28.0 was. Publish it: npm run -s release-url -- 0.27.0",
  );

  const waiting = judgeApp({
    version: "0.29.0",
    changelog: ["0.29.0", "0.28.0"],
    published: ["v0.28.0"],
    versionAtTag: { "v0.28.0": "0.28.0" },
  });
  assert.deepEqual(
    waiting.map((f) => f.level),
    ["ok", "warn"],
  );
  assert.match(waiting[1]!.text, /0\.29\.0 is merged but not published yet/);
  assert.equal(report(waiting).failed, false);
});

test("Aperture: a tag on a commit whose package.json says another version fails", () => {
  const wrong = judgeApp({
    version: "0.28.0",
    changelog: ["0.28.0"],
    published: ["v0.28.0"],
    versionAtTag: { "v0.28.0": "0.27.0" },
  });
  assert.equal(report(wrong).failed, true);
  assert.match(wrong[0]!.text, /v0\.28\.0 is tagged on a commit whose package\.json says 0\.27\.0/);
});

test("Aperture: old versions that never went out are said once, as a warning, not a failure", () => {
  const findings = judgeApp({
    version: "0.28.0",
    changelog: ["0.28.0", "0.27.0", "0.26.0", "0.23.0", "0.22.0", "0.21.0", "0.3.0", "0.2.0"],
    published: ["v0.28.0", "v0.27.0", "v0.26.0", "v0.22.0", "v0.2.0"],
    versionAtTag: { "v0.28.0": "0.28.0" },
  });
  assert.deepEqual(
    findings.map((f) => f.level),
    ["ok", "warn"],
  );
  assert.equal(findings[0]!.text, "Aperture: v0.28.0 is the newest release.");
  assert.equal(
    findings[1]!.text,
    "Older Aperture versions in CHANGELOG.md were never published: 0.23.0, 0.21.0, 0.3.0. Publish them with npm run -s release-url -- <version>, or leave them.",
  );
  assert.equal(report(findings).failed, false);
});
