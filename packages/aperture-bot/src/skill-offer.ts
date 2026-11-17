/**
 * The bot offers a skill in its own reply. When a change it just finished
 * repeats a kind of task it did lately ("Add a migration for orders", then
 * "… for invoices") and no skill covers it, the reply's suggestions end with
 * one more box: save tasks like this as a skill. Ticked, the bot rebuilds the
 * draft from those tasks (`skill-suggest.ts`, as the Bot page does) and the
 * run saves it, fitted to every task of that kind, through the usual checks
 * and pull request. Pure but for `localSkills`, for tests.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SAVE_SKILL,
  skillNameOf,
  skillSuggestions,
  type SkillSuggestion,
} from "../../../src/lib/bot/skill-suggest.ts";
import type { BotTask } from "../../../src/lib/bot/tasks.ts";
import {
  isSkillPath,
  projectSkills,
  SKILLS_DIR,
  type Skill,
} from "../../../src/lib/workspace/skills.ts";

/** How far back the bot looks for tasks of the same kind. */
export const OFFER_DAYS = 30;

/** The change the bot just finished, as the earlier tasks are read. */
export type Finished = {
  task: string;
  plan: string[];
  files: string[];
  /** The skills the run followed: one already covers this kind of task. */
  followed: string[];
  /** Where it went (the pull request or commit): its place among the tasks. */
  url: string;
  at: string;
};

/** The project's skills, from the checkout: the names and files a draft must not take. */
export function localSkills(cwd: string): Skill[] {
  const dir = join(cwd, SKILLS_DIR);
  if (!existsSync(dir)) return [];
  const files: Record<string, string> = {};
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = entry.isDirectory()
        ? `${SKILLS_DIR}${entry.name}/SKILL.md`
        : `${SKILLS_DIR}${entry.name}`;
      if (!isSkillPath(path) || !existsSync(join(cwd, path))) continue;
      files[path] = readFileSync(join(cwd, path), "utf8");
    }
  } catch {
    // Unreadable: no skills, so at worst a draft is offered that the run will find taken.
  }
  return projectSkills(files);
}

/**
 * The skill to offer after `done`, or null: when it repeats a kind of task in
 * `earlier` (the repository's recent tasks), followed no skill, and no skill
 * has that name. A run that saved a skill is never a kind of task to save.
 */
export function skillOffer(
  repo: string,
  done: Finished,
  earlier: BotTask[],
  skills: Skill[],
  now: Date = new Date(),
): SkillSuggestion | null {
  if (SAVE_SKILL.test(done.task.trim()) || !done.url) return null;
  const current: BotTask = {
    id: -1,
    via: "comment",
    number: 0,
    thread: null,
    task: done.task,
    author: "",
    askedAt: done.at,
    askedUrl: done.url,
    state: "clear",
    summary: {
      v: 1,
      state: "clear",
      asked: 0,
      run: "",
      plan: done.plan,
      files: done.files,
      ...(done.followed.length ? { skills: done.followed } : {}),
    },
    replyUrl: null,
    updatedAt: done.at,
    diff: null,
  };
  // The same change read back from GitHub (a pushed commit's earlier reply) is not a second task.
  const others = earlier.filter(
    (t) => (t.summary?.link?.url ?? t.replyUrl ?? t.askedUrl) !== done.url,
  );
  return (
    skillSuggestions(repo, skills, [current, ...others], now, Infinity).find((s) =>
      s.tasks.some((t) => t.url === done.url),
    ) ?? null
  );
}

/**
 * The draft for a skill a reply offered, rebuilt from the recent tasks when
 * its box is ticked: null when they no longer make one (a skill took the
 * name, or they are older than the bot looks back).
 */
export function draftFor(
  repo: string,
  path: string,
  earlier: BotTask[],
  skills: Skill[],
  now: Date = new Date(),
): SkillSuggestion | null {
  return (
    skillSuggestions(repo, skills, earlier, now, Infinity).find((s) => s.path === path) ?? null
  );
}

/**
 * The run a ticked "save as skill" box starts: the instruction, and the draft
 * when the tasks it came from can still be read. Without one (they are older
 * than the bot looks back), the agent writes the skill from the repository.
 */
export function saveSkillTask(path: string, draft: SkillSuggestion | null): string {
  const name = skillNameOf(path);
  const from = draft?.tasks.length
    ? ` It was drafted from ${draft.tasks.length} recent tasks of this kind: ${draft.tasks
        .slice(0, 5)
        .map((t) => `"${t.task.split("\n")[0]!.slice(0, 120)}"`)
        .join(", ")}.`
    : "";
  return [
    `Save tasks like this as a skill: \`${path}\`.`,
    "",
    `Write the skill \`${path}\`, named \`${name}\`, so that from now on tasks of this kind are done the same way.${from}`,
    "Keep its front matter: `name`, then a `description` that says which tasks it is for, in the words such a task would use, and `checks` when the steps need a script to pass. Then fit it to every task of this kind, not only those: steps that hold for any of them, read from this repository's code and from the files listed as examples. Drop the line saying where the draft came from.",
    `If \`${path}\` already exists, or another skill already covers these tasks, change nothing and say so. Change no other file.`,
    ...(draft ? ["", "The draft:", "", "```markdown", draft.text.trimEnd(), "```"] : []),
  ].join("\n");
}
