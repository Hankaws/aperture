/**
 * Runtime shapes for every server function's input.
 *
 * A server function is a public endpoint: its TypeScript type says what the
 * editor sends, not what arrives. These schemas reject anything else before a
 * handler runs. Handlers still apply their own rules (allowed hosts, sizes,
 * what a token looks like); a schema only guarantees the types those rules
 * assume. Nested agent structures the loop normalises itself are checked as
 * the right kind of container, not re-described field by field.
 */
import { z } from "zod";
import type { BrowserRuns } from "../agent/browser-handoff.ts";
import { MASCOT_BODIES, MASCOT_COLORS, MASCOT_FACES, type MascotColor } from "../bot/mascot.ts";
import { BOT_ALLOW, BOT_ID, BOT_MODELS, REPO_FULL_NAME } from "../bot/team.ts";
import { CHAT_ID } from "../bot/my-bot.ts";
import type { WorkerSpec } from "../agent/crew.ts";
import type { AgentInput } from "../agent/types.ts";
import type { GithubChange } from "../github/roundtrip.ts";
import type { GithubReviewComment } from "../github/review.ts";
import type { Spot } from "../workspace/lessons.ts";
import type { PlanEntry, ProposedEdit } from "../workspace/types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A list of objects the handler normalises itself. */
function objects<T>() {
  return z.custom<T[]>((value) => Array.isArray(value) && value.every(isRecord), "Expected a list of objects.");
}

/** An object the handler normalises itself. */
function object<T>() {
  return z.custom<T>(isRecord, "Expected an object.");
}

const text = (max: number) => z.string().max(max);
const strings = (max: number) => z.array(z.string()).max(max);

export const PROVIDERS = ["grok", "openai", "anthropic", "gemini", "deepseek"] as const;

export const idInput = text(200).min(1);
export const planInput = z.enum(["hobby", "pro", "team"]);
export const checkoutInput = z.object({ plan: z.enum(["pro", "team"]), period: z.enum(["monthly", "yearly"]) });
export const providerInput = z.enum(PROVIDERS);
export const modelSourceInput = z.enum(["hosted", "custom", "local", ...PROVIDERS]);

export const providerKeyInput = z.object({ provider: providerInput, key: text(1000) });
/** A saved key, or the custom endpoint, to test with one tiny request (`billing/model-test.ts`). */
export const modelTestInput = z.object({ source: z.enum(["custom", ...PROVIDERS]) });
export const customEndpointInput = z.object({
  base: text(500),
  model: text(200),
  key: text(1000).optional(),
  clearKey: z.boolean().optional(),
});
export const sessionCapInput = z.object({
  on: z.boolean(),
  turns: z.number().finite(),
  cents: z.number().finite(),
});

const githubToken = text(255).optional();
const repoName = text(100);

