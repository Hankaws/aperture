/**
 * What a failed send says. A dropped connection surfaces as the browser's own
 * TypeError ("Failed to fetch", "NetworkError when attempting to fetch
 * resource.", "Load failed"), which tells the person nothing about what to do.
 */

/** True when the request never got an answer: offline, a dropped connection, a blocked host. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

/** The line a reply ends with when its stream closed before the turn's last word. */
export function cutOffLine(canRetry = false): string {
  return canRetry
    ? "The reply was cut off before it finished. Press Retry to send it again."
    : "The reply was cut off before it finished.";
}

/** The line a failed turn ends with. `canRetry`: the reply offers a Retry button. */
export function describeSendError(error: unknown, canRetry = false): string {
  if (isNetworkError(error)) {
    return canRetry
      ? "Could not reach Aperture. Check your connection, then press Retry."
      : "Could not reach Aperture. Check your connection.";
  }
  const raw = error instanceof Error ? error.message : "Request failed";
  if (/unauthorized/i.test(raw)) {
    return "Sign in to run Composer. Plans and API keys live on the account.";
  }
  return raw;
}
