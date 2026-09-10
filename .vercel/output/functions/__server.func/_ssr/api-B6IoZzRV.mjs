import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { a as planById, i as isProvider, r as isModelSource } from "./plans-DGQaVOnT.mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware--02wTOzZ.mjs";
import { n as estimateCents, t as MAX_SESSION_CENTS } from "./cost-ClHSqIUc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-B6IoZzRV.js
var api_B6IoZzRV_exports = /* @__PURE__ */ __exportAll({
	a: () => setModelSource,
	c: () => createSsrRpc,
	i: () => saveProviderKey,
	n: () => getAccount,
	o: () => setPlan,
	r: () => resetSession,
	s: () => setSessionCap,
	t: () => api_exports
});
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var api_exports = /* @__PURE__ */ __exportAll$1({
	consumeHostedTurn: () => consumeHostedTurn,
	getAccount: () => getAccount,
	recordAgentRun: () => recordAgentRun,
	recordTabUse: () => recordTabUse,
	resetSession: () => resetSession,
	resolveModel: () => resolveModel,
	resolveTabModel: () => resolveTabModel,
	saveProviderKey: () => saveProviderKey,
	setModelSource: () => setModelSource,
	setPlan: () => setPlan,
	setSessionCap: () => setSessionCap
});
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
var getAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("28565cc805871003787c42c251e781dd40870f168a3cb9207da7385f4430af0f"));
var setPlan = createServerFn({ method: "POST" }).validator((plan) => plan).middleware([authMiddleware]).handler(createSsrRpc("29ce13130f1898b8e7a7939888f0c09e3e314a32c0b35211b822ebdb3a7de6ff"));
var saveProviderKey = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("3f8c078e9c4bd1a83d19be722752350df53900760e1db0eb99a861624f86a028"));
var setModelSource = createServerFn({ method: "POST" }).validator((source) => source).middleware([authMiddleware]).handler(createSsrRpc("604b993a9f98e3c4eab4064503ec36787cadf99a3564732e53d5d1089322903a"));
createServerFn({ method: "POST" }).validator((provider) => provider).middleware([authMiddleware]).handler(createSsrRpc("0c9c020c7e62001e8606b3cb7310aad6f3f5a732b4e2bdd397ea375f749a5818"));
var setSessionCap = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("f1ba1e94692ccaec60d102aa8a6c773659dd97596bc81e2ff9cd0d4419816f86"));
var resetSession = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("458d36602722e1e82251b59da14cca48fc7b30df59f1314a697065224354d054"));
async function resolveModel(userId, requested) {
	const { decryptSecret } = await peek();
	const row = await loadSettings(userId);
	const account = await snapshotOf(row);
	const source = requested && isModelSource(requested) ? requested : account.modelSource;
	if (source === "hosted") {
		const hosted = process.env.XAI_API_KEY;
		if (!hosted) return {
			ok: false,
			error: "Hosted Grok is not available. Attach your own key in Settings."
		};
		if (account.remaining <= 0) return {
			ok: false,
			error: `Hosted Grok quota is used (${account.hostedTurns}/${account.hostedTurns} this month). Switch to your own key or upgrade.`
		};
		const cap = sessionBlock(account, true, 0);
		if (cap) return {
			ok: false,
			error: cap
		};
		return {
			ok: true,
			provider: "grok",
			apiKey: hosted,
			hosted: true,
			source: "hosted",
			cents: 0
		};
	}
	const own = decryptSecret(row[PROVIDER_COLS[source]]);
	if (!own) return {
		ok: false,
		error: `No ${source === "openai" ? "GPT" : source === "anthropic" ? "Claude" : "Grok"} key on this account. Add one in Settings — we never silently switch models.`
	};
	const cents = estimateCents(source);
	const cap = sessionBlock(account, false, cents);
	if (cap) return {
		ok: false,
		error: cap
	};
	return {
		ok: true,
		provider: source,
		apiKey: own,
		hosted: false,
		source,
		cents
	};
}
async function resolveTabModel(userId) {
	const { decryptSecret } = await peek();
	const row = await loadSettings(userId);
	const account = await snapshotOf(row);
	if (!account.tab) return {
		ok: false,
		error: "Tab ghost-text is on Pro."
	};
	const source = account.modelSource;
	if (source !== "hosted") {
		const own = decryptSecret(row[PROVIDER_COLS[source]]);
		if (own) return {
			ok: true,
			provider: source,
			apiKey: own,
			hosted: false,
			source,
			cents: 0
		};
	}
	const hosted = process.env.XAI_API_KEY;
	if (!hosted) return {
		ok: false,
		error: "Tab is unavailable."
	};
	if (account.tabRemaining <= 0) return {
		ok: false,
		error: "Hosted Tab is used for today. Attach your own key — Tab on your key is uncapped."
	};
	return {
		ok: true,
		provider: "grok",
		apiKey: hosted,
		hosted: true,
		source: "hosted",
		cents: 0
	};
}
function sessionBlock(account, hosted, cents) {
	const session = account.session;
	if (!session.on) return null;
	if (hosted && session.turns >= session.capTurns) return `Session cap reached (${session.capTurns} hosted turns). Raise it in Settings — we stop instead of running away.`;
	if (!hosted && session.cents + cents > session.capCents) return `Session cap reached (${formatCap(session.capCents)} on your keys). Raise it in Settings.`;
	return null;
}
function formatCap(cents) {
	return `$${(cents / 100).toFixed(2)}`;
}
async function consumeHostedTurn(userId) {
	const row = await loadSettings(userId);
	const plan = planById(row.plan);
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	await (await getSql())`
    update user_settings
    set hosted_used = hosted_used + 1, updated_at = now()
    where user_id = ${userId} and hosted_used < ${plan.hostedTurns}
  `;
}
async function recordTabUse(userId, hosted) {
	if (!hosted) return;
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
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
async function recordAgentRun(userId, hosted, cents) {
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	if (!(await loadSettings(userId)).session_id) await sql`
      update user_settings
      set session_id = ${crypto.randomUUID()}, session_started_at = now(), updated_at = now()
      where user_id = ${userId} and session_id is null
    `;
	if (hosted) {
		await consumeHostedTurn(userId);
		await sql`
      update user_settings
      set session_turns = session_turns + 1, updated_at = now()
      where user_id = ${userId}
    `;
		return;
	}
	await sql`
    update user_settings
    set session_cents = session_cents + ${Math.max(0, Math.trunc(cents) || 0)}, session_turns = session_turns + 1, updated_at = now()
    where user_id = ${userId}
  `;
}
//#endregion
export { saveProviderKey as a, setSessionCap as c, resetSession as i, createSsrRpc as n, setModelSource as o, getAccount as r, setPlan as s, api_B6IoZzRV_exports as t };
