import assert from "node:assert/strict";
import { test } from "node:test";
import { safetyFindings } from "./safety.ts";

// Every fake key is put together here, at run time: this file's own text holds none, so the
// check reading this repository's pull requests has nothing to find in it.
const join = (...parts: string[]) => parts.join("");
const GITHUB = join("gh", "p_", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9");
const AWS = join("AK", "IA", "Q2W3E4R5T6Y7U8I9");
const XAI = join("xa", "i-", "Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe9Dc8Ba7Zx6Yw5Vu");
const PEM = join("-----BEGIN ", "RSA PRIVATE KEY-----");
const COMMENT = join("/", "/ ");

const edit = (path: string, newText: string, deleted = false) => ({ path, newText, deleted });
const levels = (findings: ReturnType<typeof safetyFindings>) =>
  findings.map((f) => `${f.level} ${f.path}`);

test("a nothing-to-see change has nothing to say", () => {
  const files = { "src/a.ts": "export const a = 1;\n" };
  assert.deepEqual(safetyFindings(files, [edit("src/a.ts", "export const a = 2;\n")]), []);
});

test("a key written into the code is red, says where, and never repeats the key", () => {
  const files = { "src/client.ts": "export const client = make();\n" };
  const after = `export const client = make({ token: "${GITHUB}" });\nconst aws = "${AWS}";\nconst grok = "${XAI}";\n`;
  const found = safetyFindings(files, [edit("src/client.ts", after)]);
  assert.deepEqual(
    found.map((f) => [f.level, f.what]),
    [
      ["red", "adds a GitHub token at line 1"],
      ["red", "adds an AWS access key at line 2"],
      ["red", "adds an xAI key at line 3"],
    ],
  );
  for (const f of found) for (const key of [GITHUB, AWS, XAI]) assert.ok(!f.what.includes(key));
  assert.equal(found[0]!.line, 1);
});

test("a private key in a new file is red", () => {
  const found = safetyFindings({}, [edit("deploy/key.pem", `${PEM}\nMIIEow...\n`)]);
  assert.deepEqual(levels(found), ["red deploy/key.pem"]);
});

test("a key that was already there is not blamed on this change", () => {
  const before = `const t = "${GITHUB}";\n`;
  assert.deepEqual(
    safetyFindings({ "a.ts": before }, [edit("a.ts", `${before}const more = 1;\n`)]),
    [],
  );
});

test("example keys from the docs, and values read from the environment, are not keys", () => {
  const files = { "README.md": "" };
  const after = [
    `AWS_ACCESS_KEY_ID=${join("AK", "IAIOSFODNN7", "EXAMPLE")}`,
    'const apiKey = process.env.XAI_API_KEY ?? "";',
    'const password = "your-password-here-please";',
  ].join("\n");
  assert.deepEqual(safetyFindings(files, [edit("README.md", after)]), []);
});

test("a long value named like a secret is worth a look, not held", () => {
  const found = safetyFindings({}, [
    edit("src/config.ts", join('export const apiKey = "', "q8Zr2LmN4", 'vX7pT1wK9sB";\n')),
  ]);
  assert.deepEqual(
    found.map((f) => [f.level, f.what]),
    [["look", "puts what looks like a secret in the code at line 1"]],
  );
});

test("a database address with a password: local is a dev default, anywhere else is worth a look", () => {
  const local = join("postgres://app:", "s3cretpass", "@localhost:5432/app");
  const remote = join("postgres://app:", "s3cretpass", "@db.prod.acme-cloud.io:5432/app");
  assert.deepEqual(safetyFindings({}, [edit("docker-compose.yml", `url: ${local}\n`)]), []);
  assert.deepEqual(levels(safetyFindings({}, [edit("src/db.ts", `const url = "${remote}";\n`)])), [
    "look src/db.ts",
  ]);
});

test("values written into .env are red; a template is not", () => {
  assert.deepEqual(levels(safetyFindings({}, [edit(".env", "XAI_API_KEY=abc123\n")])), [
    "red .env",
  ]);
  assert.deepEqual(levels(safetyFindings({}, [edit(".env.local", "SECRET=1\n")])), [
    "red .env.local",
  ]);
  assert.deepEqual(safetyFindings({}, [edit(".env.example", "XAI_API_KEY=your-key\n")]), []);
  // Taking a value out is not adding one.
  assert.deepEqual(safetyFindings({ ".env": "A=1\nB=2\n" }, [edit(".env", "A=1\n")]), []);
});

test("turning type checking off for a file is red; hiding one error or a lint rule is a look", () => {
  const files = { "src/a.ts": "export const a: number = 1;\n" };
  const nocheck = safetyFindings(files, [
    edit("src/a.ts", `${COMMENT}@ts-nocheck\nexport const a: number = "1";\n`),
  ]);
  assert.deepEqual(
    nocheck.map((f) => [f.level, f.what]),
    [["red", "turns type checking off for the whole file (@ts-nocheck)"]],
  );
  const ignore = safetyFindings(files, [
    edit(
      "src/a.ts",
      `${COMMENT}@ts-ignore\nexport const a: number = "1";\n${COMMENT}eslint-disable-next-line\nfoo();\n`,
    ),
  ]);
  assert.deepEqual(
    ignore.map((f) => [f.level, f.what]),
    [
      ["look", "hides a type error (@ts-ignore)"],
      ["look", "turns lint rules off (eslint-disable)"],
    ],
  );
});

test("the words in prose or a string switch nothing off", () => {
  const after =
    'export const help = "Add @ts-nocheck to skip a file; eslint-disable turns a rule off.";\n';
  assert.deepEqual(safetyFindings({}, [edit("src/help.ts", after)]), []);
});

test("loosening tsconfig is red, comments and trailing commas and all", () => {
  const before =
    '{\n  // the project\n  "compilerOptions": { "strict": true, "noImplicitAny": true, },\n}\n';
  const after = '{\n  // the project\n  "compilerOptions": { "strict": false, },\n}\n';
  const found = safetyFindings({ "tsconfig.json": before }, [edit("tsconfig.json", after)]);
  assert.deepEqual(
    found.map((f) => [f.level, f.what]),
    [["red", "loosens type checking (strict, noImplicitAny no longer on)"]],
  );
  // Turning it on is no finding.
  assert.deepEqual(safetyFindings({ "tsconfig.json": after }, [edit("tsconfig.json", before)]), []);
});

test("a lint or typecheck script that stops checking is red", () => {
  const before = JSON.stringify({
    scripts: { lint: "eslint .", typecheck: "tsc --noEmit", dev: "vite" },
  });
  const after = JSON.stringify({ scripts: { lint: "echo skipped", dev: "vite --host" } });
  const found = safetyFindings({ "package.json": before }, [edit("package.json", after)]);
  assert.deepEqual(
    found.map((f) => [f.level, f.what]),
    [["red", "stops the lint, typecheck scripts from checking anything"]],
  );
});

test("new dependencies, ones from a URL, and install scripts are worth a look", () => {
  const before = JSON.stringify({ dependencies: { react: "^19.0.0" }, scripts: {} });
  const after = JSON.stringify({
    dependencies: { react: "^19.0.0", "left-pad": "^1.3.0", tool: "github:someone/tool" },
    scripts: { postinstall: "node setup.js" },
  });
  const found = safetyFindings({ "package.json": before }, [edit("package.json", after)]);
  assert.deepEqual(
    found.map((f) => f.what),
    [
      "adds 2 dependencies: left-pad, tool (check they are the packages you meant)",
      "installs tool from a URL or repository, not the registry",
      "adds or changes a script that runs on install (postinstall)",
    ],
  );
  assert.ok(found.every((f) => f.level === "look"));
});

test("a version bump alone is not a new dependency", () => {
  const before = JSON.stringify({ dependencies: { react: "^19.0.0" } });
  const after = JSON.stringify({ dependencies: { react: "^19.1.0" } });
  assert.deepEqual(
    safetyFindings({ "package.json": before, "package-lock.json": "{}" }, [
      edit("package.json", after),
      edit("package-lock.json", '{"v":2}'),
    ]),
    [],
  );
});

test("a lockfile that moves with no dependency change is worth a look", () => {
  const found = safetyFindings({ "package-lock.json": "{}" }, [
    edit("package-lock.json", '{"v":2}'),
  ]);
  assert.deepEqual(
    found.map((f) => f.what),
    ["changes package-lock.json with no dependency change in package.json"],
  );
});

test("editing or deleting the CI that judges the change is worth a look", () => {
  const files = { ".github/workflows/ci.yml": "on: push\n", ".gitlab-ci.yml": "test: {}\n" };
  const found = safetyFindings(files, [
    edit(".github/workflows/ci.yml", "on: push\njobs: {}\n"),
    edit(".gitlab-ci.yml", "", true),
  ]);
  assert.deepEqual(
    found.map((f) => [f.level, f.what]),
    [
      [
        "look",
        "edits the CI that checks your pull requests (.github/workflows/ci.yml, .gitlab-ci.yml)",
      ],
    ],
  );
});

test("red comes before look, whatever the order of the files", () => {
  const found = safetyFindings({ "package-lock.json": "{}" }, [
    edit("package-lock.json", '{"v":2}'),
    edit("src/a.ts", `const t = "${GITHUB}";\n`),
  ]);
  assert.deepEqual(levels(found), ["red src/a.ts", "look package-lock.json"]);
});
