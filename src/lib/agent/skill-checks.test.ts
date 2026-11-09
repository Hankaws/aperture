import assert from "node:assert/strict";
import { test } from "node:test";
import {
  carriedSkillsLine,
  missingResult,
  skillCheckLines,
  skillCheckResult,
  skillChecksFor,
  skillFixPrompt,
  skillsForEdits,
  skillsOfPlan,
} from "./skill-checks.ts";
import { skillRows } from "../workspace/checks.ts";
import type { Skill } from "../workspace/skills.ts";

const skill = (name: string, checks?: string[]): Skill => ({
  name,
  path: `.aperture/skills/${name}.md`,
  description: "",
  text: "Steps.",
  ...(checks ? { checks } : {}),
});
const migration = skill("migration", ["migrate:check", "test"]);
const release = skill("release", ["test", "changelog:check"]);
const docs = skill("docs");

test("the checks of the skills loaded this turn, each once, without the project's own", () => {
  const all = [migration, release, docs];
  const loaded = [release.path, migration.path, docs.path];
  assert.deepEqual(skillChecksFor(all, loaded, ["test", "migrate:check"], "test"), {
    run: [{ script: "migrate:check", skill: "migration" }],
    missing: [{ script: "changelog:check", skill: "release" }],
  });
  // Not loaded this turn: not held to it.
  assert.deepEqual(skillChecksFor(all, [docs.path], ["test"], null), { run: [], missing: [] });
  assert.deepEqual(skillChecksFor(all, [migration.path], ["test", "migrate:check"], null).run, [
    { script: "migrate:check", skill: "migration" },
    { script: "test", skill: "migration" },
  ]);
});

test("a run that passed, failed or never ran reads as such, failures first", () => {
  const check = { script: "migrate:check", skill: "migration" };
  const failed = skillCheckResult(check, {
    text: 'Run failed at "migrate:check" with exit code 1.\nError: 0003 is out of order',
    passed: false,
    ran: true,
  });
  assert.deepEqual(failed, { ...check, status: "failed", detail: "Error: 0003 is out of order" });
  const passed = skillCheckResult(check, { text: "ok", passed: true, ran: true });
  assert.equal(passed.status, "passed");
  const notRun = skillCheckResult(check, {
    text: "No time left to run it.",
    passed: false,
    ran: false,
  });
  assert.deepEqual(notRun, { ...check, status: "not_run", detail: "No time left to run it." });
  const missing = missingResult({ script: "changelog:check", skill: "release" });
  assert.equal(missing.status, "not_run");
  assert.match(missing.detail, /no "changelog:check" script/);
  assert.deepEqual(skillCheckLines([passed, missing, failed]), [
    "Not done: skill migration needs `npm run migrate:check` to pass, and it fails against these edits (Error: 0003 is out of order)",
    `Not checked: skill release needs \`npm run changelog:check\`, which did not run (${missing.detail})`,
    "Skill migration: `npm run migrate:check` passed.",
  ]);
  assert.match(
    skillFixPrompt(check, "the output"),
    /^Skill migration says `npm run migrate:check` must pass/,
  );
  assert.match(skillFixPrompt(check, "the output"), /\nthe output\n/);
});

test("in the check list, a failing skill check is red and holds Apply, as a failing test does", () => {
  const verify = {
    script: "test",
    status: "passed" as const,
    detail: "",
    rechecked: true,
    skills: [
      {
        script: "migrate:check",
        skill: "migration",
        status: "failed" as const,
        detail: "0003 is out of order",
      },
      { script: "lint", skill: "migration", status: "passed" as const, detail: "" },
      { script: "e2e", skill: "release", status: "not_run" as const, detail: "No sandbox." },
    ],
  };
  assert.deepEqual(skillRows(verify), [
    {
      id: "skill:migrate:check",
      label: "migrate:check",
      status: "fail",
      detail:
        "Skill migration: npm run migrate:check failed after the agent's fix: 0003 is out of order",
    },
    {
      id: "skill:lint",
      label: "lint",
      status: "pass",
      detail: "Skill migration: npm run lint passed after the agent's fix.",
    },
    {
      id: "skill:e2e",
      label: "e2e",
      status: "skip",
      detail: "Skill release: not run. No sandbox.",
    },
  ]);
  assert.deepEqual(skillRows(null), []);
  assert.deepEqual(skillRows({ script: "test", status: "passed", detail: "" }), []);
});

test("a follow-up on a change, or the build of a plan, is held to the skills it was made under", () => {
  const messages = [
    { role: "user" },
    { role: "assistant", plan: [{}], skills: [release.path] },
    { role: "assistant", edits: [{ id: "e1" }], skills: [migration.path] },
    { role: "assistant", edits: [{ id: "e2" }], skills: [release.path, migration.path] },
    { role: "assistant", edits: [{ id: "e3" }] },
  ];
  assert.deepEqual(skillsForEdits(messages, ["e1", "e2"]), [migration.path, release.path]);
  assert.deepEqual(skillsForEdits(messages, ["e3"]), []);
  assert.deepEqual(skillsOfPlan(messages), [release.path]);
  assert.deepEqual(skillsOfPlan([{ role: "user" }]), []);
  assert.equal(
    carriedSkillsLine([migration, release], [migration.path]),
    "This change was made following the skill migration: keep following it (load_skill reads the steps again). `npm run migrate:check`, `npm run test` must still pass before you are done; they run on your edits when you finish.",
  );
  assert.match(
    carriedSkillsLine([docs, release], [docs.path, release.path]),
    /the skills docs, release: keep following them/,
  );
  assert.equal(carriedSkillsLine([docs], []), "");
  assert.equal(carriedSkillsLine([docs], [".aperture/skills/gone.md"]), "");
});
