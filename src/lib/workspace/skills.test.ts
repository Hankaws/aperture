import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findSkill,
  isSkillPath,
  loadSkill,
  parseChecks,
  parseSkill,
  projectSkills,
  SKILL_LIMIT,
  SKILL_TEMPLATE,
  skillName,
  skillsIndex,
  skillTemplate,
} from "./skills.ts";

test("skills live in .aperture/skills, as <name>.md or <name>/SKILL.md", () => {
  assert.deepEqual(
    [
      ".aperture/skills/release.md",
      ".aperture/skills/add-migration/SKILL.md",
      ".aperture/skills/deep/nested/x.md",
      ".aperture/skills/notes.txt",
      ".aperture/rules/tests.md",
      "docs/skills/release.md",
    ].map(isSkillPath),
    [true, true, false, false, false, false],
  );
  assert.equal(skillName("Add a Migration.md"), "add-a-migration");
});

test("a skill's name and description come from front matter, else its file and first line", () => {
  assert.deepEqual(parseSkill(".aperture/skills/release.md", SKILL_TEMPLATE), {
    name: "release",
    path: ".aperture/skills/release.md",
    description: "Cut a release - changelog, version bump and release notes.",
    text: SKILL_TEMPLATE.split("---\n")[2]!.trim(),
  });
  const bare = parseSkill(
    ".aperture/skills/Add Migration/SKILL.md",
    "# Add a migration\n\nCreate migrations/NNNN_name.sql.\nNever edit an old one.",
  );
  assert.equal(bare!.name, "add-migration");
  assert.equal(bare!.description, "Create migrations/NNNN_name.sql.");
  assert.equal(parseSkill(".aperture/skills/empty.md", "---\nname: x\n---\n  "), null);
  const long = parseSkill(
    ".aperture/skills/big.md",
    `${"d".repeat(400)}\n${"s".repeat(SKILL_LIMIT.chars + 10)}`,
  )!;
  assert.equal(long.description.length, SKILL_LIMIT.description);
  assert.match(long.text, /\(skill cut at 12000 characters\)$/);
});

test("the agent is told names and what each is for, then loads the steps by name", () => {
  const skills = projectSkills({
    ".aperture/skills/release.md": SKILL_TEMPLATE,
    ".aperture/skills/z/SKILL.md": "---\nname: release\n---\nA second release skill.",
    ".aperture/skills/add-migration/SKILL.md": "Create migrations/NNNN_name.sql.",
    "src/index.ts": "export {}",
  });
  // A name used twice keeps its first, by path.
  assert.deepEqual(
    skills.map((s) => [s.name, s.path]),
    [
      ["add-migration", ".aperture/skills/add-migration/SKILL.md"],
      ["release", ".aperture/skills/release.md"],
    ],
  );
  assert.equal(
    skillsIndex(skills),
    "Skills in this project. When the task is one a skill is for, call load_skill with its name before you start, then follow it:\n- add-migration: Create migrations/NNNN_name.sql.\n- release: Cut a release - changelog, version bump and release notes.",
  );
  assert.equal(skillsIndex([]), "");
  assert.equal(findSkill(skills, "Add Migration")!.name, "add-migration");
  const loaded = loadSkill(skills, "release");
  assert.ok(!("error" in loaded));
  assert.match(
    loaded.text,
    /^Skill release, from \.aperture\/skills\/release\.md\. Follow it for this task:\n<skill>\n1\. Move everything/,
  );
  assert.deepEqual(loadSkill(skills, "deploy"), {
    error: 'No skill named "deploy". The skills are: add-migration, release.',
  });
  assert.deepEqual(loadSkill([], "release"), {
    error: "This project has no skills (.aperture/skills/).",
  });
});

test("a new skill is named for its file, so it never shares the example's name", () => {
  assert.equal(skillTemplate("release"), SKILL_TEMPLATE);
  const next = parseSkill(".aperture/skills/skill-2.md", skillTemplate("skill-2"))!;
  assert.equal(next.name, "skill-2");
  assert.match(next.description, /^What this skill is for/);
  assert.equal(
    projectSkills({
      ".aperture/skills/release.md": SKILL_TEMPLATE,
      ".aperture/skills/skill-2.md": skillTemplate("skill-2"),
    }).length,
    2,
  );
});

test("a skill can name checks: package.json scripts that must pass, told to the agent", () => {
  assert.deepEqual(parseChecks("test, migrate:check"), ["test", "migrate:check"]);
  assert.deepEqual(parseChecks('npm run lint, `npm test`, "npm run-script e2e"'), [
    "lint",
    "test",
    "e2e",
  ]);
  assert.deepEqual(parseChecks("[test, test, , rm -rf /, a;b]"), ["test"]);
  assert.deepEqual(parseChecks("a, b, c, d, e"), ["a", "b", "c", "d"]);
  assert.deepEqual(parseChecks(""), []);
  const skill = parseSkill(
    ".aperture/skills/migration.md",
    "---\nname: migration\ndescription: Add a migration.\nchecks: test, migrate:check\n---\nWrite the next one.",
  )!;
  assert.deepEqual(skill.checks, ["test", "migrate:check"]);
  assert.equal(parseSkill(".aperture/skills/release.md", SKILL_TEMPLATE)!.checks, undefined);
  assert.match(
    skillsIndex([skill]),
    /- migration: Add a migration\. \(must pass: npm run test, npm run migrate:check\)/,
  );
  const loaded = loadSkill([skill], "migration");
  assert.ok("text" in loaded);
  assert.match(
    loaded.text,
    /<\/skill>\nThis skill's checks must pass before you are done: `npm run test`, `npm run migrate:check`\./,
  );
});
