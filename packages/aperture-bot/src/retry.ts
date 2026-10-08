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

/** An error as one line, with fetch's hidden cause: "fetch failed (ECONNREFUSED)". */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = causeCode(error);
  return code && !message.includes(code) ? `${message} (${code})` : message;
}
