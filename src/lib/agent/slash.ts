import { lineDiff } from "./apply-edit.ts";
import type { AgentMode } from "../workspace/types.ts";
import type { ProposedEdit } from "../workspace/types.ts";
import type { AgentPhase } from "./phase.ts";
import type { Skill } from "../workspace/skills.ts";

export const SLASH_COMMANDS = [
  { name: "review" as const, description: "Review staged diffs" },
  { name: "fix" as const, description: "Fix the selection or active file" },
  { name: "explain" as const, description: "Explain the selection or active file" },
];

export type SlashName = (typeof SLASH_COMMANDS)[number]["name"];

/** A built-in command, or one of the project's skills (`.aperture/skills/`): `/release` uses that skill. */
export type SlashHit =
  | { name: SlashName; description: string; skill?: undefined }
  | { name: string; description: string; skill: { path: string } };

export function activeSlash(text: string, caret: number): { query: string } | null {
  if (!text.startsWith("/")) return null;
  const lineEnd = text.indexOf("\n");
  if (lineEnd >= 0 && caret > lineEnd) return null;
  const head = text.slice(1, caret);
  if (head.includes(" ") || head.includes("\t")) return null;
  return { query: head };
}

/** The commands, then the project's skills, matching what was typed. A skill named as a command is left out: the command wins. */
export function filterSlash(query: string, skills: Skill[] = []): SlashHit[] {
  const q = query.trim().toLowerCase();
  const hit = (name: string, description: string) => !q || name.startsWith(q) || description.toLowerCase().includes(q);
  const commands: SlashHit[] = SLASH_COMMANDS.filter((c) => hit(c.name, c.description));
  const taken = new Set<string>(SLASH_COMMANDS.map((c) => c.name));
  const fromSkills: SlashHit[] = skills
    .filter((s) => !taken.has(s.name) && hit(s.name, s.description))
    .map((s) => ({ name: s.name, description: s.description || "A skill of this project", skill: { path: s.path } }));
  return [...commands, ...fromSkills];
}

/** `/release cut 0.13` when the project has a skill named `release`: the skill, and what else was asked. */
export function parseSkillSlash(text: string, skills: Skill[]): { skill: Skill; rest: string } | null {
  if (parseSlash(text)) return null;
  const match = /^\/([a-z0-9][a-z0-9-]*)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return null;
  const skill = skills.find((s) => s.name === match[1]!.toLowerCase());
  return skill ? { skill, rest: (match[2] ?? "").trim() } : null;
}

/** What the agent is asked when a skill is named: load it first, then follow it for the task. */
export function skillInstruction(skill: Pick<Skill, "name" | "checks">, rest: string): string {
  const checks = skill.checks?.length
    ? ` Its checks (${skill.checks.map((c) => `\`npm run ${c}\``).join(", ")}) must pass before you are done.`
    : "";
  return [
    `Use the project's skill "${skill.name}" for this task: call load_skill with the name "${skill.name}" first, then follow it.${checks}`,
    rest || "Do what the skill describes.",
  ].join("\n\n");
}

export function parseSlash(text: string): { name: SlashName; rest: string } | null {
  const match = /^\/(review|fix|explain)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return null;
  return { name: match[1]!.toLowerCase() as SlashName, rest: (match[2] ?? "").trim() };
}

export function compactDiff(oldText: string, newText: string, cap = 60): string {
  const out: string[] = [];
  let extra = 0;
  for (const row of lineDiff(oldText, newText)) {
    if (row.type === "eq") continue;
    if (out.length >= cap) {
      extra += 1;
      continue;
    }
    out.push(`${row.type === "add" ? "+" : "-"} ${row.text}`);
  }
  if (extra) out.push(`… ${extra} more`);
  return out.join("\n");
}

export function expandSlash(
  name: SlashName,
  rest: string,
  ctx: {
    activePath: string | null;
    selection: { path: string; text: string; fromLine: number; toLine: number; empty?: boolean } | null;
    pending: ProposedEdit[];
  },
): { instruction: string; mode: AgentMode; phase?: AgentPhase } {
  const target = ctx.selection && !ctx.selection.empty && ctx.selection.text.trim()
    ? `the selection in ${ctx.selection.path} L${ctx.selection.fromLine}-L${ctx.selection.toLine}`
    : ctx.activePath
      ? `the active file ${ctx.activePath}`
      : "the workspace";
  const note = rest ? `\n\n${rest}` : "";

  if (name === "review") {
    const hunks =
      ctx.pending.length === 0
        ? "No staged diffs. Review the auto-context files instead."
        : ctx.pending
            .map((edit) => `### ${edit.path}\n${compactDiff(edit.oldText, edit.newText) || "(empty)"}`)
            .join("\n\n");
    return {
      instruction: `Review the staged diffs. Flag bugs, missing error handling, and leftovers. Do not write files unless asked.${note}\n\n${hunks}`,
      mode: "chat",
    };
  }
  if (name === "fix") {
    return {
      instruction: `Fix ${target}. Keep unrelated code.${note}`,
      mode: "composer",
      phase: "skip",
    };
  }
  return {
    instruction: `Explain ${target}. Be concrete.${note}`,
    mode: "chat",
  };
}
