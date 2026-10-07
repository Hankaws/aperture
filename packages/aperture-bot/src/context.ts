/**
 * The thread the task came from, as the agent reads it: the issue or pull
 * request, its recent comments and, on a pull request, its diff. People wrote
 * all of it, so the run passes it as context, never as rules (see BOT_RULES).
 */
import type { Command } from "./event.ts";
import type { ThreadComment } from "./github.ts";

export const CONTEXT_LIMITS = { comments: 20, commentChars: 2_000, total: 12_000, diff: 20_000 };

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}\n… (cut at ${max} characters)`;

export function threadContext(
  command: Command,
  comments: ThreadComment[],
  diff: string | null,
): string {
  const kind = command.isPull ? "Pull request" : "Issue";
  const parts = [`${kind} #${command.number}: ${command.title}`, clip(command.body.trim(), 4_000)];
  const shown = comments
    // The bot's own replies and the asking comment itself add nothing.
    .filter((c) => c.authorType !== "Bot" && c.id !== command.commentId)
    .slice(-CONTEXT_LIMITS.comments);
  if (shown.length > 0) {
    parts.push("Comments, oldest first:");
    for (const c of shown)
      parts.push(`@${c.author}: ${clip(c.body.trim(), CONTEXT_LIMITS.commentChars)}`);
  }
  let text = clip(parts.filter(Boolean).join("\n\n"), CONTEXT_LIMITS.total);
  if (diff) text += `\n\nThe pull request's diff:\n${clip(diff, CONTEXT_LIMITS.diff)}`;
  return text;
}
