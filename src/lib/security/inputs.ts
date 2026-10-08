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
export const providerInput = z.enum(PROVIDERS);
export const modelSourceInput = z.enum(["hosted", "custom", "local", ...PROVIDERS]);

export const providerKeyInput = z.object({ provider: providerInput, key: text(1000) });
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
export const botAskInput = z.object({
  owner: repoName,
  repo: repoName,
  number: z.number().int().positive().optional(),
  title: text(256).optional(),
  task: text(4000),
});
export const botChatInput = z.object({
  owner: repoName,
  repo: repoName,
  turns: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: text(20_000) }))
    .min(1)
    .max(60),
});
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
  })
  .transform((input) => input as AgentInput);
