import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  DEFAULT_SESSION_CENTS,
  DEFAULT_SESSION_TURNS,
  MAX_SESSION_CENTS,
  MAX_SESSION_TURNS,
  MIN_SESSION_CENTS,
  MIN_SESSION_TURNS,
  estimateCents,
  type SessionSnapshot,
} from "./cost";
import { isModelSource, isProvider, planById, providerShort, type ModelSource, type PlanId, type ProviderId } from "./plans";

export type KeyStatus = { set: boolean; last4: string | null };

export type AccountSnapshot = {
  plan: PlanId;
  hostedUsed: number;
  hostedTurns: number;
  remaining: number;
  modelSource: ModelSource;
  preferredProvider: ProviderId;
  keys: Record<ProviderId, KeyStatus>;
  byokSlots: number;
  keyCount: number;
  tab: boolean;
  tabCap: number;
  tabUsed: number;
  tabRemaining: number;
  backgroundJobs: number;
  acp: boolean;
  session: SessionSnapshot;
};

const PROVIDER_COLS: Record<ProviderId, "grok_key" | "openai_key" | "anthropic_key" | "gemini_key" | "deepseek_key"> = {
  grok: "grok_key",
  openai: "openai_key",
  anthropic: "anthropic_key",
  gemini: "gemini_key",
  deepseek: "deepseek_key",
};

const KEY_COLS = ["grok_key", "openai_key", "anthropic_key", "gemini_key", "deepseek_key"] as const;
type KeyCol = (typeof KEY_COLS)[number];

async function writeKeyColumn(
  sql: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  userId: string,
  col: KeyCol,
  value: string | null,
) {
  await sql.query(`update user_settings set ${col} = $1, updated_at = now() where user_id = $2`, [value, userId]);
}

function monthStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function asBool(value: unknown, fallback = true): boolean {
  if (value === false || value === 0 || value === "0" || value === "f" || value === "false") return false;
  if (value === true || value === 1 || value === "1" || value === "t" || value === "true") return true;
  return fallback;
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

type SettingsRow = {
  plan: string;
  preferred_provider: string;
  model_source: string | null;
  grok_key: string | null;
  openai_key: string | null;
  anthropic_key: string | null;
  gemini_key: string | null;
  deepseek_key: string | null;
  hosted_used: number;
  usage_month: string;
  session_cap_on: unknown;
  session_cap_turns: unknown;
  session_cap_cents: unknown;
  session_id: string | null;
  session_turns: unknown;
  session_cents: unknown;
  tab_used: unknown;
  tab_day: string | null;
};

async function peek() {
  return import("@/lib/security/secrets.server");
}

async function loadSettings(userId: string): Promise<SettingsRow> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const month = monthStamp();
  const day = dayStamp();
  const existing = await sql<SettingsRow>`
    select plan, preferred_provider, model_source, grok_key, openai_key, anthropic_key, gemini_key, deepseek_key,
           hosted_used, usage_month, session_cap_on, session_cap_turns, session_cap_cents,
           session_id, session_turns, session_cents, tab_used, tab_day
    from user_settings where user_id = ${userId}
  `;
  if (!existing[0]) {
    await sql`
      insert into user_settings (user_id, plan, usage_month, model_source, tab_day)
      values (${userId}, 'hobby', ${month}, 'hosted', ${day})
    `;
    return {
      plan: "hobby",
      preferred_provider: "grok",
      model_source: "hosted",
      grok_key: null,
      openai_key: null,
      anthropic_key: null,
      gemini_key: null,
      deepseek_key: null,
      hosted_used: 0,
      usage_month: month,
      session_cap_on: true,
      session_cap_turns: DEFAULT_SESSION_TURNS,
      session_cap_cents: DEFAULT_SESSION_CENTS,
      session_id: null,
      session_turns: 0,
      session_cents: 0,
      tab_used: 0,
      tab_day: day,
    };
  }
  const row = existing[0];
  if (row.usage_month !== month) {
    await sql`
      update user_settings
      set hosted_used = 0, usage_month = ${month}, updated_at = now()
      where user_id = ${userId}
    `;
    row.hosted_used = 0;
    row.usage_month = month;
  }
  if (row.tab_day !== day) {
    await sql`
      update user_settings
      set tab_used = 0, tab_day = ${day}, updated_at = now()
      where user_id = ${userId}
    `;
    row.tab_used = 0;
    row.tab_day = day;
  }
  if (!row.model_source) {
    const preferred = row.preferred_provider;
    const inferred: ModelSource =
      isProvider(preferred) && row[PROVIDER_COLS[preferred]]
        ? preferred
        : row.grok_key
          ? "grok"
          : "hosted";
    row.model_source = inferred;
    await sql`update user_settings set model_source = ${inferred}, updated_at = now() where user_id = ${userId}`;
  }
  await migratePlaintextKeys(userId, row);
  return row;
}

