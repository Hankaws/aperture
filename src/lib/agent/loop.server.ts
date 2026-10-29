/**
 * The agent loop as the server runs it: its model clients, its sandbox, and
 * the account's MCP servers. The loop itself is `loop.ts`, shared with the
 * browser, which runs it for a model on the person's own machine.
 */
import { complete, completeStreaming, type CompletionCfg } from "./complete.server";
import type { AgentStreamEvent } from "./events";
import { runLoop, type LoopHost } from "./loop";
import { tsParseCheck } from "@/lib/workspace/ts-parse";
import { TSC_LIMITS } from "@/lib/workspace/tsc-core";
import type { AgentInput, AgentResult } from "./types";
import { turnDeadline } from "./turn-budget";

const SERVER_HOST: LoopHost = {
  complete,
  completeStreaming,
  runScript: async (userId, files, script, signal, maxMs) => {
    const { resolveRunner, runScript } = await import("@/lib/sandbox/run.server");
    const { DEFAULT_RUN_MS } = await import("@/lib/sandbox/policy");
    const runner = await resolveRunner();
    // The run's usual timeout, shortened when the turn has less time left than that.
    const timeoutMs = maxMs === undefined ? undefined : Math.min(DEFAULT_RUN_MS, maxMs);
    const result = await runScript({ userId, runner, files, signal }, script, timeoutMs);
    return { text: result.text, passed: result.passed, ran: result.ran };
  },
  mcp: async (userId, files) => {
    const { invokeMcp, mcpToolsFor } = await import("@/lib/mcp/account.server");
    const mcp = await mcpToolsFor(userId, files);
    return {
      note: mcp.note,
      call: mcp.servers.length > 0 ? (server, tool, args) => invokeMcp(mcp.servers, mcp.tools, server, tool, args) : null,
    };
  },
  // Loaded only once an edit looks like it does not parse: the compiler is large.
  parser: async () => {
    const mod = await import("typescript");
    return tsParseCheck(mod.default ?? mod);
  },
  language: async () => {
    const mod = await import("typescript");
    const ts = mod.default ?? mod;
    const { serverLibs } = await import("@/lib/workspace/ts-libs.server");
    return { ts, libs: (options) => serverLibs(ts, options), limits: { ...TSC_LIMITS, where: "on the server" } };
  },
};

/** `deadline`: when the turn must wrap up (turn-budget.ts); a turn starting now when not given. */
type ServerLoopCfg = CompletionCfg & { userId?: string; deadline?: number };

export async function runAgentLoop(input: AgentInput, cfg: ServerLoopCfg): Promise<AgentResult> {
  return runLoop(input, { ...cfg, deadline: cfg.deadline ?? turnDeadline() }, () => undefined, undefined, SERVER_HOST);
}

export async function runAgentLoopStreaming(
  input: AgentInput,
  cfg: ServerLoopCfg,
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  return runLoop(input, { ...cfg, deadline: cfg.deadline ?? turnDeadline() }, emit, signal, SERVER_HOST);
}
