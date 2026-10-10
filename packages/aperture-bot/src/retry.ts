/**
 * One retry for a request sent on a connection the other side had already
 * closed. Node's fetch keeps connections open between requests; while the bot
 * waits on something that blocks the event loop (an image pull, a test run),
 * the server may close one without Node noticing, and the next request on it
 * fails before the server ever reads it. Retrying that request cannot repeat
 * one that arrived, so it is safe for a comment or a pull request too.
 */

const STALE = new Set(["UND_ERR_SOCKET", "UND_ERR_CLOSED", "ECONNRESET", "EPIPE"]);

function causeCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | undefined)?.cause;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

export function isStaleConnection(error: unknown): boolean {
  const code = causeCode(error);
  return code !== undefined && STALE.has(code);
}

export async function retryStale<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isStaleConnection(error)) throw error;
    return request();
  }
}

/**
 * What a provider says when it is busy rather than when the request is wrong:
 * rate limited, overloaded, or down for a moment. Worth waiting out.
 */
const BUSY = new Set([429, 500, 502, 503, 504, 529]);

export function isBusy(error: unknown): boolean {
  const status = (error as { status?: unknown } | undefined)?.status;
  return typeof status === "number" && BUSY.has(status);
}

/** How long to wait before each retry of a busy model: about a minute and a half in all. */
export const BUSY_WAITS_MS = [10_000, 30_000, 60_000];

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * A model call, tried again while the provider says it is busy, waiting
 * longer each time. Any other error, or the last busy one, is thrown.
 */
export async function retryBusy<T>(
  request: () => Promise<T>,
  options: {
    waits?: number[];
    wait?: (ms: number) => Promise<void>;
    log?: (line: string) => void;
  } = {},
): Promise<T> {
  const waits = options.waits ?? BUSY_WAITS_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const ms = waits[attempt];
      if (!isBusy(error) || ms === undefined) throw error;
      options.log?.(`The model is busy (${describeError(error)}); trying again in ${ms / 1000} s.`);
      await (options.wait ?? sleep)(ms);
    }
  }
}

/** An error as one line, with fetch's hidden cause: "fetch failed (ECONNREFUSED)". */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = causeCode(error);
  return code && !message.includes(code) ? `${message} (${code})` : message;
}
