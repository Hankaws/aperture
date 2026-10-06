/**
 * When a sign-in with Google, X or the Grok gate may join an existing account
 * that has the same email. Pure, so a test can run Better Auth's own linking
 * code against it (`account-linking.test.ts`).
 *
 * The rule that matters: never join a new sign-in to an account whose email
 * was never confirmed. Email/password sign-up here sends no confirmation, so
 * anyone can create an account under someone else's address. Without this
 * rule, the real owner's later Google sign-in would land in that account, and
 * whoever made it would keep the password, and with it the owner's workspaces,
 * GitHub connection and keys.
 *
 * Trusting the broker's providers stays: it only waives the check on the
 * provider's own email (X's emails are synthetic and never "verified"), not
 * the check on the account being joined. A sign-in that is refused comes back
 * to /login with `error=account_not_linked`, which the page explains.
 */
export function accountLinkingPolicy(trustedProviders: string[]) {
  return {
    enabled: true,
    trustedProviders,
    requireLocalEmailVerified: true,
  };
}
