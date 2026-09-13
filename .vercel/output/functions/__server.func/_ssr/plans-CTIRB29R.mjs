import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plans-CTIRB29R.js
var plans_exports = /* @__PURE__ */ __exportAll({
	PLANS: () => PLANS,
	PROVIDERS: () => PROVIDERS,
	isModelSource: () => isModelSource,
	isProvider: () => isProvider,
	planById: () => planById,
	providerShort: () => providerShort
});
var PLANS = [
	{
		id: "hobby",
		name: "Hobby",
		blurb: "The editor and agents, with a small hosted allowance.",
		monthly: 0,
		yearlyMonthly: 0,
		hostedTurns: 50,
		byokSlots: 1,
		tab: false,
		tabDaily: 0,
		backgroundJobs: 0,
		acp: false,
		cta: "Start free",
		features: [
			"Composer, Chat, and Inline — not gated",
			"Plan before the first diff",
			"50 hosted Grok turns / month",
			"One send = one hosted turn",
			"One bring-your-own key",
			"Session cap on by default",
			"Download a zip of the project"
		]
	},
	{
		id: "pro",
		name: "Pro",
		blurb: "Daily hosted Grok, unlimited agents on your keys.",
		monthly: 20,
		yearlyMonthly: 16,
		hostedTurns: 500,
		byokSlots: 5,
		tab: true,
		tabDaily: 250,
		backgroundJobs: 1,
		acp: true,
		featured: true,
		cta: "Activate Pro",
		features: [
			"500 hosted Grok turns / month",
			"Unlimited Composer on your GPT, Claude, Gemini, DeepSeek, Grok keys",
			"You pick the model. No Auto",
			"Tab ghost-text — fast model, 250 hosted / day",
			"One background job",
			"ACP: Claude Code, Codex, OpenCode in the same diffs"
		]
	},
	{
		id: "team",
		name: "Team",
		blurb: "Headroom for people who live in the agent.",
		monthly: 40,
		yearlyMonthly: 32,
		hostedTurns: 2e3,
		byokSlots: 5,
		tab: true,
		tabDaily: 600,
		backgroundJobs: 3,
		acp: true,
		cta: "Activate Team",
		features: [
			"2,000 hosted Grok turns / month",
			"Everything in Pro",
			"Tab ghost-text — 600 hosted / day",
			"Three concurrent background jobs",
			"Usage dashboard and session caps"
		]
	}
];
var PROVIDERS = [
	{
		id: "grok",
		label: "xAI Grok",
		short: "Grok",
		hint: "api.x.ai",
		placeholder: "xai-…"
	},
	{
		id: "openai",
		label: "OpenAI GPT",
		short: "GPT",
		hint: "api.openai.com",
		placeholder: "sk-…"
	},
	{
		id: "anthropic",
		label: "Anthropic Claude",
		short: "Claude",
		hint: "api.anthropic.com",
		placeholder: "sk-ant-…"
	},
	{
		id: "gemini",
		label: "Google Gemini",
		short: "Gemini",
		hint: "aistudio.google.com",
		placeholder: "AIza…"
	},
	{
		id: "deepseek",
		label: "DeepSeek",
		short: "DeepSeek",
		hint: "api.deepseek.com",
		placeholder: "sk-…"
	}
];
function planById(id) {
	return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
function isProvider(value) {
	return PROVIDERS.some((p) => p.id === value);
}
function isModelSource(value) {
	return value === "hosted" || isProvider(value);
}
function providerShort(id) {
	return PROVIDERS.find((p) => p.id === id)?.short ?? id;
}
//#endregion
export { planById as a, isProvider as i, PROVIDERS as n, plans_exports as o, isModelSource as r, providerShort as s, PLANS as t };
