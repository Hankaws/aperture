/**
 * The Bot page's Skills card: a repository's skills (`.aperture/skills/`, read
 * on GitHub) and how its bot used them, read from the hidden summary of each
 * reply (`summary.ts`): which runs followed each skill, and how the checks it
 * names went. A skill nobody uses, or whose check keeps failing, stands out.
 * Pure, for tests.
 */
import type { Skill } from "../workspace/skills.ts";
import type { BotTask } from "./tasks.ts";

export type SkillCheckUse = { script: string; passed: number; failed: number; notRun: number };

export type SkillUse = {
  repo: string;
  name: string;
  path: string;
  description: string;
  /** The scripts the skill says must pass. */
  checks: string[];
  /** The skill's file on GitHub. */
  url: string;
  /** Runs, among those read, that followed it. */
  runs: number;
  lastAt: string | null;
  /** The bot's reply, or its pull request, for the latest of them. */
  lastUrl: string | null;
  /** Each check it names, and how it went in those runs. */
  checkRuns: SkillCheckUse[];
};

/** The order of the card: used most first, then by name; never used last. */
function byUse(a: SkillUse, b: SkillUse): number {
  return b.runs - a.runs || a.name.localeCompare(b.name);
}

export function skillUsage(
  repo: string,
  skills: Array<Skill & { url: string }>,
  tasks: BotTask[],
): SkillUse[] {
  const newestFirst = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return skills
    .map((skill) => {
      const used = newestFirst.filter((task) => task.summary?.skills?.includes(skill.path));
      const latest = used[0];
      const checkRuns = (skill.checks ?? []).map((script) => {
        const runs = { script, passed: 0, failed: 0, notRun: 0 };
        for (const task of used) {
          const ran = task.summary?.skillChecks?.find(
            (c) => c.skill === skill.name && c.script === script,
          );
          if (ran?.status === "passed") runs.passed += 1;
          else if (ran?.status === "failed") runs.failed += 1;
          else if (ran?.status === "not_run") runs.notRun += 1;
        }
        return runs;
      });
      return {
        repo,
        name: skill.name,
        path: skill.path,
        description: skill.description,
        checks: skill.checks ?? [],
        url: skill.url,
        runs: used.length,
        lastAt: latest?.updatedAt ?? null,
        lastUrl: latest ? (latest.summary?.link?.url ?? latest.replyUrl ?? latest.askedUrl) : null,
        checkRuns,
      };
    })
    .sort(byUse);
}

/** One line on how a skill's checks went: failures first, as they need you. */
export function checksLine(use: SkillUse): string {
  if (use.checks.length === 0) return "";
  const ran = use.checkRuns.filter((c) => c.passed + c.failed > 0);
  if (ran.length === 0) return `Checks: ${use.checks.join(", ")}. Not run yet.`;
  const failing = use.checkRuns.filter((c) => c.failed > 0);
  if (failing.length > 0)
    return failing
      .map((c) => `${c.script} failed in ${c.failed} of ${c.passed + c.failed} runs`)
      .join(" · ");
  const notYet = use.checks.length - ran.length;
  return `Checks passed: ${ran.map((c) => c.script).join(", ")}.${notYet > 0 ? ` ${notYet} not run yet.` : ""}`;
}
