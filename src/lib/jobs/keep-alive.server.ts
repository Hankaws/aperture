import { getRequest } from "@tanstack/react-start/server";

/**
 * Keeps the function alive for work that outlives the response: a background
 * job starts, the request answers at once, and the job runs on. On Vercel a
 * function may be frozen once it has answered unless the work is registered
 * with `waitUntil`, and is still bound by the function's own time limit. A
 * Node server runs it either way.
 *
 * Server-only (`.server.ts`): `getRequest` uses AsyncLocalStorage.
 */
type WaitUntil = (promise: Promise<unknown>) => void;

/** What the request carries (nitro's Vercel entry sets `request.waitUntil`), else Vercel's global request context. */
function waitUntilFn(): WaitUntil | null {
  try {
    const request = getRequest() as (Request & { waitUntil?: WaitUntil }) | undefined;
    if (typeof request?.waitUntil === "function") return request.waitUntil.bind(request);
  } catch {
    // No request context.
  }
  const context = (
    globalThis as Record<symbol, { get?: () => { waitUntil?: WaitUntil } } | undefined>
  )[Symbol.for("@vercel/request-context")];
  const fromContext = context?.get?.()?.waitUntil;
  return typeof fromContext === "function" ? fromContext : null;
}

export function keepAlive(work: Promise<unknown>): void {
  const waitUntil = waitUntilFn();
  // A failure is the job's to record; waitUntil must not see an unhandled rejection.
  const settled = work.catch(() => undefined);
  if (waitUntil) waitUntil(settled);
}
