/**
 * The deployment check's last answer. Each real check starts a billed
 * sandbox, so one runs at most every COOLDOWN_MS per server instance, and
 * calls in between get the last answer. A check that is still running is
 * shared by the calls that arrive meanwhile.
 */
export const COOLDOWN_MS = 10 * 60_000;

export type CheckAnswer = { status: number; body: Record<string, unknown> };

export function checkCooldown(now: () => number = Date.now) {
  let last: { at: number; answer: Promise<CheckAnswer> } | null = null;
  return (run: () => Promise<CheckAnswer>): Promise<CheckAnswer & { cached: boolean }> => {
    if (last && now() - last.at < COOLDOWN_MS) {
      return last.answer.then((answer) => ({ ...answer, cached: true }));
    }
    const answer = run();
    const entry = { at: now(), answer };
    last = entry;
    // A check that threw must not block the next one for ten minutes.
    answer.catch(() => {
      if (last === entry) last = null;
    });
    return answer.then((a) => ({ ...a, cached: false }));
  };
}
