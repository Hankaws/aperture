/**
 * The agent loop as the server runs it: its model clients, its sandbox, and
 * the account's MCP servers. The loop itself is `loop.ts`, shared with the
 * browser, which runs it for a model on the person's own machine.
 */
import { complete, completeStreaming, type CompletionCfg } from "./complete.server";
import type { AgentStreamEvent } from "./events";
import { runLoop, type LoopHost } from "./loop";
import { tsParseCheck } from "@/lib/workspace/ts-parse";
import type { AgentInput, AgentResult } from "./types";

const SERVER_HOST: LoopHost = {
  complete,
  completeStreaming,
  runScript: async (userId, files, script, signal) => {
    const { resolveRunner, runScript } = await import("@/lib/sandbox/run.server");
    const runner = await resolveRunner();
    const result = await runScript({ userId, runner, files, signal }, script);
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
};

export async function runAgentLoop(input: AgentInput, cfg: CompletionCfg & { userId?: string }): Promise<AgentResult> {
  return runLoop(input, cfg, () => undefined, undefined, SERVER_HOST);
}

export async function runAgentLoopStreaming(
  input: AgentInput,
  cfg: CompletionCfg & { userId?: string },
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  return runLoop(input, cfg, emit, signal, SERVER_HOST);
}
