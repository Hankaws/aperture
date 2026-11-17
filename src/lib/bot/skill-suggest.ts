/**
 * Skills the Bot page suggests: when a repository's bot was asked for the same
 * kind of task more than once ("Add a migration for orders", then "… for
 * invoices"), and no skill does it yet, the Skills card offers one, drafted
 * from those tasks as the editor drafts one from its runs (`skill-draft.ts`).
 * The person adds it to the repository on GitHub, and the bot then follows it.
 * Pure, for tests.
 */
import { draftSkill, nameFromRequest } from "../workspace/skill-draft.ts";
import type { Skill } from "../workspace/skills.ts";
import type { BotTask } from "./tasks.ts";

export type SkillSuggestion = {
  repo: string;
  /** The skill's name, and where its file goes. */
  name: string;
  path: string;
  /** The draft, front matter and steps, ready to save as is. */
  text: string;
  /** The tasks it is made from, newest first. */
  tasks: Array<{ task: string; url: string; at: string }>;
};

/** Tasks of one kind it takes before a skill is suggested, as in the editor. */
export const SUGGEST_AFTER = 2;
/** Suggestions a repository shows at most: the most asked for first. */
const MAX_SUGGESTIONS = 3;
/** Tasks of one kind a draft is made from at most: the newest. */
const MAX_SOURCES = 5;

/** A task worth a skill: a change the bot finished, with a plan or files to learn from. */
function useful(task: BotTask): boolean {
  const s = task.summary;
  if (!s || s.kind || !task.task.trim()) return false;
  if (s.state !== "clear" && s.state !== "red") return false;
  return (s.plan?.length ?? 0) > 0 || (s.files?.length ?? 0) > 0;
}

export function skillSuggestions(
  repo: string,
  skills: Skill[],
  tasks: BotTask[],
  now: Date = new Date(),
): SkillSuggestion[] {
  const taken = {
    names: new Set(skills.map((s) => s.name)),
    paths: new Set(skills.map((s) => s.path)),
  };
  const groups = new Map<string, BotTask[]>();
  for (const task of tasks) {
    if (!useful(task)) continue;
    const name = nameFromRequest(task.task);
    if (name === "skill") continue;
    groups.set(name, [...(groups.get(name) ?? []), task]);
  }
  const out: Array<SkillSuggestion & { newest: string }> = [];
  for (const [name, group] of groups) {
    if (group.length < SUGGEST_AFTER || taken.names.has(name)) continue;
    // A task of this kind already followed a skill: one covers it, under another name.
    if (group.some((t) => (t.summary?.skills?.length ?? 0) > 0)) continue;
    const newestFirst = [...group].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const sources = newestFirst.slice(0, MAX_SOURCES).reverse();
    const draft = draftSkill(
      sources.map((t) => ({
        request: t.task,
        plan: t.summary?.plan ?? [],
        paths: t.summary?.files ?? [],
        checks: [],
      })),
      taken,
      now,
      "Aperture Bot task",
    );
    if (!draft) continue;
    out.push({
      repo,
      ...draft,
      tasks: newestFirst.map((t) => ({
        task: t.task,
        url: t.summary?.link?.url ?? t.replyUrl ?? t.askedUrl,
        at: t.updatedAt,
      })),
      newest: newestFirst[0]!.updatedAt,
    });
  }
  return out
    .sort((a, b) => b.tasks.length - a.tasks.length || b.newest.localeCompare(a.newest))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ newest: _, ...s }) => s);
}

/**
 * GitHub's page for a new file on the default branch, with the skill's path
 * and text filled in: the person reads it, and commits it or opens a pull
 * request from there.
 */
export function newSkillUrl(suggestion: SkillSuggestion, branch: string): string {
  const [owner = "", name = ""] = suggestion.repo.split("/");
  const params = new URLSearchParams({ filename: suggestion.path, value: suggestion.text });
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/new/${branch.split("/").map(encodeURIComponent).join("/")}?${params}`;
}