async function migratePlaintextKeys(userId: string, row: SettingsRow) {
  const { encryptSecret, isEncryptedSecret } = await peek();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  for (const col of KEY_COLS) {
    const value = row[col];
    if (!value || isEncryptedSecret(value)) continue;
    const wrapped = encryptSecret(value);
    row[col] = wrapped;
    await writeKeyColumn(sql, userId, col, wrapped);
  }
}

function snapshot(row: SettingsRow, peekLast4: (stored: string | null) => string | null): AccountSnapshot {
  const plan = planById(row.plan);
  const keys: Record<ProviderId, KeyStatus> = {
    grok: { set: Boolean(row.grok_key), last4: peekLast4(row.grok_key) },
    openai: { set: Boolean(row.openai_key), last4: peekLast4(row.openai_key) },
    anthropic: { set: Boolean(row.anthropic_key), last4: peekLast4(row.anthropic_key) },
    gemini: { set: Boolean(row.gemini_key), last4: peekLast4(row.gemini_key) },
    deepseek: { set: Boolean(row.deepseek_key), last4: peekLast4(row.deepseek_key) },
  };
  const keyCount = Object.values(keys).filter((k) => k.set).length;
  const modelSource: ModelSource = isModelSource(row.model_source ?? "") ? (row.model_source as ModelSource) : "hosted";
  const preferred: ProviderId = isProvider(row.preferred_provider) ? row.preferred_provider : "grok";
  const capTurns = Math.min(
    MAX_SESSION_TURNS,
    Math.max(MIN_SESSION_TURNS, asInt(row.session_cap_turns, DEFAULT_SESSION_TURNS)),
  );
  const capCents = Math.min(
    MAX_SESSION_CENTS,
    Math.max(MIN_SESSION_CENTS, asInt(row.session_cap_cents, DEFAULT_SESSION_CENTS)),
  );
  const tabUsed = Math.max(0, asInt(row.tab_used, 0));
  return {
    plan: plan.id,
    hostedUsed: row.hosted_used,
    hostedTurns: plan.hostedTurns,
    remaining: Math.max(0, plan.hostedTurns - row.hosted_used),
    modelSource,
    preferredProvider: preferred,
    keys,
    byokSlots: plan.byokSlots,
    keyCount,
    tab: plan.tab,
    tabCap: plan.tabDaily,
    tabUsed,
    tabRemaining: Math.max(0, plan.tabDaily - tabUsed),
    backgroundJobs: plan.backgroundJobs,
    acp: plan.acp,
    session: {
      on: asBool(row.session_cap_on, true),
      capTurns,
      capCents,
      turns: Math.max(0, asInt(row.session_turns, 0)),
      cents: Math.max(0, asInt(row.session_cents, 0)),
    },
  };
}

async function snapshotOf(row: SettingsRow): Promise<AccountSnapshot> {
  const { peekLast4 } = await peek();
  return snapshot(row, peekLast4);
}

async function applyModelSource(userId: string, source: ModelSource): Promise<AccountSnapshot> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await loadSettings(userId);
  const preferred: ProviderId = source === "hosted" ? "grok" : source;
  await sql`
    update user_settings
    set model_source = ${source}, preferred_provider = ${preferred}, updated_at = now()
    where user_id = ${userId}
  `;
  return snapshotOf(await loadSettings(userId));
}

