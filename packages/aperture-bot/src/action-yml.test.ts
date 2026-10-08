import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("action.yml declares exactly the inputs the Action reads", () => {
  const yml = readFileSync(new URL("../action/action.yml", import.meta.url), "utf8");
  const inputs = yml.split(/\noutputs:/)[0]!.split(/\ninputs:\n/)[1]!;
  const declared = [...inputs.matchAll(/^ {2}([a-z-]+):$/gm)].map((m) => m[1]!).sort();
  const source = readFileSync(new URL("./action.ts", import.meta.url), "utf8");
  const read = [
    ...new Set([...source.matchAll(/(?:input|number)\(env, "([a-z-]+)"/g)].map((m) => m[1]!)),
  ].sort();
  assert.deepEqual(declared, read);
  assert.match(yml, /main: dist\/action\.cjs/);
});

test("the README shows every input and the workflow that asks for write access only where needed", () => {
  const readme = readFileSync(new URL("../action/README.md", import.meta.url), "utf8");
  const yml = readFileSync(new URL("../action/action.yml", import.meta.url), "utf8");
  const inputs = yml.split(/\noutputs:/)[0]!.split(/\ninputs:\n/)[1]!;
  for (const [, name] of inputs.matchAll(/^ {2}([a-z-]+):$/gm))
    assert.match(
      readme,
      new RegExp(`^\\| \`${name}\` +\\|`, "m"),
      `the README's settings table should list ${name}`,
    );
  assert.match(
    readme,
    /permissions:\n {2}contents: write\n {2}pull-requests: write\n {2}issues: write\n/,
  );
  assert.match(readme, /uses: hankaws\/aperture-bot@v1/);
  assert.doesNotMatch(readme, /pull_request_target/);
});
