/**
 * The model, as the agent loop calls it on a runner: the providers' plain
 * (non-streaming) calls, every one counted against a token budget, so a run
 * says what it used and stops at the cap rather than spending past it.
 */
import {
  complete,
  type ChatMessage,
  type Completion,
  type CompletionCfg,
} from "../../../src/lib/agent/complete.server.ts";
import type { LoopHost, ScriptOutcome } from "../../../src/lib/agent/loop.ts";
import type { AgentToolDef } from "../../../src/lib/agent/tools.ts";
import { retryStale } from "./retry.ts";

export type Model = (
  cfg: CompletionCfg,
  messages: ChatMessage[],
  useTools: boolean,
  signal?: AbortSignal,
  tools?: AgentToolDef[],
) => Promise<Completion>;

export const providerModel: Model = (cfg, messages, useTools, signal, tools) =>
  complete(cfg, messages, useTools, signal, tools);

export class BudgetSpent extends Error {}

export class Budget {
  input = 0;
  output = 0;
  calls = 0;
  /** Calls whose provider did not say what they used. */
  unreported = 0;

  constructor(readonly maxTokens: number) {}

  get total(): number {
    return this.input + this.output;
  }

  add(completion: Completion): void {
    this.calls += 1;
    if (!completion.usage) {
      this.unreported += 1;
      return;
    }
    this.input += completion.usage.input;
    this.output += completion.usage.output;
  }

  /** One line for the report. */
  describe(): string {
    const used = `${this.input.toLocaleString("en-US")} input and ${this.output.toLocaleString("en-US")} output tokens in ${this.calls} model call${this.calls === 1 ? "" : "s"}`;
    return this.unreported > 0 ? `${used} (${this.unreported} did not report their usage)` : used;
  }
}

/** The loop's host on a runner: the model through the budget, and scripts in the sandbox. */
export function runnerHost(
  model: Model,
  budget: Budget,
  runScript?: (files: Record<string, string>, script: string) => ScriptOutcome,
): LoopHost {
  const call: Model = async (cfg, messages, useTools, signal, tools) => {
    if (budget.total >= budget.maxTokens)
      throw new BudgetSpent(
        `Stopped at the token budget: ${budget.total.toLocaleString("en-US")} of ${budget.maxTokens.toLocaleString("en-US")} tokens used.`,
      );
    const completion = await retryStale(() => model(cfg, messages, useTools, signal, tools));
    budget.add(completion);
    return completion;
  };
  return {
    complete: call,
    completeStreaming: async (cfg, messages, useTools, onText, signal, tools) => {
      const completion = await call(cfg, messages, useTools, signal, tools);
      if (completion.content) onText(completion.content);
      return completion;
    },
    runScript: runScript ? async (_owner, files, script) => runScript(files, script) : undefined,
  };
}
