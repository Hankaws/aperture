import assert from "node:assert/strict";
import { test } from "node:test";
import { activeSlash, expandSlash, filterSlash, parseSkillSlash, parseSlash, skillInstruction } from "./slash.ts";
import { parseSkill, type Skill } from "../workspace/skills.ts";

test("parseSlash reads /review /fix /explain", () => {
  assert.deepEqual(parseSlash("/review titles"), { name: "review", rest: "titles" });
  assert.deepEqual(parseSlash("/fix"), { name: "fix", rest: "" });
  assert.equal(parseSlash("review this"), null);
});

test("activeSlash only while typing the command name", () => {
  assert.deepEqual(activeSlash("/re", 3), { query: "re" });
  assert.equal(activeSlash("/review titles", 10), null);
  assert.equal(activeSlash("not a slash", 3), null);
});

test("filterSlash prefixes names", () => {
  assert.equal(filterSlash("ex")[0]?.name, "explain");
});

test("expandSlash /review stays in ask mode", () => {
  const next = expandSlash("review", "check titles", {
    activePath: "a.ts",
    selection: null,
    pending: [
      {
        id: "1",
        path: "a.ts",
        oldText: "x",
        newText: "y",
        description: "d",
        status: "pending",
      },
    ],
  });
  assert.equal(next.mode, "chat");
  assert.match(next.instruction, /### a\.ts/);
  assert.match(next.instruction, /\+ y/);
});

const skill = (path: string, raw: string): Skill => parseSkill(path, raw)!;
const release = skill(".aperture/skills/release.md", "---\nname: release\ndescription: Cut a release.\nchecks: test\n---\nSteps.");
const migration = skill(".aperture/skills/Add Migration/SKILL.md", "# Add a migration\n\nWrite the next one.");
// A skill named as a command: the command wins.
const fixSkill = skill(".aperture/skills/fix.md", "---\nname: fix\ndescription: Our way to fix.\n---\nSteps.");
const skills = [release, migration, fixSkill];

test("the project's skills follow the commands in the slash menu", () => {
  assert.deepEqual(
    filterSlash("", skills).map((h) => [h.name, Boolean(h.skill)]),
    [["review", false], ["fix", false], ["explain", false], ["release", true], ["add-migration", true]],
  );
  assert.deepEqual(
    filterSlash("rel", skills).map((h) => h.name),
    ["release"],
  );
  // By what a skill is for, too.
  assert.deepEqual(
    filterSlash("next one", skills).map((h) => h.name),
    ["add-migration"],
  );
  const hit = filterSlash("add", skills)[0]!;
  assert.deepEqual(hit.skill, { path: ".aperture/skills/Add Migration/SKILL.md" });
  assert.equal(filterSlash("rel").length, 0);
});

test("/release names a skill: the agent loads it first and follows it, held to its checks", () => {
  assert.deepEqual(parseSkillSlash("/release cut 0.13.0", skills), { skill: release, rest: "cut 0.13.0" });
  assert.deepEqual(parseSkillSlash("/Add-Migration", skills), { skill: migration, rest: "" });
  assert.equal(parseSkillSlash("/fix the bug", skills), null, "a command is not a skill");
  assert.equal(parseSkillSlash("/deploy now", skills), null);
  assert.equal(parseSkillSlash("release it", skills), null);
  assert.equal(
    skillInstruction(release, "cut 0.13.0"),
    'Use the project\'s skill "release" for this task: call load_skill with the name "release" first, then follow it. Its checks (`npm run test`) must pass before you are done.\n\ncut 0.13.0',
  );
  assert.equal(
    skillInstruction(migration, ""),
    'Use the project\'s skill "add-migration" for this task: call load_skill with the name "add-migration" first, then follow it.\n\nDo what the skill describes.',
  );
});
