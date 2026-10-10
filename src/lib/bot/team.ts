/**
 * The person's team of Aperture Bots: named bots on the Bot page, each
 * looking after one repository, with its own mascot and its own way of
 * working (instructions the chat follows). The bot that runs on GitHub is
 * the same for all of them; a profile shapes the conversation about its
 * repository and how the bot looks. Pure, for tests.
 */
import { mascotFrom, type Mascot } from "./mascot.ts";

export type BotProfile = {
  id: string;
  name: string;
  /** owner/name */
  repo: string;
  mascot: Mascot;
  /** How it works, in the person's words; empty until they pick a focus. */
  personality: string;
  /** The model its chat runs on; empty: the account's choice in Settings. */
  model: BotModel;
  /** What it may send without asking: nothing, or checks on pull requests. */
  allow: BotAllow;
  /** The last line of its conversation, kept on the account, for the roster. */
  lastLine: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * What a bot's chat can run on: a provider key of the person's, their custom
 * endpoint, or "" for whatever Settings chooses. Never a model in the
 * browser: the chat runs on the server.
 */
export const BOT_MODELS = [
  "",
  "grok",
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "custom",
] as const;
export type BotModel = (typeof BOT_MODELS)[number];

/**
 * A bot's rule for its suggestions: `ask` first for everything, or always
 * allow a check on a pull request, which changes nothing. Work that changes
 * code always waits for a click.
 */
export const BOT_ALLOW = ["ask", "checks"] as const;
export type BotAllow = (typeof BOT_ALLOW)[number];

export const MAX_BOTS = 12;
export const NAME_MAX = 40;
export const PERSONALITY_MAX = 800;

/** A bot's id: what `newBotId` makes, and all the server accepts. */
export const BOT_ID = /^[a-z0-9]{12,32}$/;

/** owner/name, as GitHub allows them. */
export const REPO_FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

/** What a new bot asks first, and the instructions each answer gives it. */
export const FOCUSES = [
  {
    id: "ci",
    label: "Keep CI green",
    personality:
      "Watch the default branch's checks first. When something is red, find the cause in the code and propose the smallest fix. Never propose skipping or weakening a test.",
  },
  {
    id: "issues",
    label: "Work through issues",
    personality:
      "Go through the open issues, newest bug reports first. Propose one well-scoped task per issue, and say which ones need a person to decide first.",
  },
  {
    id: "docs",
    label: "Keep the docs current",
    personality:
      "Look after the README and the docs: broken links, out-of-date commands, missing setup steps. Propose small, precise documentation changes.",
  },
  {
    id: "all",
    label: "A bit of everything",
    personality:
      "Help with whatever the repository needs most right now: red checks first, then bugs, then everything else. Keep answers short.",
  },
] as const;

/** One line, control characters dropped, cut to `max`. */
export function cleanName(text: string, max = NAME_MAX): string {
  let out = "";
  for (const ch of text) out += (ch.codePointAt(0) ?? 0) <= 31 ? " " : ch;
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Line breaks kept, other control characters dropped, cut to `max`. */
export function cleanPersonality(text: string, max = PERSONALITY_MAX): string {
  let out = "";
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    const code = ch.codePointAt(0) ?? 0;
    out += code === 10 || code > 31 ? ch : " ";
  }
  return out
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const iso = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

/** A profile from a stored row; null when the row is not one. */
export function profileFrom(row: Record<string, unknown>): BotProfile | null {
  const id = typeof row.id === "string" ? row.id : "";
  const repo = typeof row.repo === "string" ? row.repo : "";
  const name = cleanName(typeof row.name === "string" ? row.name : "");
  if (!BOT_ID.test(id) || !REPO_FULL_NAME.test(repo) || !name) return null;
  let mascot: unknown = row.mascot;
  if (typeof mascot === "string") {
    try {
      mascot = JSON.parse(mascot);
    } catch {
      mascot = null;
    }
  }
  return {
    id,
    name,
    repo,
    mascot: mascotFrom(mascot),
    personality: cleanPersonality(typeof row.personality === "string" ? row.personality : ""),
    model: (BOT_MODELS as readonly unknown[]).includes(row.model) ? (row.model as BotModel) : "",
    allow: row.allow === "checks" ? "checks" : "ask",
    lastLine: cleanName(typeof row.last_line === "string" ? row.last_line : "", 160),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** The roster order: oldest first, so a bot keeps its place. */
export function rosterOrder(bots: BotProfile[]): BotProfile[] {
  return [...bots].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
