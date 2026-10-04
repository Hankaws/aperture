import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProviderKey, saveCustomEndpoint, setModelSource, type AccountSnapshot } from "@/lib/billing/api";
import { CUSTOM_PRESETS } from "@/lib/agent/custom-endpoint";
import {
  LOCAL_DEFAULT_BASE,
  cleanLocalModel,
  listLocalModels,
  localFailure,
  normalizeLocalBase,
  readLocalModel,
  saveLocalModel,
} from "@/lib/agent/local-model";
import { PROVIDERS, planById, type ProviderId } from "@/lib/billing/plans";
import { showPricing } from "@/lib/billing/pricing-visible";
import { cn } from "@/lib/utils";

export function ModelKeys({
  account,
  onAccount,
}: {
  account: AccountSnapshot;
  onAccount: (next: AccountSnapshot) => void;
}) {
  const [tab, setTab] = useState<ProviderId | "custom" | "local">(
    account.modelSource === "custom" || account.modelSource === "local" ? account.modelSource : account.preferredProvider,
  );
  const plan = planById(account.plan);
  const slotsLeft = Math.max(0, account.byokSlots - account.keyCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-medium tracking-tight">API keys</h2>
          <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
            Attach the keys you already pay for. {plan.name} allows {plan.byokSlots}{" "}
            {plan.byokSlots === 1 ? "provider" : "providers"}. A custom endpoint does not use a slot. Keys
            are encrypted at rest and never sent back to the browser — only the last four characters.{" "}
            <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
              What that key’s provider can see.
            </Link>
          </p>
        </div>
        <p className="text-sm tabular-nums text-subtle">
          {account.keyCount} / {account.byokSlots} keys
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Your Grok key</p>
            <p className="mt-1 text-sm text-subtle">Uses the Grok key on this account. xAI bills you. One send = one call.</p>
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
              Use your Grok key
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap rounded-lg border border-border p-1">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => setTab(provider.id)}
            className={cn(
              "h-11 min-w-[5.5rem] flex-1 rounded-md px-2 text-sm",
              tab === provider.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {provider.short}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("custom")}
          className={cn(
            "h-11 min-w-[5.5rem] flex-1 rounded-md px-2 text-sm",
            tab === "custom" ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          Custom
        </button>
        <button
          type="button"
          onClick={() => setTab("local")}
          className={cn(
            "h-11 min-w-[5.5rem] flex-1 rounded-md px-2 text-sm",
            tab === "local" ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          This computer
        </button>
      </div>

      {tab === "local" ? (
        <LocalPanel account={account} onAccount={onAccount} />
      ) : tab === "custom" ? (
        <CustomPanel account={account} onAccount={onAccount} />
      ) : (
        PROVIDERS.map((provider) =>
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
        )
      )}

      {account.plan === "hobby" && showPricing && (
        <p className="text-sm text-muted">
          Need GPT, Claude, Gemini, and DeepSeek together?{" "}
          <Link to="/pricing" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-auto px-1")}>
            Pro (coming soon)
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
        Encrypted at rest. Composer uses the model you pick — never Auto, never a silent fallback.
      </p>
    </div>
  );
}

function CustomPanel({
  account,
  onAccount,
}: {
  account: AccountSnapshot;
  onAccount: (next: AccountSnapshot) => void;
}) {
  const saved = account.custom;
  const [base, setBase] = useState(saved?.base ?? CUSTOM_PRESETS[0].base);
  const [model, setModel] = useState(saved?.model ?? CUSTOM_PRESETS[0].model);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = account.modelSource === "custom";

  function applyPreset(id: (typeof CUSTOM_PRESETS)[number]["id"]) {
    const preset = CUSTOM_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setBase(preset.base);
    setModel(preset.model);
    setKey("");
  }

  async function save(clearKey = false) {
    setBusy(true);
    try {
      const next = await saveCustomEndpoint({
        data: { base: base.trim(), model: model.trim(), key: key.trim(), clearKey },
      });
      onAccount(next);
      setKey("");
      toast.success(clearKey ? "Custom key removed" : "Custom endpoint saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save endpoint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Custom endpoint</p>
          <p className="mt-1 max-w-xl text-sm text-pretty text-subtle">
            Any OpenAI-compatible <span className="font-mono">/v1</span> base. Ollama and LM Studio are reached from this
            server, so they have to be on the same machine. OpenRouter and other hosts need https. A custom endpoint
            does not use a key slot.
          </p>
        </div>
        {selected && saved?.base ? (
          <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok">Selected</span>
        ) : saved?.keySet ? (
          <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok">
            Key · {saved.last4}
          </span>
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle">No key</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CUSTOM_PRESETS.map((preset) => (
          <Button key={preset.id} type="button" variant="outline" size="sm" onClick={() => applyPreset(preset.id)}>
            {preset.label}
          </Button>
        ))}
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <label className="block text-xs text-subtle">
          Base URL
          <Input
            value={base}
            onChange={(event) => setBase(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="http://127.0.0.1:11434/v1"
            className="mt-1 font-mono"
          />
        </label>
        <label className="block text-xs text-subtle">
          Model
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="llama3.1"
            className="mt-1 font-mono"
          />
        </label>
        <label className="block text-xs text-subtle">
          API key
          <Input
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={saved?.keySet ? `Leave blank to keep ····${saved.last4 ?? ""}` : "Optional — leave blank for Ollama"}
            className="mt-1 font-mono"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" disabled={busy || !base.trim() || !model.trim()} className="sm:w-40">
            {busy ? "Saving…" : "Save endpoint"}
          </Button>
          {saved?.keySet && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void save(true)}>
              Remove key
            </Button>
          )}
          {selected ? (
            <span className="text-xs text-subtle">Composer is using this endpoint.</span>
          ) : null}
        </div>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-subtle">
        Saving selects it in Composer. http is only allowed for 127.0.0.1, localhost, and ::1. The key, if you set one,
        is encrypted and is not sent back here.
      </p>
    </div>
  );
}

const LOCAL_PRESETS = [
  { label: "Ollama", base: LOCAL_DEFAULT_BASE },
  { label: "LM Studio", base: "http://127.0.0.1:1234/v1" },
] as const;

/**
 * A model on this computer, run from this browser tab: the address and model
 * stay in this browser, and a turn goes from the page straight to the model,
 * not through Aperture's server. So it works on the hosted site too.
 */
function LocalPanel({
  account,
  onAccount,
}: {
  account: AccountSnapshot;
  onAccount: (next: AccountSnapshot) => void;
}) {
  const [saved, setSaved] = useState(() => readLocalModel());
  const [base, setBase] = useState(saved?.base ?? LOCAL_DEFAULT_BASE);
  const [model, setModel] = useState(saved?.model ?? "");
  const [models, setModels] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "save" | null>(null);
  // Known only in the browser; the page renders on the server first.
  const [origin, setOrigin] = useState("https://your-aperture-address");
  useEffect(() => setOrigin(window.location.origin), []);
  const selected = account.modelSource === "local" && saved !== null;
  const cleanBase = normalizeLocalBase(base);

  async function connect() {
    if (!cleanBase) return;
    setBusy("connect");
    setError(null);
    try {
      const found = await listLocalModels(cleanBase);
      setModels(found);
      if (found.length > 0 && !found.includes(model)) setModel(found[0]!);
      if (found.length === 0) setError("Connected, but the server lists no models. Pull one first, for example: ollama pull qwen2.5-coder:7b");
    } catch (failure) {
      setModels(null);
      setError(localFailure(cleanBase, origin, failure));
    } finally {
      setBusy(null);
    }
  }

  async function saveAndUse() {
    const name = cleanLocalModel(model);
    if (!cleanBase || !name) return;
    setBusy("save");
    try {
      const next = { base: cleanBase, model: name };
      saveLocalModel(next);
      setSaved(next);
      onAccount(await setModelSource({ data: "local" }));
      toast.success(`Composer uses ${name} on this computer`);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not switch");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">A model on this computer</p>
          <p className="mt-1 max-w-xl text-sm text-pretty text-subtle">
            Ollama or LM Studio, called from this browser tab. A turn goes from this page straight to your machine, not
            through Aperture&apos;s server, so it works on the hosted site and costs nothing. The address is kept in this
            browser only.
          </p>
        </div>
        {selected ? (
          <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok">Selected</span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {LOCAL_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setBase(preset.base);
              setModels(null);
              setError(null);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveAndUse();
        }}
      >
        <label className="block text-xs text-subtle">
          Address
          <div className="mt-1 flex gap-2">
            <Input
              value={base}
              onChange={(event) => {
                setBase(event.target.value);
                setModels(null);
                setError(null);
              }}
              spellCheck={false}
              autoComplete="off"
              placeholder={LOCAL_DEFAULT_BASE}
              className="font-mono"
              aria-invalid={!cleanBase}
            />
            <Button type="button" variant="outline" disabled={!cleanBase || busy !== null} onClick={() => void connect()}>
              {busy === "connect" ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </label>
        {!cleanBase && (
          <p className="text-xs text-danger">Use an address on this computer: localhost, 127.0.0.1 or ::1.</p>
        )}
        <label className="block text-xs text-subtle">
          Model
          {models && models.length > 0 ? (
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg"
            >
              {models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="qwen2.5-coder:7b"
              className="mt-1 font-mono"
            />
          )}
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" disabled={busy !== null || !cleanBase || !cleanLocalModel(model)} className="sm:w-40">
            {busy === "save" ? "Saving…" : selected ? "Save" : "Save and use"}
          </Button>
          {selected ? <span className="text-xs text-subtle">Composer is using this model.</span> : null}
        </div>
      </form>

      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-subtle">
        <p className="text-muted">Let this page reach your model:</p>
        <p>
          Ollama in a terminal: <code className="font-mono text-fg">OLLAMA_ORIGINS={origin} ollama serve</code>
        </p>
        <p>
          Ollama app on a Mac: <code className="font-mono text-fg">launchctl setenv OLLAMA_ORIGINS &quot;{origin}&quot;</code>, then
          quit and reopen Ollama.
        </p>
        <p>LM Studio: turn on CORS in the Developer tab&apos;s server settings.</p>
        <p>
          If the browser asks to let this site reach devices on your network, allow it. Pick a model that can call tools,
          such as qwen2.5-coder or llama3.1: Composer reads and edits files through tools.
        </p>
      </div>
    </div>
  );
}