export const githubImportInput = z.object({ url: text(500), token: githubToken });
export const githubListInput = z.object({ token: githubToken });
export const githubSaveTokenInput = z.object({ token: text(255) });
export const githubPublishInput = z.object({
  token: githubToken,
  owner: repoName,
  repo: repoName,
  branch: text(255),
  baseSha: text(64),
  mode: z.enum(["commit", "pr"]),
  message: text(2000),
  /** The new pull request's description: the review receipt (workspace/receipt.ts), when it was ticked. */
  body: text(20000).optional(),
  changes: z
    .array(
      z.union([
        z.object({ path: text(1000), content: z.string() }),
        z.object({ path: text(1000), deleted: z.literal(true) }),
      ]),
    )
    .max(5000)
    .transform((rows) => rows as GithubChange[]),
});
export const githubReviewInput = z.object({
  token: githubToken,
  owner: repoName,
  repo: repoName,
  pull: z.number().finite(),
  sha: text(64),
  body: text(65536),
  comments: objects<GithubReviewComment>(),
});
export const githubChecksInput = z.object({
  token: githubToken,
  owner: repoName,
  repo: repoName,
  sha: text(64),
});
export const botRepoInput = z.object({ owner: repoName, repo: repoName });
/** Strikes an idea out of the bot's reply on GitHub, or puts its box back (`struck.ts`). */
export const botIdeaInput = z.object({
  owner: repoName,
  repo: repoName,
  comment: z.number().int().positive(),
  task: text(1_000),
  dismissed: z.boolean(),
});
/** A note from a review of one of the bot's pull requests, ignored by the bot or brought back. */
export const botLessonInput = z.object({
  owner: repoName,
  repo: repoName,
  pull: z.number().int().positive(),
  kind: z.enum(["review", "line"]),
  id: z.number().int().positive(),
  ignored: z.boolean(),
});
export const botAskInput = z.object({
  owner: repoName,
  repo: repoName,
  number: z.number().int().positive().optional(),
  title: text(256).optional(),
  task: text(4000),
});
const botId = z.string().regex(BOT_ID);
export const botChatInput = z.object({
  owner: repoName,
  repo: repoName,
  /** The bot of the person's team being talked to: its name and instructions shape the chat. */
  botId: botId.optional(),
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: text(20_000) }))
    .min(1)
    .max(60),
  /** Pictures attached to the newest message: checked again by the handler (`agent/images.ts`). */
  images: z.array(z.custom<Record<string, unknown>>(isRecord)).max(3).optional(),
  /** Text files attached to the newest message: checked again by the handler (`bot/attachments.ts`). */
  files: z
    .array(z.object({ name: z.string().max(200), text: z.string().max(20_000) }))
    .max(3)
    .optional(),
});
/** A private chat's turns: no repository, no bot (`bot/private-chat.ts`). */
export const privateChatInput = z.object({
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: text(20_000) }))
    .min(1)
    .max(60),
  /** What the person named their bot (`my-bot.ts`): cleaned again before the model reads it. */
  botName: z.string().max(60).optional(),
  /** Pictures attached to the newest message: checked again by the handler (`agent/images.ts`). */
  images: z.array(z.custom<Record<string, unknown>>(isRecord)).max(3).optional(),
  /** Text files attached to the newest message: checked again by the handler (`bot/attachments.ts`). */
  files: z
    .array(z.object({ name: z.string().max(200), text: z.string().max(20_000) }))
    .max(3)
    .optional(),
  /** Summoned in the editor: what it shows, checked again by the handler (`bot/editor-context.ts`). */
  editor: z.custom<Record<string, unknown>>(isRecord).optional(),
});
/** One of the person's conversations with their bot (`my-bot.ts`). */
const chatId = z.string().regex(CHAT_ID);
export const chatInput = z.object({ chat: chatId });
/** A new title for one of them, cleaned by the handler. */
export const chatRenameInput = z.object({ chat: chatId, title: z.string().max(200) });
/** One of them pinned to the top of their list, or unpinned. */
export const chatPinInput = z.object({ chat: chatId, pinned: z.boolean() });
/** Words to find in the person's chats with their bot. */
export const chatSearchInput = z.object({ text: z.string().max(200) });
export const chatLoadInput = z.object({ chat: chatId.optional() });
/** The person's own bot: its name, cleaned by the handler, and its face. */
export const myBotInput = z.object({
  name: z.string().max(60),
  mascot: z.object({
    color: z.enum(Object.keys(MASCOT_COLORS) as [MascotColor, ...MascotColor[]]),
    body: z.enum(MASCOT_BODIES),
    face: z.enum(MASCOT_FACES),
  }),
});
/** A line a bot remembers (`bot/memory.ts`): its id, and the person's edit when they made one. */
const memoryId = z.string().regex(/^[0-9a-f]{16}$/);
export const memoryIdInput = z.object({ id: memoryId });
export const memoryKeepInput = z.object({ id: memoryId, text: text(1000).optional() });
/** Whose memory: a team bot's, or Aperture Bot's own (the private chat) without one. */
export const memoryScopeInput = z.object({ botId: botId.optional() });
/** The handler keeps only well-formed entries (`savedEntries`), the newest that fit. */
export const privateChatSaveInput = z.object({
  /** Left out: the first conversation, the private chat as it always was. */
  chat: chatId.optional(),
  entries: z.array(z.custom<Record<string, unknown>>(isRecord)).max(40),
});
export const botProfileInput = z.object({
  id: botId.optional(),
  name: text(40).min(1),
  repo: z.string().regex(REPO_FULL_NAME),
  mascot: z.object({
    color: z.enum(Object.keys(MASCOT_COLORS) as [MascotColor, ...MascotColor[]]),
    body: z.enum(MASCOT_BODIES),
    face: z.enum(MASCOT_FACES),
  }),
  personality: text(800),
  /** Left out: the bot keeps the model it has. */
  model: z.enum(BOT_MODELS).optional(),
  /** Left out: the bot keeps its rule. */
  allow: z.enum(BOT_ALLOW).optional(),
});
export const botIdInput = z.object({ id: botId });
/** The bot to star as main, or "" for none. */
export const botMainInput = z.object({ id: z.union([botId, z.literal("")]) });
/** The handler keeps only well-formed entries (`savedEntries`), the newest that fit. */
export const botChatSaveInput = z.object({
  id: botId,
  entries: z.array(z.custom<Record<string, unknown>>(isRecord)).max(40),
});
const repoFull = z.string().regex(REPO_FULL_NAME);
/** `repos`: the team's repositories; without them, the most recently pushed. */
export const botActivityInput = z.object({ repos: z.array(repoFull).max(15).optional() });
/** The team's repositories, for the Automation view: each one's daily brief. */
export const botTeamInput = z.object({ repos: z.array(repoFull).min(1).max(15) });
export const botTeamBriefInput = z.object({ repos: z.array(repoFull).min(1).max(15), on: z.boolean() });
export const botJobsInput = z.object({
  owner: repoName,
  repo: repoName,
  label: z.boolean(),
  scheduled: text(2_000).optional(),
  weekly: z.boolean().optional(),
  pulls: z.boolean().optional(),
  review: z.boolean().optional(),
  issues: z.boolean().optional(),
  red: z.boolean().optional(),
  autoRed: z.boolean().optional(),
  autoBrief: z.boolean().optional(),
  follow: z.boolean().optional(),
  slack: z.boolean().optional(),
});
export const botAppInput = z.object({ owner: repoName, repo: repoName, on: z.boolean() });
export const botSetupInput = z.object({
  owner: repoName,
  repo: repoName,
  provider: z.enum(["grok", "openai", "anthropic", "gemini", "deepseek"]),
});
export const githubMergeInput = z.object({
  token: githubToken,
  owner: repoName,
  repo: repoName,
  base: text(255),
  head: text(255),
  pull: z.number().finite().optional(),
  message: text(2000),
});

