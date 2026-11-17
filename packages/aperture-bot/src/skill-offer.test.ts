import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { BotSummary } from "../../../src/lib/bot/summary.ts";
import type { BotTask } from "../../../src/lib/bot/tasks.ts";
import { draftFor, localSkills, saveSkillTask, skillOffer, type Finished } from "./skill-offer.ts";

const day = new Date("2026-11-17T12:00:00Z");
let n = 0;
const earlier = (text: string, summary: Partial<BotSummary> = {}): BotTask => {
  n += 1;
  return {
    id: n,
    via: "comment",
    number: n,
    thread: null,
    task: text,
    author: "ada",
    askedAt: "2026-11-10T10:00:00Z",
    askedUrl: `https://github.com/acme/shop/issues/${n}#asked`,
    state: "clear",
    summary: {
      v: 1,
      state: "clear",
      asked: n,
      run: "",
      plan: ["Read the latest migration", "Write the next one"],
      files: ["migrations/0003_orders.sql"],
      link: { url: `https://github.com/acme/shop/pull/${100 + n}`, what: "pull" },
      ...summary,
    },
    replyUrl: null,
    updatedAt: "2026-11-10T10:00:00Z",
    diff: null,
  };
};
const done = (task: string, extra: Partial<Finished> = {}): Finished => ({
  task,
  plan: ["Read the latest migration", "Write the next one", "Update the schema type"],
  files: ["migrations/0004_invoices.sql", "src/db/schema.ts"],
  followed: [],
  url: "https://github.com/acme/shop/pull/200",
  at: "2026-11-17T11:00:00Z",
  ...extra,
});

test("a change that repeats a kind of task done lately is offered as a skill, drafted from both", () => {
  const offer = skillOffer(
    "acme/shop",
    done("Add a migration for invoices"),
    [earlier("Add a migration for orders"), earlier("Explain the cart", { kind: "answer" })],
    [],
    day,
  )!;
  assert.equal(offer.path, ".aperture/skills/add-a-migration.md");
  assert.deepEqual(
    offer.tasks.map((t) => t.task),
    ["Add a migration for invoices", "Add a migration for orders"],
  );
  assert.match(offer.text, /\n3\. Update the schema type\n/);
  assert.match(offer.text, /- `migrations\/0003_orders\.sql`\n- `migrations\/0004_invoices\.sql`/);
});

test("no offer the first time, once a skill does it, or for a run that saved a skill", () => {
  const twice = [earlier("Add a migration for orders")];
  assert.equal(skillOffer("acme/shop", done("Fix the login page"), twice, [], day), null);
  assert.equal(
    skillOffer(
      "acme/shop",
      done("Add a migration for invoices", { followed: [".aperture/skills/db.md"] }),
      twice,
      [],
      day,
    ),
    null,
    "the run followed a skill",
  );
  const taken = [
    {
      name: "add-a-migration",
      path: ".aperture/skills/add-a-migration.md",
      description: "",
      text: "",
    },
  ];
  assert.equal(
    skillOffer("acme/shop", done("Add a migration for invoices"), twice, taken, day),
    null,
  );
  const save = "Save tasks like this as a skill: `.aperture/skills/add-a-migration.md`";
  assert.equal(skillOffer("acme/shop", done(save), [earlier(save)], [], day), null);
  // The same change read back from GitHub is not a second task of its kind.
  const self = earlier("Add a migration for orders", {
    link: { url: "https://github.com/acme/shop/pull/200", what: "pull" },
  });
  assert.equal(
    skillOffer("acme/shop", done("Add a migration for invoices"), [self], [], day),
    null,
  );
});

test("its draft is found again by its path when the box is ticked", () => {
  const tasks = [earlier("Add a migration for orders"), earlier("Add a migration for invoices")];
  const draft = draftFor("acme/shop", ".aperture/skills/add-a-migration.md", tasks, [], day)!;
  assert.equal(draft.name, "add-a-migration");
  assert.equal(draftFor("acme/shop", ".aperture/skills/other.md", tasks, [], day), null);
});

test("the run a tick starts saves that skill from the draft, fitted to every task of its kind", () => {
  const tasks = [earlier("Add a migration for orders"), earlier("Add a migration for invoices")];
  const draft = draftFor("acme/shop", ".aperture/skills/add-a-migration.md", tasks, [], day);
  const task = saveSkillTask(".aperture/skills/add-a-migration.md", draft);
  assert.match(
    task,
    /^Save tasks like this as a skill: `\.aperture\/skills\/add-a-migration\.md`\.\n/,
  );
  assert.match(task, /named `add-a-migration`/);
  assert.match(
    task,
    /drafted from 2 recent tasks of this kind: "Add a migration for orders", "Add a migration for invoices"\./,
  );
  assert.match(
    task,
    /If `\.aperture\/skills\/add-a-migration\.md` already exists, .* change nothing/,
  );
  assert.ok(task.includes(`\`\`\`markdown\n${draft!.text.trimEnd()}\n\`\`\``));
  // The tasks aged out: the agent writes it from the repository.
  const bare = saveSkillTask(".aperture/skills/add-a-migration.md", null);
  assert.doesNotMatch(bare, /The draft:|drafted from/);
});

test("the checkout's skills are read, a file or a folder each", () => {
  const cwd = mkdtempSync(join(tmpdir(), "skill-offer-"));
  assert.deepEqual(localSkills(cwd), []);
  mkdirSync(join(cwd, ".aperture/skills/release"), { recursive: true });
  writeFileSync(
    join(cwd, ".aperture/skills/db.md"),
    "---\nname: db\ndescription: Migrations.\n---\nSteps.",
  );
  writeFileSync(join(cwd, ".aperture/skills/release/SKILL.md"), "Steps.");
  writeFileSync(join(cwd, ".aperture/skills/notes.txt"), "not a skill");
  assert.deepEqual(
    localSkills(cwd)
      .map((s) => s.name)
      .sort(),
    ["db", "release"],
  );
});