export const getAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AccountSnapshot> => {
    const row = await loadSettings(context.userId);
    return snapshotOf(row);
  });

export const setPlan = createServerFn({ method: "POST" })
  .validator((plan: PlanId) => plan)
  .middleware([authMiddleware])
  .handler(async ({ context, data: plan }): Promise<AccountSnapshot> => {
    if (plan !== "hobby" && plan !== "pro" && plan !== "team") {
      throw new Error("Unknown plan");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await loadSettings(context.userId);
    await sql`
      update user_settings
      set plan = ${plan}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return snapshotOf(await loadSettings(context.userId));
  });

export const saveProviderKey = createServerFn({ method: "POST" })
  .validator((input: { provider: ProviderId; key: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<AccountSnapshot> => {
    if (!isProvider(data.provider)) throw new Error("Unknown provider");
    const { encryptSecret, validateProviderKey } = await peek();
    const row = await loadSettings(context.userId);
    const plan = planById(row.plan);
    const col = PROVIDER_COLS[data.provider];
    const trimmed = data.key.trim();
    const currentlySet = Boolean(row[col]);
    const keyCount = KEY_COLS.filter((c) => row[c]).length;
    if (trimmed && !currentlySet && keyCount >= plan.byokSlots) {
      throw new Error(`Your ${plan.name} plan allows ${plan.byokSlots} key${plan.byokSlots === 1 ? "" : "s"}. Upgrade to add more.`);
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const value = trimmed.length === 0 ? null : encryptSecret(validateProviderKey(data.provider, trimmed));
    await writeKeyColumn(sql, context.userId, col, value);
    return snapshotOf(await loadSettings(context.userId));
  });

export const setModelSource = createServerFn({ method: "POST" })
  .validator((source: ModelSource) => source)
  .middleware([authMiddleware])
  .handler(async ({ context, data: source }): Promise<AccountSnapshot> => {
    if (!isModelSource(source)) throw new Error("Unknown model");
    return applyModelSource(context.userId, source);
  });

export const setPreferredProvider = createServerFn({ method: "POST" })
  .validator((provider: ProviderId) => provider)
  .middleware([authMiddleware])
  .handler(async ({ context, data: provider }): Promise<AccountSnapshot> => {
    if (!isProvider(provider)) throw new Error("Unknown provider");
    return applyModelSource(context.userId, provider);
  });

export const setSessionCap = createServerFn({ method: "POST" })
  .validator((input: { on: boolean; turns: number; cents: number }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<AccountSnapshot> => {
    const turns = Math.min(MAX_SESSION_TURNS, Math.max(MIN_SESSION_TURNS, Math.trunc(data.turns) || DEFAULT_SESSION_TURNS));
    const cents = Math.min(MAX_SESSION_CENTS, Math.max(MIN_SESSION_CENTS, Math.trunc(data.cents) || DEFAULT_SESSION_CENTS));
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await loadSettings(context.userId);
    await sql`
      update user_settings
      set session_cap_on = ${data.on}, session_cap_turns = ${turns}, session_cap_cents = ${cents}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return snapshotOf(await loadSettings(context.userId));
  });

export const resetSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AccountSnapshot> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await loadSettings(context.userId);
    const id = crypto.randomUUID();
    await sql`
      update user_settings
      set session_id = ${id}, session_turns = 0, session_cents = 0, session_started_at = now(), updated_at = now()
      where user_id = ${context.userId}
    `;
    return snapshotOf(await loadSettings(context.userId));
  });

export type ResolvedModel =
  | { ok: true; provider: ProviderId; apiKey: string; hosted: boolean; source: ModelSource; cents: number }
  | { ok: false; error: string };

