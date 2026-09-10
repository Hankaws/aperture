import { useCallback, useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAccount, type AccountSnapshot } from "./api";
import { providerShort } from "./plans";

export function useAccount() {
  const { user, isPending } = useCurrentUserState();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      return null;
    }
    setLoading(true);
    try {
      const next = await getAccount();
      setAccount(next);
      return next;
    } catch {
      setAccount(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isPending) return;
    void refresh();
  }, [isPending, refresh]);

  return { account, setAccount, loading, user, isPending, refresh };
}

export function modelCaption(account: AccountSnapshot | null): string {
  if (!account) return "Hosted Grok";
  if (account.modelSource === "hosted") {
    return `Hosted Grok · ${account.remaining} left`;
  }
  const name = providerShort(account.modelSource);
  const last4 = account.keys[account.modelSource]?.last4;
  return last4 ? `Your ${name} ···${last4}` : `Your ${name}`;
}
