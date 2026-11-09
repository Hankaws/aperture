/**
 * A skill's checks: package.json scripts its front matter names
 * (`checks: test, migrate:check`) that must pass before a task the skill was
 * loaded for is done. The loop runs them on the agent's edits next to the
 * project's own check (`sandbox/auto-verify.ts`), under the same bound: one
 * try to fix a failure, and one re-run. A check that still fails is said
 * plainly at the end of the reply, so no answer reads as done when a skill
 * says it is not. Pure, for tests.
 */
import type { Skill } from "../workspace/skills.ts";

export type SkillCheck = { script: string; skill: string };
export type SkillCheckResult = SkillCheck & {
  status: "passed" | "failed" | "not_run";
  /** One line: what failed, or why it did not run. */
  detail: string;
};

/**
 * The checks of the skills loaded this turn, in the order they were loaded,
 * each script once. `skip` is the script the project's own check already
 * runs. A script package.json does not have (or may not run) cannot pass, so
 * it comes back in `missing`, to be said rather than quietly dropped.
 */
export function skillChecksFor(
  skills: Skill[],
  loaded: string[],
  runnable: string[],
  skip: string | null,
): { run: SkillCheck[]; missing: SkillCheck[] } {
  const run: SkillCheck[] = [];
  const missing: SkillCheck[] = [];
  const seen = new Set<string>(skip ? [skip] : []);
  for (const path of loaded) {
    const skill = skills.find((s) => s.path === path);
    for (const script of skill?.checks ?? []) {
      if (seen.has(script)) continue;
      seen.add(script);
      (runnable.includes(script) ? run : missing).push({ script, skill: skill!.name });
    }
  }
  return { run, missing };
}

/**
 * The skills the turns that staged these edits loaded, by path: a follow-up
 * on the same change (a fix, notes, the editor's one look) is held to their
 * checks too, though it does not load them again.
 */
export function skillsForEdits(
  messages: Array<{ edits?: Array<{ id: string }>; skills?: string[] }>,
  editIds: string[],
): string[] {
  const wanted = new Set(editIds);
  const out: string[] = [];
  for (const message of messages) {
    if (!message.edits?.some((edit) => wanted.has(edit.id))) continue;
    for (const path of message.skills ?? []) if (!out.includes(path)) out.push(path);
  }
  return out;
}

/** The skills the plan a Build it builds was made with: the latest reply with a plan. */
export function skillsOfPlan(
  messages: Array<{ role: string; plan?: unknown[]; skills?: string[] }>,
): string[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role === "assistant" && (message.plan?.length ?? 0) > 0)
      return [...(message.skills ?? [])];
  }
  return [];
}

/** What a follow-up turn is told of the skills its change was made under. Empty when there are none. */
export function carriedSkillsLine(skills: Skill[], loaded: string[]): string {
  const carried = loaded
    .map((path) => skills.find((skill) => skill.path === path))
    .filter((skill): skill is Skill => Boolean(skill));
  if (carried.length === 0) return "";
  const checks = carried.flatMap((skill) => (skill.checks ?? []).map((c) => `\`npm run ${c}\``));
  return [
    `This change was made following the ${carried.length === 1 ? "skill" : "skills"} ${carried.map((s) => s.name).join(", ")}: keep following ${carried.length === 1 ? "it" : "them"} (load_skill reads the steps again).`,
    checks.length > 0
      ? `${checks.join(", ")} must still pass before you are done; they run on your edits when you finish.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** First line that says why, clipped. */
function firstLine(text: string, max = 160): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const reason =
    lines
      .slice(1)
      .find((l) => /(error|assert|expected|exception|cannot|not found)|\bfail/i.test(l)) ??
    lines[0] ??
    "";
  return reason.length > max ? `${reason.slice(0, max - 1)}…` : reason;
}

/** A finished run of one check. `ran` false: the script never executed, which is not a failure of the edits. */
export function skillCheckResult(
  check: SkillCheck,
  run: { text: string; passed: boolean; ran: boolean },
): SkillCheckResult {
  if (!run.ran)
    return { ...check, status: "not_run", detail: firstLine(run.text) || "It could not run." };
  if (run.passed) return { ...check, status: "passed", detail: `npm run ${check.script} passed.` };
  return { ...check, status: "failed", detail: firstLine(run.text) || "It failed." };
}

/** A check package.json does not have. */
export function missingResult(check: SkillCheck): SkillCheckResult {
  return {
    ...check,
    status: "not_run",
    detail: `package.json has no "${check.script}" script the sandbox may run.`,
  };
}

/** What the agent is told when a skill's check fails: the fix is this turn's task, once. */
export function skillFixPrompt(check: SkillCheck, output: string): string {
  return [
    `Skill ${check.skill} says \`npm run ${check.script}\` must pass before you are done, and it fails against your edits:`,
    "",
    output,
    "",
    "Fix this now with propose_edit, as the skill says. Change only what the failure requires. If the failure is not caused by your edits, say so plainly instead of editing.",
  ].join("\n");
}

/** The lines at the end of the reply: one per check, failures first. */
export function skillCheckLines(results: SkillCheckResult[]): string[] {
  const order = { failed: 0, not_run: 1, passed: 2 } as const;
  return [...results]
    .sort((a, b) => order[a.status] - order[b.status])
    .map((r) =>
      r.status === "passed"
        ? `Skill ${r.skill}: \`npm run ${r.script}\` passed.`
        : r.status === "failed"
          ? `Not done: skill ${r.skill} needs \`npm run ${r.script}\` to pass, and it fails against these edits (${r.detail})`
          : `Not checked: skill ${r.skill} needs \`npm run ${r.script}\`, which did not run (${r.detail})`,
    );
}