export async function resolveModel(userId: string, requested?: ModelSource | null): Promise<ResolvedModel> {
  const { decryptSecret } = await peek();
  const row = await loadSettings(userId);
  const account = await snapshotOf(row);
  const source: ModelSource = requested && isModelSource(requested) ? requested : account.modelSource;

  if (source === "hosted") {
    const hosted = process.env.XAI_API_KEY;
    if (!hosted) {
      return { ok: false, error: "Hosted Grok is not available. Attach your own key in Settings." };
    }
    if (account.remaining <= 0) {
      return {
        ok: false,
        error: `Hosted Grok quota is used (${account.hostedTurns}/${account.hostedTurns} this month). Switch to your own key or upgrade.`,
      };
    }
    const cap = sessionBlock(account, true, 0);
    if (cap) return { ok: false, error: cap };
    return { ok: true, provider: "grok", apiKey: hosted, hosted: true, source: "hosted", cents: 0 };
  }

  const own = decryptSecret(row[PROVIDER_COLS[source]]);
  if (!own) {
    return {
      ok: false,
      error: `No ${providerShort(source)} key on this account. Add one in Settings — we never silently switch models.`,
    };
  }
  const cents = estimateCents(source);
  const cap = sessionBlock(account, false, cents);
  if (cap) return { ok: false, error: cap };
  return { ok: true, provider: source, apiKey: own, hosted: false, source, cents };
}

export async function resolveTabModel(userId: string): Promise<ResolvedModel> {
  const { decryptSecret } = await peek();
  const row = await loadSettings(userId);
  const account = await snapshotOf(row);
  if (!account.tab) {
    return { ok: false, error: "Tab ghost-text is on Pro." };
  }
  const source = account.modelSource;
  if (source !== "hosted") {
    const own = decryptSecret(row[PROVIDER_COLS[source]]);
    if (own) {
      return { ok: true, provider: source, apiKey: own, hosted: false, source, cents: 0 };
    }
  }
  const hosted = process.env.XAI_API_KEY;
  if (!hosted) {
    return { ok: false, error: "Tab is unavailable." };
  }
  if (account.tabRemaining <= 0) {
    return {
      ok: false,
      error: "Hosted Tab is used for today. Attach your own key — Tab on your key is uncapped.",
    };
  }
  return { ok: true, provider: "grok", apiKey: hosted, hosted: true, source: "hosted", cents: 0 };
}

function sessionBlock(account: AccountSnapshot, hosted: boolean, cents: number): string | null {
  const session = account.session;
  if (!session.on) return null;
  if (hosted && session.turns >= session.capTurns) {
    return `Session cap reached (${session.capTurns} hosted turns). Raise it in Settings — we stop instead of running away.`;
  }
  if (!hosted && session.cents + cents > session.capCents) {
    return `Session cap reached (${formatCap(session.capCents)} on your keys). Raise it in Settings.`;
  }
  void cents;
  return null;
}

function formatCap(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function consumeHostedTurn(userId: string) {
  const row = await loadSettings(userId);
  const plan = planById(row.plan);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    update user_settings
    set hosted_used = hosted_used + 1, updated_at = now()
    where user_id = ${userId} and hosted_used < ${plan.hostedTurns}
  `;
}

export async function recordTabUse(userId: string, hosted: boolean) {
  if (!hosted) return;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const row = await loadSettings(userId);
  const plan = planById(row.plan);
  if (plan.tabDaily <= 0) return;
  await sql`
    update user_settings
    set tab_used = tab_used + 1, updated_at = now()
    where user_id = ${userId} and tab_used < ${plan.tabDaily}
  `;
}

export async function recordAgentRun(userId: string, hosted: boolean, cents: number) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const row = await loadSettings(userId);
  if (!row.session_id) {
    const id = crypto.randomUUID();
    await sql`
      update user_settings
      set session_id = ${id}, session_started_at = now(), updated_at = now()
      where user_id = ${userId} and session_id is null
    `;
  }
  if (hosted) {
    await consumeHostedTurn(userId);
    await sql`
      update user_settings
      set session_turns = session_turns + 1, updated_at = now()
      where user_id = ${userId}
    `;
    return;
  }
  const add = Math.max(0, Math.trunc(cents) || 0);
  await sql`
    update user_settings
    set session_cents = session_cents + ${add}, session_turns = session_turns + 1, updated_at = now()
    where user_id = ${userId}
  `;
}