export const mcpAddInput = z.object({ name: text(100), url: text(500), token: text(1000).optional() });
export const mcpRemoveInput = z.object({ id: idInput });
export const mcpConfirmInput = z.object({ server: text(100), tool: text(200), args: text(100_000) });

export const agentTokenCreateInput = z.object({ name: text(100) });
export const agentTokenRevokeInput = z.object({ id: idInput });

export const acpAddInput = z.object({
  name: text(100),
  kind: z.enum(["claude-code", "codex", "opencode", "grok-build", "custom"]),
  endpoint: text(500),
  token: text(1000),
});

export const workspaceSaveInput = z.object({
  name: text(200),
  files: z.record(z.string(), z.string()),
  baseRevision: z.number().finite().nullable(),
});

/**
 * A Composer request. Unknown keys pass through untouched, so a field added
 * to `AgentInput` keeps working before a schema line is written for it.
 */
export const agentInput = z
  .looseObject({
    mode: z.enum(["chat", "composer", "inline"]),
    instruction: z.string(),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
    files: z.array(z.object({ path: z.string(), content: z.string() })),
    /** The saved copy's revision when `files` holds only what changed since it. */
    base: z.number().int().nonnegative().optional(),
    removed: strings(500).optional(),
    activePath: z.string().nullish(),
    selection: object<NonNullable<AgentInput["selection"]>>().nullish(),
    openTabs: strings(500).optional(),
    recentPaths: strings(500).optional(),
    focusPaths: strings(500).optional(),
    source: modelSourceInput.nullish(),
    agentId: text(200).nullish(),
    phase: z.enum(["plan", "build", "skip"]).optional(),
    approvedPlan: objects<PlanEntry>().optional(),
    workers: objects<WorkerSpec>().optional(),
    role: z.enum(["build", "review"]).optional(),
    pendingEdits: objects<ProposedEdit>().optional(),
    debug: z.boolean().optional(),
    compacted: z.number().finite().optional(),
    standing: strings(200).optional(),
    refusals: strings(500).optional(),
    spot: object<Spot>().optional(),
    userMove: z.string().optional(),
    runtime: z.string().max(4000).optional(),
    browserRuns: object<BrowserRuns>().optional(),
    unattended: z.boolean().optional(),
    images: z
      .array(z.object({ name: z.string().max(200), mediaType: z.string().max(40), data: z.string() }))
      .max(10)
      .optional(),
  })
  .transform((input) => input as AgentInput);
