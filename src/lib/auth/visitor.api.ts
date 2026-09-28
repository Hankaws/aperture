import { createServerFn } from "@tanstack/react-start";

/**
 * Issues this browser's anonymous visitor cookie before the editor loads.
 *
 * Without it, the editor's first burst of parallel requests (saved files,
 * account, model status) each arrive with no cookie and each mint a different
 * id, so the first visit would scatter across several anonymous users.
 * A no-op when sign-in is on.
 */
export const ensureVisitor = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUserId } = await import("./verify.server");
  try {
    await requireUserId();
  } catch {
    // Signed out, or sign-in off against a real database (fail closed): nothing to issue.
  }
  return null;
});
