import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_CHECK_WORKFLOW_PATH,
  agentCheckWorkflow,
  installOf,
  installUrl,
} from "./agent-check-workflow.ts";

/** The workflow the Bot page has shown since the comment shipped, now on `@v1`. */
const NPM = `# .github/workflows/aperture-agent-check.yml
name: Aperture Agent Check
on: pull_request

jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # for the one comment with the result
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # it compares against the pull request's base
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci # for the tests, and your packages' real types
      - uses: hankaws/aperture-agent-check@v1
        with:
          comment: true # one comment on the pull request, updated on each push`;

test("the default workflow is the npm one, on the action's newest release", () => {
  assert.equal(agentCheckWorkflow(), NPM);
  assert.equal(agentCheckWorkflow({ manager: "npm", locked: true }), NPM);
  // `comment` is an input from v1.10 on: a pinned older tag would ignore it.
  assert.doesNotMatch(agentCheckWorkflow(), /aperture-agent-check@v1\.\d/);
});

test("the install steps follow the repository's package manager", () => {
  const steps = (install: Parameters<typeof agentCheckWorkflow>[0]) =>
    agentCheckWorkflow(install)
      .split("\n")
      .filter((line) => /^ {6}- (run|uses): /.test(line))
      .map((line) => line.trim().replace(/ #.*$/, ""));
  assert.deepEqual(steps({ manager: "npm", locked: false }), [
    "- uses: actions/checkout@v4",
    "- uses: actions/setup-node@v4",
    "- run: npm install",
    "- uses: hankaws/aperture-agent-check@v1",
  ]);
  assert.deepEqual(steps({ manager: "pnpm", locked: true }).slice(2, 4), [
    "- run: corepack enable",
    "- run: pnpm install --frozen-lockfile",
  ]);
  assert.deepEqual(steps({ manager: "yarn", locked: true }).slice(2, 4), [
    "- run: corepack enable",
    "- run: yarn install",
  ]);
  assert.deepEqual(steps({ manager: "bun", locked: true }).slice(2, 4), [
    "- uses: oven-sh/setup-bun@v2",
    "- run: bun install --frozen-lockfile",
  ]);
  // Nothing to install or test: no Node set up, and the tests off.
  const bare = agentCheckWorkflow(null);
  assert.deepEqual(steps(null), [
    "- uses: actions/checkout@v4",
    "- uses: hankaws/aperture-agent-check@v1",
  ]);
  assert.match(bare, /\n {10}run-tests: false #[^\n]*\n {10}comment: true #/);
});

test("every line of every workflow is indented in steps of two spaces, with no tabs", () => {
  for (const install of [
    null,
    { manager: "npm", locked: false },
    { manager: "pnpm", locked: false },
    { manager: "yarn", locked: false },
    { manager: "bun", locked: false },
  ] as const) {
    for (const line of agentCheckWorkflow(install).split("\n")) {
      assert.doesNotMatch(line, /\t/);
      assert.equal(/^ */.exec(line)![0].length % 2, 0, line);
    }
  }
});

test("the package manager comes from packageManager, else the lockfile, else npm unlocked", () => {
  const pkg = (fields: Record<string, unknown> = {}) => JSON.stringify({ name: "x", ...fields });
  assert.equal(installOf(undefined, ["package-lock.json"]), null);
  assert.deepEqual(installOf(pkg(), []), { manager: "npm", locked: false });
  assert.deepEqual(installOf(pkg(), ["package-lock.json"]), { manager: "npm", locked: true });
  assert.deepEqual(installOf(pkg(), ["yarn.lock"]), { manager: "yarn", locked: true });
  assert.deepEqual(installOf(pkg(), ["bun.lockb"]), { manager: "bun", locked: true });
  // Two lockfiles: pnpm's wins over a stray package-lock.json.
  assert.deepEqual(installOf(pkg(), ["package-lock.json", "pnpm-lock.yaml"]), {
    manager: "pnpm",
    locked: true,
  });
  // packageManager names it, and whether it is locked is that manager's lockfile.
  assert.deepEqual(installOf(pkg({ packageManager: "pnpm@9.12.0" }), ["package-lock.json"]), {
    manager: "pnpm",
    locked: false,
  });
  assert.deepEqual(installOf(pkg({ packageManager: "yarn@4.5.0+sha512.abc" }), ["yarn.lock"]), {
    manager: "yarn",
    locked: true,
  });
  // An unknown or malformed packageManager falls back to the lockfile.
  assert.deepEqual(installOf(pkg({ packageManager: "deno@2" }), ["yarn.lock"]), {
    manager: "yarn",
    locked: true,
  });
  assert.deepEqual(installOf("{ not json", ["bun.lock"]), { manager: "bun", locked: true });
});

test("the link opens GitHub's new-file page on the branch, with the workflow filled in", () => {
  const workflow = agentCheckWorkflow();
  const url = installUrl({ owner: "Acme", repo: "shop.js" }, "main", workflow)!;
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://github.com");
  assert.equal(parsed.pathname, "/Acme/shop.js/new/main");
  assert.equal(parsed.searchParams.get("filename"), AGENT_CHECK_WORKFLOW_PATH);
  // The path is the file's name there, so the text starts at `name:` and ends with a newline.
  const value = parsed.searchParams.get("value")!;
  assert.ok(value.startsWith("name: Aperture Agent Check\n"), value);
  assert.ok(
    value.endsWith("comment: true # one comment on the pull request, updated on each push\n"),
  );
  assert.equal(`# ${AGENT_CHECK_WORKFLOW_PATH}\n${value}`, `${workflow}\n`);
  // A branch with a slash keeps it as a path; one with a character that needs escaping is escaped.
  assert.equal(
    new URL(installUrl({ owner: "a", repo: "b" }, "release/v2", workflow)!).pathname,
    "/a/b/new/release/v2",
  );
  // No branch known, or one a link should not carry: no link.
  assert.equal(installUrl({ owner: "a", repo: "b" }, null, workflow), null);
  for (const bad of ["", "../x", "a//b", "/main", "main/", "a b", "a?b", "a#b", "x@{1}"])
    assert.equal(installUrl({ owner: "a", repo: "b" }, bad, workflow), null, bad);
});
