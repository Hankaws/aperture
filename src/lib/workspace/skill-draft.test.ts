import assert from "node:assert/strict";
import { test } from "node:test";
import { isLastReplyOfRun, nameFromRequest, skillFromRun } from "./skill-draft.ts";
import { parseSkill, projectSkills } from "./skills.ts";
import type { ChatMessage, PlanEntry, ProposedEdit } from "./types.ts";

let clock = 1_000;
function user(content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  clock += 10;
  return { id: `u${clock}`, role: "user", content, createdAt: clock, ...extra };
}
function reply(extra: Partial<ChatMessage> = {}): ChatMessage {
  clock += 10;
  return { id: `a${clock}`, role: "assistant", content: "Done.", createdAt: clock, ...extra };
}
const edit = (path: string, status: ProposedEdit["status"] = "applied"): ProposedEdit => ({
  id: `e_${path}`,
  path,
  oldText: "",
  newText: "x",
  description: "",
  status,
});
const plan = (...steps: string[]): PlanEntry[] =>
  steps.map((content, i) => ({ id: `p${i}`, content, status: "completed" }));
const day = new Date("2026-11-08T12:00:00Z");

test("a request is named for its first words, without please and the like", () => {
  assert.equal(nameFromRequest("Please add a migration for the orders table"), "add-a-migration");
  assert.equal(nameFromRequest("Can you cut a release?"), "cut-a-release");
  assert.equal(nameFromRequest("Release\nwith notes"), "release");
  assert.equal(nameFromRequest("Ajoute une page « À propos »"), "ajoute-une-page");
  assert.equal(nameFromRequest("Fix the off-by-one in listTasks"), "fix-the-off-by-one");
  assert.equal(nameFromRequest("Write tests for the cart"), "write-tests");
  assert.equal(nameFromRequest("The"), "the");
  assert.equal(nameFromRequest("!!!"), "skill");
  assert.ok(nameFromRequest("x".repeat(100)).length <= 40);
});

test("a finished run becomes a skill: the request is what it is for, the plan its steps, the check its last", () => {
  const messages = [
    user("Please add a migration for the orders table\nwith a status column", { runId: "r1" }),
    reply({
      runId: "r1",
      plan: plan("Read the latest migration", "Write  the next one\n in order"),
    }),
    user("Build it.", { runId: "r1" }),
    reply({
      runId: "r1",
      plan: plan("Read the latest migration", "Write the next one", "Update the schema type"),
      edits: [
        edit("migrations/0003_orders.sql"),
        edit("src/db/schema.ts"),
        edit("src/old.ts", "rejected"),
      ],
      verify: { script: "test", status: "passed", detail: "12 pass" },
    }),
  ];
  const draft = skillFromRun(messages, messages[3]!.id, {}, day)!;
  assert.equal(draft.name, "add-a-migration");
  assert.equal(draft.path, ".aperture/skills/add-a-migration.md");
  assert.equal(
    draft.text,
    [
      "---",
      "name: add-a-migration",
      "description: For tasks like: Please add a migration for the orders table",
      "checks: test",
      "---",
      "Made on 2026-11-08 from an agent run that did this. Make the name, the description and the steps fit every task like it, not only that one: the agent sees the description, and loads these steps when a task matches.",
      "",
      "1. Read the latest migration",
      "2. Write the next one",
      "3. Update the schema type",
      "",
      "Files that run changed, as examples:",
      "- `migrations/0003_orders.sql`",
      "- `src/db/schema.ts`",
      "",
    ].join("\n"),
  );
  // The agent reads it back as a skill, under the name and description written.
  const skill = parseSkill(draft.path, draft.text)!;
  assert.equal(skill.name, draft.name);
  assert.equal(skill.description, "For tasks like: Please add a migration for the orders table");
  // From the plan's first reply too: the same run, the same draft.
  assert.equal(skillFromRun(messages, messages[1]!.id, {}, day)?.text, draft.text);
});

