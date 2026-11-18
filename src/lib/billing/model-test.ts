/**
 * Testing a model key from Settings: one tiny request with the saved key (or
 * the custom endpoint), so a missing, wrong or unreadable key shows up there,
 * with what to do, before a chat or a run fails on it. Pure, for tests: the
 * server function is `model-test.api.ts`.
 */
import type { ChatMessage } from "../agent/complete.server.ts";

/** What a test asks: as little as a model can answer. */
export const TEST_MESSAGES: ChatMessage[] = [
  { role: "system", content: "This is a connection test. Answer with the single word OK." },
  { role: "user", content: "Say OK." },
];

/** How long a test waits for an answer. */
export const TEST_TIMEOUT_MS = 30_000;

export type ModelTest = { ok: true; ms: number } | { ok: false; error: string };

/** A test's result, as Settings shows it under the key. */
export function testLine(result: ModelTest): string {
  if (!result.ok) return result.error;
  const seconds = result.ms / 1000;
  return `Works: it answered in ${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s.`;
}

/** An error from a test that ran out of time, said plainly. */
export function testError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError")
    return `No answer in ${TEST_TIMEOUT_MS / 1000} s. The endpoint may be down, or too slow for the model.`;
  return error instanceof Error && error.message ? error.message : "The model could not answer.";
}
