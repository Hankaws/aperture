/**
 * Save a thread as a skill: a finished run, turned into a draft in
 * `.aperture/skills/` that the person edits and the agent then loads when a
 * task matches (`skills.ts`), in the editor and in Aperture Bot.
 *
 * The draft is written from what the run did, with no model call: the request
 * as what the skill is for, the run's plan as its steps, the checks it ran as
 * the skill's `checks`, and the files it changed as examples. It is a start: the
 * person makes the steps fit every task like this one, not only that one.
 * Pure, for tests.
 */
import { groupRuns } from "./board.ts";
import { SKILLS_DIR, SKILL_LIMIT, projectSkills, skillName } from "./skills.ts";
import type { ChatMessage } from "./types";

export type SkillDraft = { path: string; name: string; text: string };

/** Steps and example files a draft lists at most. */
const MAX_STEPS = 12;
const MAX_FILES = 8;
/** Words of the request a skill is named for. */
const NAME_WORDS = 4;
const NAME_CHARS = 40;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** Words a request starts with that say nothing about the task. */
const FILLER = /^(please|can|could|would|you|pls|kindly|now|then|and|so|let's|lets)$/i;

/** Words a name does not end on. */
const TRAILING = /^(a|an|the|in|on|of|for|to|at|by|with|from|and|or|into|so|that)$/i;

/** A name from the request's first words: "Please add a migration for orders" → `add-a-migration`. */
export function nameFromRequest(request: string): string {
  const words = oneLine(request.split("\n")[0] ?? "")
    .split(" ")
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter(Boolean);
  while (words.length > 1 && FILLER.test(words[0]!)) words.shift();
  const kept = words.slice(0, NAME_WORDS);
  // "Fix the off-by-one in listTasks" is `fix-the-off-by-one`, not `…-in`.
  while (kept.length > 1 && TRAILING.test(kept[kept.length - 1]!)) kept.pop();
  const name = skillName(kept.join(" ")).slice(0, NAME_CHARS).replace(/-+$/, "");
  return name || "skill";
}

/** The run a reply belongs to, with the person's request that started it. */
function runOf(messages: ChatMessage[], replyId: string) {
  const run = groupRuns(messages).find((row) => row.messages.some((m) => m.id === replyId));
  if (!run) return null;
  const request = run.messages.find((m) => m.role === "user" && !m.automatic)?.content.trim();
  return request ? { messages: run.messages, request } : null;
}

/** The request that started the run a reply is in. */
export function requestOf(messages: ChatMessage[], replyId: string): string | null {
  return runOf(messages, replyId)?.request ?? null;
}

/** True for the last reply of its run: where "Save as skill" is offered, once per run. */
export function isLastReplyOfRun(messages: ChatMessage[], replyId: string): boolean {
  const run = groupRuns(messages).find((row) => row.messages.some((m) => m.id === replyId));
  return run?.messages.filter((m) => m.role === "assistant").at(-1)?.id === replyId;
}

/** What a run gives a skill: its request, plan, the files it kept changes to, and the checks it was held to. */
function factsOf(messages: ChatMessage[], replyId: string) {
  const run = runOf(messages, replyId);
  if (!run) return null;
  const replies = run.messages.filter((m) => m.role === "assistant");
  const latest = <T>(pick: (m: ChatMessage) => T | null | undefined): T | null => {
    for (let i = replies.length - 1; i >= 0; i -= 1) {
      const value = pick(replies[i]!);
      if (value) return value;
    }
    return null;
  };
  const plan = latest((m) => (m.plan?.length ? m.plan : null)) ?? [];
  const changed = new Map<string, boolean>();
  for (const reply of replies)
    for (const edit of reply.edits ?? []) changed.set(edit.path, edit.status !== "rejected");
  const paths = [...changed].filter(([, kept]) => kept).map(([path]) => path);
  // The checks the run was held to: the project's own, and those of skills it followed. They become the skill's.
  const verify = latest((m) => m.verify);
  const checks = [verify?.script, ...(verify?.skills ?? []).map((c) => c.script)].filter(
    (c): c is string => Boolean(c),
  );
  const followed = replies.some((m) => (m.skills?.length ?? 0) > 0);
  const lastReply = replies.at(-1)?.id ?? replyId;
  return {
    request: run.request,
    plan,
    paths,
    checks,
    followed,
    lastReply,
    first: run.messages[0]!.id,
  };
}

type Facts = NonNullable<ReturnType<typeof factsOf>>;

/** A run worth a skill: it planned something, or kept a change. */
const useful = (facts: Facts | null): facts is Facts =>
  Boolean(facts && (facts.plan.length > 0 || facts.paths.length > 0));

/**
 * The earlier run this one repeats, by its last reply, when a skill would save
 * doing it again: both asked for the same kind of task ("Add a migration for
 * orders", then "… for invoices": the same name from their first words), both
 * did something, this one followed no skill, and no skill has that name yet.
 * A string, so a store selector can return it as is.
 */
export function repeatOf(
  messages: ChatMessage[],
  replyId: string,
  files: Record<string, string>,
): string | null {
  const now = factsOf(messages, replyId);
  if (!useful(now) || now.followed) return null;
  const name = nameFromRequest(now.request);
  if (name === "skill" || projectSkills(files).some((skill) => skill.name === name)) return null;
  let found: string | null = null;
  for (const run of groupRuns(messages)) {
    if (run.messages.some((m) => m.id === now.first)) break;
    const reply = run.messages.filter((m) => m.role === "assistant").at(-1);
    if (!reply) continue;
    const earlier = factsOf(messages, reply.id);
    if (useful(earlier) && nameFromRequest(earlier.request) === name) found = earlier.lastReply;
  }
  return found;
}

/**
 * The draft for the run `replyId` is in, or null when there is nothing to learn
 * from it: no request, or no plan and no file it changed. `files` are the
 * project's, so the name is not one a skill already has. With `alsoFrom`, the
 * last reply of an earlier run of the same kind (`repeatOf`), the draft is
 * made from both: their files and checks together, both requests as examples,
 * and the newer plan, which is usually the better one.
 */
export function skillFromRun(
  messages: ChatMessage[],
  replyId: string,
  files: Record<string, string>,
  now: Date = new Date(),
  alsoFrom?: string,
): SkillDraft | null {
  const latestRun = factsOf(messages, replyId);
  if (!useful(latestRun)) return null;
  const earlier = alsoFrom ? factsOf(messages, alsoFrom) : null;
  const runs =
    useful(earlier) && earlier.first !== latestRun.first ? [earlier, latestRun] : [latestRun];
  const plan = latestRun.plan.length > 0 ? latestRun.plan : (runs[0]!.plan ?? []);
  const paths = [...new Set(runs.flatMap((r) => r.paths))];
  const checks = [...new Set(runs.flatMap((r) => r.checks))].slice(0, SKILL_LIMIT.checks);

  const steps = (
    plan.length > 0
      ? plan.map((entry) => oneLine(entry.content)).filter(Boolean)
      : paths.map((path) => `Change \`${path}\`.`)
  ).slice(0, MAX_STEPS);

  const taken = new Set(projectSkills(files).map((skill) => skill.name));
  const base = nameFromRequest(latestRun.request);
  let name = base;
  let path = `${SKILLS_DIR}${name}.md`;
  for (let n = 2; taken.has(name) || files[path] !== undefined; n += 1) {
    name = `${base}-${n}`;
    path = `${SKILLS_DIR}${name}.md`;
  }

  const firstLine = (text: string) => oneLine(text.split("\n")[0] ?? "");
  const request = firstLine(latestRun.request);
  const room = SKILL_LIMIT.description - "For tasks like: ".length;
  const like = request.length > room ? `${request.slice(0, room - 1)}…` : request;
  const day = now.toISOString().slice(0, 10);
  const quoted = (text: string) => {
    const line = firstLine(text);
    return `"${line.length > 80 ? `${line.slice(0, 79)}…` : line}"`;
  };
  const from =
    runs.length > 1
      ? `Made on ${day} from ${runs.length} agent runs that did this: ${runs.map((r) => quoted(r.request)).join(" and ")}.`
      : `Made on ${day} from an agent run that did this.`;
  const text = [
    "---",
    `name: ${name}`,
    `description: For tasks like: ${like}`,
    ...(checks.length > 0 ? [`checks: ${checks.join(", ")}`] : []),
    "---",
    `${from} Make the name, the description and the steps fit every task like it, not only that one: the agent sees the description, and loads these steps when a task matches.`,
    "",
    ...steps.map((step, i) => `${i + 1}. ${step}`),
    ...(paths.length > 0
      ? [
          "",
          `Files ${runs.length > 1 ? "those runs" : "that run"} changed, as examples:`,
          ...paths.slice(0, MAX_FILES).map((p) => `- \`${p}\``),
          ...(paths.length > MAX_FILES ? [`- and ${paths.length - MAX_FILES} more`] : []),
        ]
      : []),
    "",
  ].join("\n");
  return { path, name, text };
}
