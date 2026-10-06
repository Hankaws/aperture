import { test } from "node:test";
import assert from "node:assert/strict";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { accountLinkingPolicy } from "./account-linking.ts";

type DbUser = { id: string; email: string; emailVerified: boolean };
type Account = { providerId: string; accountId: string };

/** Runs Better Auth's own OAuth linking step against a one-user database. */
async function signInWith(
  existing: { user: DbUser; accounts: Account[] } | null,
  provider: { providerId: string; accountId: string; email: string; emailVerified: boolean },
) {
  const linked: Account[] = [];
  const sessions: string[] = [];
  const context = {
    options: {
      account: { accountLinking: accountLinkingPolicy(["grok-google", "grok-x", "grok-gate"]) },
    },
    trustedProviders: ["grok-google", "grok-x", "grok-gate"],
    logger: { error() {}, warn() {}, info() {} },
    internalAdapter: {
      async findOAuthUser(email: string, accountId: string, providerId: string) {
        if (!existing || existing.user.email !== email) return null;
        const linkedAccount = existing.accounts.find(
          (a) => a.providerId === providerId && a.accountId === accountId,
        );
        return {
          user: existing.user,
          accounts: existing.accounts,
          linkedAccount: linkedAccount ?? null,
        };
      },
      async linkAccount(account: Account) {
        linked.push({ providerId: account.providerId, accountId: account.accountId });
      },
      async updateUser() {
        return null;
      },
      async updateAccount() {},
      async createOAuthUser() {
        return {
          user: { id: "new", email: provider.email, emailVerified: provider.emailVerified },
          account: {},
        };
      },
      // Stop before cookies: which user the session is for is all these tests need.
      async createSession(userId: string) {
        sessions.push(userId);
        return null;
      },
    },
  };
  const result = await handleOAuthUserInfo(
    { context } as never,
    {
      userInfo: {
        id: provider.accountId,
        email: provider.email,
        emailVerified: provider.emailVerified,
        name: "Someone",
      },
      account: { providerId: provider.providerId, accountId: provider.accountId },
    } as never,
  );
  return { error: result.error, linked, sessions };
}

const google = {
  providerId: "grok-google",
  accountId: "g-1",
  email: "owner@example.com",
  emailVerified: true,
};

test("a Google sign-in never joins an account someone made with that email and an unconfirmed password", async () => {
  const squatter = {
    user: { id: "attacker", email: "owner@example.com", emailVerified: false },
    accounts: [{ providerId: "credential", accountId: "attacker" }],
  };
  const result = await signInWith(squatter, google);
  assert.equal(result.error, "account not linked");
  assert.deepEqual(result.linked, []);
  assert.deepEqual(result.sessions, [], "no session into the squatted account");
});

test("the gate and X are held to the same rule", async () => {
  const squatter = {
    user: { id: "attacker", email: "owner@example.com", emailVerified: false },
    accounts: [{ providerId: "credential", accountId: "attacker" }],
  };
  for (const providerId of ["grok-gate", "grok-x"]) {
    const result = await signInWith(squatter, { ...google, providerId });
    assert.equal(result.error, "account not linked", providerId);
    assert.deepEqual(result.sessions, [], providerId);
  }
});

test("an account whose email was confirmed can still add another sign-in", async () => {
  const owner = {
    user: { id: "owner", email: "owner@example.com", emailVerified: true },
    accounts: [{ providerId: "grok-gate", accountId: "gate-1" }],
  };
  const result = await signInWith(owner, google);
  assert.deepEqual(result.linked, [{ providerId: "grok-google", accountId: "g-1" }]);
  assert.deepEqual(result.sessions, ["owner"]);
});

test("a returning sign-in and a first sign-in are unaffected", async () => {
  const returning = {
    user: { id: "x-user", email: "123@x.invalid", emailVerified: false },
    accounts: [{ providerId: "grok-x", accountId: "x-1" }],
  };
  const again = await signInWith(returning, {
    providerId: "grok-x",
    accountId: "x-1",
    email: "123@x.invalid",
    emailVerified: false,
  });
  assert.deepEqual(again.sessions, ["x-user"]);
  const first = await signInWith(null, google);
  assert.deepEqual(first.sessions, ["new"]);
});
