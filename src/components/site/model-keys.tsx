import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProviderKey, setModelSource, type AccountSnapshot } from "@/lib/billing/api";
import { PROVIDERS, planById, type ProviderId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function ModelKeys({
  account,
  onAccount,
}: {
  account: AccountSnapshot;
  onAccount: (next: AccountSnapshot) => void;
}) {
  const [tab, setTab] = useState<ProviderId>(account.preferredProvider);
  const plan = planById(account.plan);
  const slotsLeft = Math.max(0, account.byokSlots - account.keyCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-medium tracking-tight">API keys</h2>
          <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
            Attach the keys you already pay for. {plan.name} allows {plan.byokSlots}{" "}
            {plan.byokSlots === 1 ? "provider" : "providers"}. Hosted Grok does not use a slot. Keys are encrypted at
            rest and never sent back to the browser — only the last four characters.
          </p>
        </div>
        <p className="text-sm tabular-nums text-subtle">
          {account.keyCount} / {account.byokSlots} keys
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Hosted Grok</p>
            <p className="mt-1 text-sm text-subtle">Included on the plan. One send = one turn.</p>
          </div>
          {account.modelSource === "hosted" ? (
            <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok">Selected</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  onAccount(await setModelSource({ data: "hosted" }));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not switch");
                }
              }}
            >
              Use hosted Grok
            </Button>
          )}
        </div>
      </div>

      <div className="flex rounded-lg border border-border p-1">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => setTab(provider.id)}
            className={cn(
              "h-11 flex-1 rounded-md text-sm",
              tab === provider.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {provider.label.replace(/^(xAI |OpenAI |Anthropic )/, "")}
          </button>
        ))}
      </div>

      {PROVIDERS.map((provider) =>
        tab === provider.id ? (
          <ProviderPanel
            key={provider.id}
            provider={provider.id}
            label={provider.label}
            hint={provider.hint}
            placeholder={provider.placeholder}
            account={account}
            slotsLeft={slotsLeft}
            onAccount={onAccount}
          />
        ) : null,
      )}

      {account.plan === "hobby" && (
        <p className="text-sm text-muted">
          Need GPT and Claude at the same time?{" "}
          <Link to="/pricing" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-auto px-1")}>
            Upgrade to Pro
          </Link>
        </p>
      )}
    </div>
  );
}

function ProviderPanel({
  provider,
  label,
  hint,
  placeholder,
  account,
  slotsLeft,
  onAccount,
}: {
  provider: ProviderId;
  label: string;
  hint: string;
  placeholder: string;
  account: AccountSnapshot;
  slotsLeft: number;
  onAccount: (next: AccountSnapshot) => void;
}) {
  const status = account.keys[provider];
  const locked = !status.set && slotsLeft <= 0;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const preferred = account.modelSource === provider;

  async function save() {
    const key = value.trim();
    if (!key) return;
    setBusy(true);
    try {
      const next = await saveProviderKey({ data: { provider, key } });
      onAccount(next);
      setValue("");
      toast.success(`${label} key saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save key");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const next = await saveProviderKey({ data: { provider, key: "" } });
      onAccount(next);
      toast.success(`${label} key removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove key");
    } finally {
      setBusy(false);
    }
  }

  async function prefer() {
    try {
      const next = await setModelSource({ data: provider });
      onAccount(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update preferred model");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-sm text-subtle">{hint}</p>
        </div>
        {status.set ? (
          <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok">
            Linked · {status.last4}
          </span>
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle">Not linked</span>
        )}
      </div>

      {locked ? (
        <p className="mt-4 text-sm text-muted">
          {planById(account.plan).name} only allows {account.byokSlots} key. Remove the one you have, or upgrade to add{" "}
          {label}.
        </p>
      ) : (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={status.set ? `Replace key (${placeholder})` : placeholder}
            className="font-mono"
          />
          <Button type="submit" disabled={busy || value.trim().length < 8} className="sm:w-36">
            {busy ? "Saving…" : status.set ? "Replace" : "Save key"}
          </Button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant={preferred ? "subtle" : "outline"}
          size="sm"
          disabled={preferred}
          onClick={() => void prefer()}
        >
          {preferred ? "Preferred" : "Use in Composer"}
        </Button>
        {status.set && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            Remove
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-subtle">
        Encrypted at rest. Composer uses the model you pick — never Auto, never a silent fallback. Switch to Hosted Grok
        from the Composer menu if you want the included turns.
      </p>
    </div>
  );
}
