import { providerShort, type ModelSource, type ProviderId } from "./plans.ts";

/** Honest typical Composer-send estimates (whole tool loop, not per grep). */
export const TURN_COST_CENTS: Record<ProviderId, number> = {
  grok: 8,
  openai: 12,
  anthropic: 15,
  gemini: 6,
  deepseek: 4,
};

export const DEFAULT_SESSION_TURNS = 8;
export const DEFAULT_SESSION_CENTS = 100;
export const MAX_SESSION_TURNS = 80;
export const MAX_SESSION_CENTS = 2000;
export const MIN_SESSION_TURNS = 1;
export const MIN_SESSION_CENTS = 25;

export type SessionSnapshot = {
  on: boolean;
  capTurns: number;
  capCents: number;
  turns: number;
  cents: number;
};

export type QuoteAccount = {
  remaining: number;
  hostedTurns: number;
  modelSource: ModelSource;
  keys: Record<ProviderId, { set: boolean; last4: string | null }>;
  session: SessionSnapshot;
  /** Set when a custom OpenAI-compatible endpoint is saved. */
  custom?: { base: string | null; model: string | null } | null;
};

export type RunQuote = {
  source: ModelSource;
  hosted: boolean;
  provider: ProviderId;
  cents: number;
  label: string;
  sub: string;
  blocked: boolean;
  blockReason: string | null;
};

/** What a run costs on a replay deployment: nothing, and never blocked by hosted quota. */
export function replayQuote(base: RunQuote): RunQuote {
  return {
    ...base,
    hosted: false,
    cents: 0,
    label: "Replay model",
    sub: "recorded runs · no API call · no cost",
    blocked: false,
    blockReason: null,
  };
}

export function formatUsd(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export function estimateCents(source: ModelSource): number {
  if (source === "hosted" || source === "custom") return 0;
  return TURN_COST_CENTS[source];
}

export function quoteRun(account: QuoteAccount | null, source?: ModelSource): RunQuote {
  const src = source ?? account?.modelSource ?? "hosted";
  if (src === "custom") {
    const ready = Boolean(account?.custom?.base && account.custom.model);
    const model = account?.custom?.model;
    return {
      source: "custom",
      hosted: false,
      provider: "grok",
      cents: 0,
      label: model ? `Custom · ${model}` : "Custom endpoint",
      sub: ready ? "you pay the host · no hosted turn" : "Set the endpoint in Settings",
      blocked: !account || !ready,
      blockReason: !account
        ? null
        : ready
          ? null
          : "Set an Ollama, LM Studio, or OpenRouter endpoint in Settings.",
    };
  }
  const provider: ProviderId = src === "hosted" ? "grok" : src;
  const hosted = src === "hosted";
  const cents = estimateCents(src);

  if (!account) {
    return {
      source: src,
      hosted,
      provider,
      cents,
      label: hosted ? "This run = 1 hosted turn" : `on your ${providerShort(provider)} key, ~${formatUsd(cents)}`,
      sub: "Sign in to send",
      blocked: true,
      blockReason: null,
    };
  }

  const session = account.session;
  let blocked = false;
  let blockReason: string | null = null;

  if (hosted) {
    if (account.remaining <= 0) {
      blocked = true;
      blockReason = `Hosted Grok is used (${account.hostedTurns}/${account.hostedTurns} this month). Switch to your own key or upgrade.`;
    } else if (session.on && session.turns >= session.capTurns) {
      blocked = true;
      blockReason = `Session cap reached (${session.capTurns} hosted turns). Raise it in Settings — the runaway hour cannot happen here.`;
    }
  } else if (!account.keys[src]?.set) {
    blocked = true;
    blockReason = `Add a ${providerShort(src)} key in Settings, or switch to Hosted Grok.`;
  } else if (session.on && session.cents + cents > session.capCents) {
    blocked = true;
    blockReason = `Session cap reached (${formatUsd(session.capCents)} on your keys). Raise it in Settings.`;
  }

  if (hosted) {
    return {
      source: src,
      hosted: true,
      provider: "grok",
      cents: 0,
      label: "This run = 1 hosted turn",
      sub: session.on
        ? `session ${session.turns}/${session.capTurns} · ${account.remaining} left this month`
        : `${account.remaining} hosted left this month`,
      blocked,
      blockReason,
    };
  }

  const name = providerShort(src);
  const last4 = account.keys[src]?.last4;
  return {
    source: src,
    hosted: false,
    provider: src,
    cents,
    label: `on your ${name} key, ~${formatUsd(cents)}`,
    sub: session.on
      ? `session ${formatUsd(session.cents)} / ${formatUsd(session.capCents)}${last4 ? ` · ···${last4}` : ""}`
      : `your provider bills this${last4 ? ` · ···${last4}` : ""}`,
    blocked,
    blockReason,
  };
}

export function quoteRuns(
  account: QuoteAccount | null,
  source: ModelSource | undefined,
  n: number,
): RunQuote {
  const count = Math.max(1, Math.trunc(n) || 1);
  const one = quoteRun(account, source);
  if (count === 1) return one;

  const cents = one.cents * count;
  const label = one.hosted
    ? `This build = ${count} hosted turns`
    : one.source === "custom"
      ? `Custom endpoint · ${count} calls`
      : `on your ${providerShort(one.provider)} key, ~${formatUsd(cents)}`;

  if (!account) {
    return { ...one, cents, label, sub: "Sign in to send", blocked: true, blockReason: null };
  }

  let blocked = one.blocked;
  let blockReason = one.blockReason;
  if (one.hosted) {
    if (account.remaining < count) {
      blocked = true;
      blockReason = `Need ${count} hosted turns (${account.remaining} left this month).`;
    } else if (account.session.on && account.session.turns + count > account.session.capTurns) {
      blocked = true;
      blockReason = `Need ${count} hosted turns; session cap is ${account.session.capTurns}.`;
    } else if (!one.blocked) {
      blocked = false;
      blockReason = null;
    }
  } else if (
    !one.blocked &&
    account.session.on &&
    account.session.cents + cents > account.session.capCents
  ) {
    blocked = true;
    blockReason = `Need ~${formatUsd(cents)}; session cap is ${formatUsd(account.session.capCents)}.`;
  }

  return { ...one, cents, label, blocked, blockReason };
}
