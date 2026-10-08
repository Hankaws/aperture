/**
 * GitHub as the signed-in person, for the Bot page's server functions: the
 * token on their account, and JSON calls with it. Server-only: the Bot page's
 * handlers import it when they run, so none of it reaches the browser.
 */

/** The GitHub token saved on the account, decrypted, or null. */
export async function accountToken(userId: string): Promise<string | null> {
  const { decryptSecret } = await import("@/lib/security/secrets.server");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ github_token: string | null }>`
    select github_token from user_settings where user_id = ${userId}
  `;
  return decryptSecret(rows[0]?.github_token ?? null);
}

/** A GitHub API call. Redirects are not followed; a body that is not JSON reads as {}. */
export async function githubJson(
  url: string,
  token: string,
  init?: { method?: string; body?: string },
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    body: init?.body,
    redirect: "manual",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "aperture-bot-page",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status >= 300 && res.status < 400) return { status: res.status, body: {} };
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
