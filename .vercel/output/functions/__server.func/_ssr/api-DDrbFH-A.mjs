import { a as planById, i as isProvider, r as isModelSource } from "./plans-DGQaVOnT.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware--02wTOzZ.mjs";
import { t as MAX_SESSION_CENTS } from "./cost-ClHSqIUc.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-DDrbFH-A.js
var PROVIDER_COLS = {
	grok: "grok_key",
	openai: "openai_key",
	anthropic: "anthropic_key"
};
function monthStamp() {
	const d = /* @__PURE__ */ new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dayStamp() {
	const d = /* @__PURE__ */ new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function asBool(value, fallback = true) {
	if (value === false || value === 0 || value === "0" || value === "f" || value === "false") return false;
	if (value === true || value === 1 || value === "1" || value === "t" || value === "true") return true;
	return fallback;
}
function asInt(value, fallback) {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
async function peek() {
	return import("./secrets.server-tdshO19Z.mjs");
}
async function loadSettings(userId) {
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const month = monthStamp();
	const day = dayStamp();
	const existing = await sql`
    select plan, preferred_provider, model_source, grok_key, openai_key, anthropic_key,
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
			hosted_used: 0,
			usage_month: month,
			session_cap_on: true,
			session_cap_turns: 8,
			session_cap_cents: 100,
			session_id: null,
			session_turns: 0,
			session_cents: 0,
			tab_used: 0,
			tab_day: day
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
		const inferred = row.preferred_provider === "openai" && row.openai_key ? "openai" : row.preferred_provider === "anthropic" && row.anthropic_key ? "anthropic" : row.grok_key ? "grok" : "hosted";
		row.model_source = inferred;
		await sql`update user_settings set model_source = ${inferred}, updated_at = now() where user_id = ${userId}`;
	}
	await migratePlaintextKeys(userId, row);
	return row;
}
async function migratePlaintextKeys(userId, row) {
	const { encryptSecret, isEncryptedSecret } = await peek();
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	for (const col of [
		"grok_key",
		"openai_key",
		"anthropic_key"
	]) {
		const value = row[col];
		if (!value || isEncryptedSecret(value)) continue;
		const wrapped = encryptSecret(value);
		row[col] = wrapped;
		if (col === "grok_key") await sql`update user_settings set grok_key = ${wrapped}, updated_at = now() where user_id = ${userId}`;
		else if (col === "openai_key") await sql`update user_settings set openai_key = ${wrapped}, updated_at = now() where user_id = ${userId}`;
		else await sql`update user_settings set anthropic_key = ${wrapped}, updated_at = now() where user_id = ${userId}`;
	}
}
function snapshot(row, peekLast4) {
	const plan = planById(row.plan);
	const keys = {
		grok: {
			set: Boolean(row.grok_key),
			last4: peekLast4(row.grok_key)
		},
		openai: {
			set: Boolean(row.openai_key),
			last4: peekLast4(row.openai_key)
		},
		anthropic: {
			set: Boolean(row.anthropic_key),
			last4: peekLast4(row.anthropic_key)
		}
	};
	const keyCount = Object.values(keys).filter((k) => k.set).length;
	const modelSource = isModelSource(row.model_source ?? "") ? row.model_source : "hosted";
	const preferred = isProvider(row.preferred_provider) ? row.preferred_provider : "grok";
	const capTurns = Math.min(80, Math.max(1, asInt(row.session_cap_turns, 8)));
	const capCents = Math.min(MAX_SESSION_CENTS, Math.max(25, asInt(row.session_cap_cents, 100)));
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
			cents: Math.max(0, asInt(row.session_cents, 0))
		}
	};
}
async function snapshotOf(row) {
	const { peekLast4 } = await peek();
	return snapshot(row, peekLast4);
}
async function applyModelSource(userId, source) {
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	await loadSettings(userId);
	await sql`
    update user_settings
    set model_source = ${source}, preferred_provider = ${source === "hosted" ? "grok" : source}, updated_at = now()
    where user_id = ${userId}
  `;
	return snapshotOf(await loadSettings(userId));
}
var getAccount_createServerFn_handler = createServerRpc({
	id: "28565cc805871003787c42c251e781dd40870f168a3cb9207da7385f4430af0f",
	name: "getAccount",
	filename: "src/lib/billing/api.ts"
}, (opts) => getAccount.__executeServer(opts));
var getAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(getAccount_createServerFn_handler, async ({ context }) => {
	return snapshotOf(await loadSettings(context.userId));
});
var setPlan_createServerFn_handler = createServerRpc({
	id: "29ce13130f1898b8e7a7939888f0c09e3e314a32c0b35211b822ebdb3a7de6ff",
	name: "setPlan",
	filename: "src/lib/billing/api.ts"
}, (opts) => setPlan.__executeServer(opts));
var setPlan = createServerFn({ method: "POST" }).validator((plan) => plan).middleware([authMiddleware]).handler(setPlan_createServerFn_handler, async ({ context, data: plan }) => {
	if (plan !== "hobby" && plan !== "pro" && plan !== "team") throw new Error("Unknown plan");
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	await loadSettings(context.userId);
	await sql`
      update user_settings
      set plan = ${plan}, updated_at = now()
      where user_id = ${context.userId}
    `;
	return snapshotOf(await loadSettings(context.userId));
});
var saveProviderKey_createServerFn_handler = createServerRpc({
	id: "3f8c078e9c4bd1a83d19be722752350df53900760e1db0eb99a861624f86a028",
	name: "saveProviderKey",
	filename: "src/lib/billing/api.ts"
}, (opts) => saveProviderKey.__executeServer(opts));
var saveProviderKey = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(saveProviderKey_createServerFn_handler, async ({ context, data }) => {
	if (!isProvider(data.provider)) throw new Error("Unknown provider");
	const { encryptSecret, validateProviderKey } = await peek();
	const row = await loadSettings(context.userId);
	const plan = planById(row.plan);
	const col = PROVIDER_COLS[data.provider];
	const trimmed = data.key.trim();
	const currentlySet = Boolean(row[col]);
	const keyCount = [
		row.grok_key,
		row.openai_key,
		row.anthropic_key
	].filter(Boolean).length;
	if (trimmed && !currentlySet && keyCount >= plan.byokSlots) throw new Error(`Your ${plan.name} plan allows ${plan.byokSlots} key${plan.byokSlots === 1 ? "" : "s"}. Upgrade to add more.`);
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const value = trimmed.length === 0 ? null : encryptSecret(validateProviderKey(data.provider, trimmed));
	if (col === "grok_key") await sql`update user_settings set grok_key = ${value}, updated_at = now() where user_id = ${context.userId}`;
	else if (col === "openai_key") await sql`update user_settings set openai_key = ${value}, updated_at = now() where user_id = ${context.userId}`;
	else await sql`update user_settings set anthropic_key = ${value}, updated_at = now() where user_id = ${context.userId}`;
	return snapshotOf(await loadSettings(context.userId));
});
var setModelSource_createServerFn_handler = createServerRpc({
	id: "604b993a9f98e3c4eab4064503ec36787cadf99a3564732e53d5d1089322903a",
	name: "setModelSource",
	filename: "src/lib/billing/api.ts"
}, (opts) => setModelSource.__executeServer(opts));
var setModelSource = createServerFn({ method: "POST" }).validator((source) => source).middleware([authMiddleware]).handler(setModelSource_createServerFn_handler, async ({ context, data: source }) => {
	if (!isModelSource(source)) throw new Error("Unknown model");
	return applyModelSource(context.userId, source);
});
var setPreferredProvider_createServerFn_handler = createServerRpc({
	id: "0c9c020c7e62001e8606b3cb7310aad6f3f5a732b4e2bdd397ea375f749a5818",
	name: "setPreferredProvider",
	filename: "src/lib/billing/api.ts"
}, (opts) => setPreferredProvider.__executeServer(opts));
var setPreferredProvider = createServerFn({ method: "POST" }).validator((provider) => provider).middleware([authMiddleware]).handler(setPreferredProvider_createServerFn_handler, async ({ context, data: provider }) => {
	if (!isProvider(provider)) throw new Error("Unknown provider");
	return applyModelSource(context.userId, provider);
});
var setSessionCap_createServerFn_handler = createServerRpc({
	id: "f1ba1e94692ccaec60d102aa8a6c773659dd97596bc81e2ff9cd0d4419816f86",
	name: "setSessionCap",
	filename: "src/lib/billing/api.ts"
}, (opts) => setSessionCap.__executeServer(opts));
var setSessionCap = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(setSessionCap_createServerFn_handler, async ({ context, data }) => {
	const turns = Math.min(80, Math.max(1, Math.trunc(data.turns) || 8));
	const cents = Math.min(MAX_SESSION_CENTS, Math.max(25, Math.trunc(data.cents) || 100));
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	await loadSettings(context.userId);
	await sql`
      update user_settings
      set session_cap_on = ${data.on}, session_cap_turns = ${turns}, session_cap_cents = ${cents}, updated_at = now()
      where user_id = ${context.userId}
    `;
	return snapshotOf(await loadSettings(context.userId));
});
var resetSession_createServerFn_handler = createServerRpc({
	id: "458d36602722e1e82251b59da14cca48fc7b30df59f1314a697065224354d054",
	name: "resetSession",
	filename: "src/lib/billing/api.ts"
}, (opts) => resetSession.__executeServer(opts));
var resetSession = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(resetSession_createServerFn_handler, async ({ context }) => {
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	await loadSettings(context.userId);
	await sql`
      update user_settings
      set session_id = ${crypto.randomUUID()}, session_turns = 0, session_cents = 0, session_started_at = now(), updated_at = now()
      where user_id = ${context.userId}
    `;
	return snapshotOf(await loadSettings(context.userId));
});
//#endregion
export { getAccount_createServerFn_handler, resetSession_createServerFn_handler, saveProviderKey_createServerFn_handler, setModelSource_createServerFn_handler, setPlan_createServerFn_handler, setPreferredProvider_createServerFn_handler, setSessionCap_createServerFn_handler };
