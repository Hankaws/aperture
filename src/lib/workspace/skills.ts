/**
 * Skills: a project's know-how for one kind of task, in `.aperture/skills/`,
 * loaded only when a task needs it. After DeepSeek Harness's skill family,
 * and in the layout other agents use (`<name>.md`, or `<name>/SKILL.md`).
 *
 *   ---
 *   name: release
 *   description: Cut a release: changelog, version, notes.
 *   ---
 *   1. Move Unreleased under a dated heading …
 *
 * The agent is told each skill's name and description, and calls
 * `load_skill` for the one a task needs: the steps reach it then, not on
 * every turn as rules do (`scoped-rules.ts`). They are the project's own
 * instructions, written by whoever can edit it. Pure, for tests.
 */

export const SKILLS_DIR = ".aperture/skills/";

/** A skill's steps at most, the skills listed, and a description's length. */
export const SKILL_LIMIT = { chars: 12_000, skills: 30, description: 160 } as const;

export const SKILL_TEMPLATE = `---
name: release
description: Cut a release - changelog, version bump and release notes.
---
1. Move everything under "## Unreleased" in CHANGELOG.md under "## X.Y.Z - <today>".
2. Bump the version in package.json.
3. Run the tests, then write the release notes from the new changelog section.
`;

/** A new skill's file: the release example first, then a blank one named for its file, so no two share a name. */
export function skillTemplate(name: string): string {
  if (name === "release") return SKILL_TEMPLATE;
  return `---
name: ${name}
description: What this skill is for, in one line. The agent sees only this until it loads the skill.
---
1. The first step.
2. The next one.
`;
}

export type Skill = { name: string; path: string; description: string; text: string };

/** `.aperture/skills/<name>.md`, or `.aperture/skills/<name>/SKILL.md`. */
export function isSkillPath(path: string): boolean {
  if (!path.startsWith(SKILLS_DIR)) return false;
  const rest = path.slice(SKILLS_DIR.length);
  return /^[^/]+\.md$/i.test(rest) || /^[^/]+\/SKILL\.md$/i.test(rest);
}

/** A name as the agent calls it: lowercase words joined by hyphens. */
export function skillName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const unquote = (value: string) =>
  value
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();

/** Front matter (name, description), then the steps. A file with no steps is not a skill. */
export function parseSkill(path: string, raw: string): Skill | null {
  const text = raw.replace(/\r\n/g, "\n");
  const front = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  const body = (front ? text.slice(front[0].length) : text).trim();
  if (!body) return null;
  let name = "";
  let description = "";
  for (const line of front?.[1]?.split("\n") ?? []) {
    const match = /^([A-Za-z]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    if (match[1]!.toLowerCase() === "name") name = unquote(match[2]!);
    if (match[1]!.toLowerCase() === "description") description = unquote(match[2]!);
  }
  const rest = path.slice(SKILLS_DIR.length);
  const fromPath = rest.includes("/") ? rest.split("/")[0]! : rest;
  name = skillName(name || fromPath);
  if (!name) return null;
  // No description: the first line of the steps that is not a heading.
  if (!description)
    description =
      body
        .split("\n")
        .find((line) => line.trim() && !line.startsWith("#"))
        ?.trim() ?? "";
  description = description.replace(/\s+/g, " ").trim();
  if (description.length > SKILL_LIMIT.description)
    description = `${description.slice(0, SKILL_LIMIT.description - 1)}…`;
  return {
    name,
    path,
    description,
    text:
      body.length > SKILL_LIMIT.chars
        ? `${body.slice(0, SKILL_LIMIT.chars)}\n… (skill cut at ${SKILL_LIMIT.chars} characters)`
        : body,
  };
}

/** The project's skills, by path; a name used twice keeps its first. */
export function projectSkills(files: Record<string, string>): Skill[] {
  const out: Skill[] = [];
  const seen = new Set<string>();
  for (const path of Object.keys(files).filter(isSkillPath).sort()) {
    const skill = parseSkill(path, files[path] ?? "");
    if (!skill || seen.has(skill.name)) continue;
    seen.add(skill.name);
    out.push(skill);
    if (out.length === SKILL_LIMIT.skills) break;
  }
  return out;
}

/** What the agent is told of them each turn: names and what each is for, not the steps. */
export function skillsIndex(skills: Skill[]): string {
  if (skills.length === 0) return "";
  return [
    "Skills in this project. When the task is one a skill is for, call load_skill with its name before you start, then follow it:",
    ...skills.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`),
  ].join("\n");
}

/** The skill a name means, forgiving case and spacing. */
export function findSkill(skills: Skill[], name: string): Skill | null {
  const wanted = skillName(name);
  return skills.find((s) => s.name === wanted) ?? null;
}

/** The answer to load_skill. */
export function loadSkill(
  skills: Skill[],
  name: string,
): { skill: Skill; text: string } | { error: string } {
  if (skills.length === 0) return { error: `This project has no skills (${SKILLS_DIR}).` };
  const skill = findSkill(skills, name);
  if (!skill)
    return {
      error: `No skill named "${name}". The skills are: ${skills.map((s) => s.name).join(", ")}.`,
    };
  return {
    skill,
    text: `Skill ${skill.name}, from ${skill.path}. Follow it for this task:\n<skill>\n${skill.text}\n</skill>`,
  };
}
