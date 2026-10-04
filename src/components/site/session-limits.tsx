import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetSession, setSessionCap, type AccountSnapshot } from "@/lib/billing/api";
import { DEFAULT_SESSION_CENTS, MAX_SESSION_CENTS, MIN_SESSION_CENTS, formatUsd } from "@/lib/billing/cost";

export function SessionLimits({
  account,
  onAccount,
}: {
  account: AccountSnapshot;
  onAccount: (next: AccountSnapshot) => void;
}) {
  const [on, setOn] = useState(account.session.on);
  const [dollars, setDollars] = useState((account.session.capCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      // Kept as saved. The turn cap only counts hosted turns, and every send now uses the account's own key.
      const nextTurns = account.session.capTurns;
      const cents = Math.round(Number(dollars) * 100);
      const nextCents = Math.min(MAX_SESSION_CENTS, Math.max(MIN_SESSION_CENTS, Number.isFinite(cents) ? cents : DEFAULT_SESSION_CENTS));
      const next = await setSessionCap({ data: { on, turns: nextTurns, cents: nextCents } });
      onAccount(next);
      toast.success("Session cap saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save cap");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      onAccount(await resetSession());
      toast.success("Session counters reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium tracking-tight">Session cap</h2>
        <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
          On by default. Sends stop around {formatUsd(account.session.capCents)} on the key you attached.
          The runaway hour cannot happen here.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Cap this session</span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((v) => !v)}
            className={`relative h-6 w-10 rounded-full ${on ? "bg-accent" : "bg-elevated"}`}
          >
            <span className={`absolute top-0.5 size-5 rounded-full bg-fg transition-transform ${on ? "left-4" : "left-0.5"}`} />
          </button>
        </label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">BYOK dollars</span>
            <Input
              type="number"
              min={MIN_SESSION_CENTS / 100}
              max={MAX_SESSION_CENTS / 100}
              step="0.25"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-subtle">
          This session: {account.session.turns} turns, {formatUsd(account.session.cents)} on your keys. One
          Composer send is one turn — greps inside the loop are free.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save cap"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void reset()} disabled={busy}>
            Reset session
          </Button>
        </div>
        {!on && (
          <p className="mt-3 text-xs text-warn">
            Cap is off. Your provider will bill every send on your key.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-medium">Tab ghost-text</h3>
        {account.tab ? (
          <p className="mt-2 text-sm text-muted">
            Fast model only — never grok-4.5 per keystroke. Tab uses your own key and is uncapped on that provider.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Tab is on Pro. Composer, Chat, and Inline still run on Hobby.</p>
        )}
      </div>
    </div>
  );
}