test("with no plan, the steps are the files it changed; with neither, there is no draft", () => {
  const messages = [
    user("Rename total to subtotal"),
    reply({ edits: [edit("src/cart.ts"), edit("src/cart.test.ts")] }),
  ];
  const draft = skillFromRun(messages, messages[1]!.id, {}, day)!;
  assert.match(draft.text, /\n1\. Change `src\/cart\.ts`\.\n2\. Change `src\/cart\.test\.ts`\.\n/);
  const talk = [user("What does cart.ts do?"), reply()];
  assert.equal(skillFromRun(talk, talk[1]!.id, {}, day), null);
  const rejected = [user("Rename it"), reply({ edits: [edit("src/a.ts", "rejected")] })];
  assert.equal(skillFromRun(rejected, rejected[1]!.id, {}, day), null);
  assert.equal(skillFromRun(messages, "missing", {}, day), null);
});

test("a draft never takes a name or a file a skill already has", () => {
  const messages = [user("Cut a release"), reply({ plan: plan("Move Unreleased") })];
  const files = {
    ".aperture/skills/cut-a-release.md": "Some steps.",
    ".aperture/skills/other.md": "---\nname: cut-a-release-2\n---\nSteps.",
  };
  const draft = skillFromRun(messages, messages[1]!.id, files, day)!;
  assert.equal(draft.name, "cut-a-release-3");
  assert.equal(draft.path, ".aperture/skills/cut-a-release-3.md");
  const all = projectSkills({ ...files, [draft.path]: draft.text });
  assert.equal(new Set(all.map((s) => s.name)).size, 3);
});

test("a long request is cut to fit a description, long plans and file lists are cut too", () => {
  const long = `Do ${"many things ".repeat(30)}`;
  const steps = Array.from({ length: 20 }, (_, i) => `Step ${i + 1}`);
  const edits = Array.from({ length: 11 }, (_, i) => edit(`src/f${i}.ts`));
  const messages = [user(long), reply({ plan: plan(...steps), edits })];
  const draft = skillFromRun(messages, messages[1]!.id, {}, day)!;
  const skill = parseSkill(draft.path, draft.text)!;
  assert.ok(skill.description.length <= 160);
  assert.ok(skill.description.endsWith("…"));
  assert.match(draft.text, /\n12\. Step 12\n/);
  assert.doesNotMatch(draft.text, /Step 13/);
  assert.match(draft.text, /- `src\/f7\.ts`\n- and 3 more\n/);
});

test("Save as skill is offered on the last reply of a run only", () => {
  const messages = [
    user("Fix it", { runId: "r1" }),
    reply({ runId: "r1", plan: plan("A") }),
    user("Build it.", { runId: "r1" }),
    reply({ runId: "r1", edits: [edit("a.ts")] }),
    user("Something else"),
    reply(),
  ];
  assert.equal(isLastReplyOfRun(messages, messages[1]!.id), false);
  assert.equal(isLastReplyOfRun(messages, messages[3]!.id), true);
  assert.equal(isLastReplyOfRun(messages, messages[5]!.id), true);
  assert.equal(isLastReplyOfRun(messages, messages[0]!.id), false);
});

test("a draft is held to the checks its run was: the project's own and its skills'", () => {
  const messages = [
    user("Add a migration"),
    reply({
      edits: [edit("migrations/0004.sql")],
      verify: {
        script: "test",
        status: "passed",
        detail: "",
        skills: [
          { script: "migrate:check", skill: "db", status: "passed", detail: "" },
          { script: "test", skill: "db", status: "passed", detail: "" },
        ],
      },
    }),
  ];
  const draft = skillFromRun(messages, messages[1]!.id, {}, day)!;
  assert.match(
    draft.text,
    /\ndescription: For tasks like: Add a migration\nchecks: test, migrate:check\n---\n/,
  );
  assert.deepEqual(parseSkill(draft.path, draft.text)!.checks, ["test", "migrate:check"]);
  const none = [user("Rename it"), reply({ edits: [edit("a.ts")] })];
  assert.doesNotMatch(skillFromRun(none, none[1]!.id, {}, day)!.text, /checks:/);
});
