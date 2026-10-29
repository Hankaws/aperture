/**
 * How long one server turn may run. The server is a Vercel function, stopped
 * at its time limit (300 s by default) with no chance to answer: the reply just
 * ends, and a background job is left "running". A turn wraps up before that,
 * keeping what it staged, so it always ends with a real answer.
 *
 * Counted from the request's start, so the setup before the loop, a crew's
 * workers and its reviewers share one budget, and the minute left over covers
 * the recap, billing and closing the stream.
 */
export const SERVER_TURN_MS = 240_000;

/** A model step is not started with less than this left: it would only be cut off. */
export const MIN_STEP_MS = 20_000;

/** A sandbox run is not started with less than this left: setup alone takes most of it. */
export const MIN_RUN_MS = 30_000;

/** Kept back from a sandbox run's timeout for the step that reads its result. */
export const RUN_MARGIN_MS = 10_000;

/** The deadline for a turn starting now. */
export function turnDeadline(now = Date.now()): number {
  return now + SERVER_TURN_MS;
}

/** Milliseconds left before `deadline`, or null for a turn with no deadline (one run in the browser). */
export function timeLeft(deadline: number | null | undefined, now = Date.now()): number | null {
  return deadline == null ? null : deadline - now;
}

/**
 * The longest a sandbox run may take now: null for no limit beyond the run's
 * own, 0 when there is not enough time to start one.
 */
export function runAllowance(deadline: number | null | undefined, now = Date.now()): number | null {
  const left = timeLeft(deadline, now);
  if (left === null) return null;
  return left < MIN_RUN_MS ? 0 : left - RUN_MARGIN_MS;
}

/** What the agent reads when a run would not finish before the turn ends. */
export function noTimeToRunText(script: string): string {
  return `Not run: this turn is close to its time limit. Stage the change now; npm run ${script} can run in the next turn.`;
}

/** How a turn that reached its time limit ends. */
export function outOfTimeText(staged: number): string {
  return staged > 0
    ? 'Stopped at this turn\'s time limit. Review the staged edits, or say "continue" to carry on.'
    : 'Stopped at this turn\'s time limit before anything was staged. Say "continue" to carry on.';
}
