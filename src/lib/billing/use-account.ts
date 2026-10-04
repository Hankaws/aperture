import { useCallback, useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAccount, type AccountSnapshot } from "./api";
import { providerShort } from "./plans";

function sameAccount(a: AccountSnapshot, b: AccountSnapshot): boolean {
  return (
    a.plan === b.plan &&
    a.hostedUsed === b.hostedUsed &&
    a.hostedTurns === b.hostedTurns &&
    a.remaining === b.remaining &&
    a.modelSource === b.modelSource &&
    a.tab === b.tab &&
    a.tabCap === b.tabCap &&
    a.tabUsed === b.tabUsed &&
    a.tabRemaining === b.tabRemaining &&
    a.acp === b.acp &&
    a.backgroundJobs === b.backgroundJobs &&
    a.session.on === b.session.on &&
    a.session.turns === b.session.turns &&
    a.session.cents === b.session.cents &&
    a.session.capTurns === b.session.capTurns &&
    a.session.capCents === b.session.capCents &&
    a.keys.grok.set === b.keys.grok.set &&
    a.keys.openai.set === b.keys.openai.set &&
    a.keys.anthropic.set === b.keys.anthropic.set &&
    a.keys.gemini.set === b.keys.gemini.set &&
    a.keys.deepseek.set === b.keys.deepseek.set
  );
}

export function useAccount() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccount(null);
      return null;
    }
    setLoading(true);
    try {
      const next = await getAccount();
      setAccount((prev) => (prev && sameAccount(prev, next) ? prev : next));
      return next;
    } catch {
      setAccount(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isPending) return;
    void refresh();
  }, [isPending, refresh]);

  return { account, setAccount, loading, user, isPending, refresh };
}

export function modelCaption(account: AccountSnapshot | null): string {
  if (!account) return "Your Grok key";
  if (account.modelSource === "hosted") {
    const last4 = account.keys.grok?.last4;
    return last4 ? `Your Grok ···${last4}` : "Your Grok key";
  }
  if (account.modelSource === "custom") {
    const model = account.custom?.model ?? "endpoint";
    return account.custom?.keySet && account.custom.last4
      ? `Custom · ${model} ···${account.custom.last4}`
      : `Custom · ${model}`;
  }
  const name = providerShort(account.modelSource);
  const last4 = account.keys[account.modelSource]?.last4;
  return last4 ? `Your ${name} ···${last4}` : `Your ${name}`;
}
