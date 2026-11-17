import assert from "node:assert/strict";
import { test } from "node:test";
import { newSkillUrl, skillSuggestions } from "./skill-suggest.ts";
import type { BotSummary } from "./summary.ts";
import type { BotTask } from "./tasks.ts";
import { parseSkill, type Skill } from "../workspace/skills.ts";

const day = new Date("2026-11-17T12:00:00Z");
let n = 0;
const task = (text: string, at: string, summary: Partial<BotSummary> = {}): BotTask => {
  n += 1;
  return {
    id: n,
    via: "comment",
    number: n,
    thread: null,
    task: text,
    author: "ada",
    askedAt: at,
    askedUrl: `https://github.com/acme/shop/issues/${n}#asked`,
    state: summary.state ?? "clear",
    summary: {
      v: 1,
      state: "clear",
      asked: n,
      run: "",
      files: [`src/f${n}.ts`],
      link: { url: `https://github.com/acme/shop/pull/${100 + n}`, what: "pull" },
      ...summary,
    },
    replyUrl: `https://github.com/acme/shop/issues/${n}#reply`,
    updatedAt: at,
    diff: null,
  };
};
const skill = (name: string): Skill => ({
  name,
  path: `.aperture/skills/${name}.md`,
  description: "",
  text: "Steps.",
});

test("the same kind of task asked of the bot twice is suggested as a skill, made from both", () => {
  const tasks = [
    task("Please add a migration for invoices", "2026-11-10T10:00:00Z", {
      plan: ["Read the latest migration", "Write the next one", "Update the schema type"],
      files: ["migrations/0004_invoices.sql", "src/db/schema.ts"],
    }),
    task("Explain the cart", "2026-11-09T10:00:00Z", { kind: "answer", files: [] }),
    task("Add a migration for orders", "2026-11-02T10:00:00Z", {
      plan: ["Read the latest migration", "Write the next one"],
      files: ["migrations/0003_orders.sql"],
    }),
    task("Fix the login page", "2026-11-01T10:00:00Z"),
  ];
  const [one, ...rest] = skillSuggestions("acme/shop", [], tasks, day);
  assert.equal(rest.length, 0, "a task asked once is not a pattern");
  assert.equal(one!.name, "add-a-migration");
  assert.equal(one!.path, ".aperture/skills/add-a-migration.md");
  assert.deepEqual(
    one!.tasks.map((t) => [t.task, t.url]),
    [
      ["Please add a migration for invoices", "https://github.com/acme/shop/pull/101"],
      ["Add a migration for orders", "https://github.com/acme/shop/pull/103"],
    ],
  );
  assert.equal(
    one!.text,
    [
      "---",
      "name: add-a-migration",
      "description: For tasks like: Please add a migration for invoices",
      "---",
      'Made on 2026-11-17 from 2 Aperture Bot tasks that did this: "Add a migration for orders" and "Please add a migration for invoices". Make the name, the description and the steps fit every task like it, not only those: the agent sees the description, and loads these steps when a task matches.',
      "",
      "1. Read the latest migration",
      "2. Write the next one",
      "3. Update the schema type",
      "",
      "Files those tasks changed, as examples:",
      "- `migrations/0003_orders.sql`",
      "- `migrations/0004_invoices.sql`",
      "- `src/db/schema.ts`",
      "",
    ].join("\n"),
  );
  // The bot reads it back as a skill, under the name written.
  assert.equal(parseSkill(one!.path, one!.text)!.name, "add-a-migration");
});

test("no suggestion once a skill does it: by its name, or followed by one of those tasks", () => {
  const twice = (extra: Partial<BotSummary> = {}) => [
    task("Add a migration for orders", "2026-11-02T10:00:00Z"),
    task("Add a migration for invoices", "2026-11-03T10:00:00Z", extra),
  ];
  assert.equal(skillSuggestions("acme/shop", [], twice(), day).length, 1);
  assert.equal(skillSuggestions("acme/shop", [skill("add-a-migration")], twice(), day).length, 0);
  const followed = twice({ skills: [".aperture/skills/db.md"] });
  assert.equal(skillSuggestions("acme/shop", [skill("db")], followed, day).length, 0);
});

test("only changes the bot finished count: not answers, reviews, failures or empty runs", () => {
  const first = task("Add a migration for orders", "2026-11-02T10:00:00Z");
  const skipped = [
    task("Add a migration for invoices", "2026-11-03T10:00:00Z", { kind: "review" }),
    task("Add a migration for users", "2026-11-04T10:00:00Z", { state: "error" }),
    task("Add a migration for carts", "2026-11-05T10:00:00Z", { state: "no-change", files: [] }),
    task("Add a migration for tags", "2026-11-06T10:00:00Z", { files: [], plan: [] }),
    { ...task("Add a migration for notes", "2026-11-07T10:00:00Z"), summary: null },
  ];
  assert.equal(skillSuggestions("acme/shop", [], [first, ...skipped], day).length, 0);
  // A red run still did the task: its plan is worth learning from.
  const red = task("Add a migration for refunds", "2026-11-08T10:00:00Z", { state: "red" });
  assert.equal(skillSuggestions("acme/shop", [], [first, red], day).length, 1);
});

test("the most asked for first, at most three, each from its five newest tasks", () => {
  const kinds = ["Add a migration", "Bump the version", "Write tests", "Translate the page"];
  const tasks = kinds.flatMap((kind, k) =>
    Array.from({ length: 2 + (k === 2 ? 5 : k === 1 ? 1 : 0) }, (_, i) =>
      task(`${kind} for the item ${i}`, `2026-11-${String(10 + i).padStart(2, "0")}T0${k}:00:00Z`),
    ),
  );
  const out = skillSuggestions("acme/shop", [], tasks, day);
  assert.deepEqual(
    out.map((s) => [s.name, s.tasks.length]),
    [
      ["write-tests", 7],
      ["bump-the-version", 3],
      ["translate-the-page", 2],
    ],
  );
  assert.match(
    out[0]!.text,
    /from 5 Aperture Bot tasks that did this: "Write tests for the item 2", "Write tests for the item 3", "Write tests for the item 4" and 2 more\./,
  );
  const oldest = tasks.filter((t) => /^Write tests for the item [01]$/.test(t.task));
  for (const t of oldest)
    assert.ok(
      !out[0]!.text.includes(t.summary!.files![0]!),
      "the two oldest are left out of the draft",
    );
});

test("a suggestion opens GitHub's new-file page with its path and text", () => {
  const [s] = skillSuggestions(
    "acme/shop",
    [],
    [
      task("Add a migration for orders", "2026-11-02T10:00:00Z"),
      task("Add a migration for invoices", "2026-11-03T10:00:00Z"),
    ],
    day,
  );
  const url = new URL(newSkillUrl(s!, "release/2.x"));
  assert.equal(url.origin + url.pathname, "https://github.com/acme/shop/new/release/2.x");
  assert.equal(url.searchParams.get("filename"), ".aperture/skills/add-a-migration.md");
  assert.equal(url.searchParams.get("value"), s!.text);
});
