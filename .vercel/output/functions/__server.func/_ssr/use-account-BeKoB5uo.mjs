import { o as __toESM } from "../_runtime.mjs";
import { s as providerShort } from "./plans-CTIRB29R.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { r as getAccount } from "./api-BHHVIIah.mjs";
import { o as useCurrentUserState } from "./auth-slot-DAdQDs8Q.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-account-BeKoB5uo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function sameAccount(a, b) {
	return a.plan === b.plan && a.hostedUsed === b.hostedUsed && a.hostedTurns === b.hostedTurns && a.remaining === b.remaining && a.modelSource === b.modelSource && a.tab === b.tab && a.tabCap === b.tabCap && a.tabUsed === b.tabUsed && a.tabRemaining === b.tabRemaining && a.acp === b.acp && a.backgroundJobs === b.backgroundJobs && a.session.on === b.session.on && a.session.turns === b.session.turns && a.session.cents === b.session.cents && a.session.capTurns === b.session.capTurns && a.session.capCents === b.session.capCents && a.keys.grok.set === b.keys.grok.set && a.keys.openai.set === b.keys.openai.set && a.keys.anthropic.set === b.keys.anthropic.set && a.keys.gemini.set === b.keys.gemini.set && a.keys.deepseek.set === b.keys.deepseek.set;
}
function useAccount() {
	const { user, isPending } = useCurrentUserState();
	const userId = user?.id ?? null;
	const [account, setAccount] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)(async () => {
		if (!userId) {
			setAccount(null);
			return null;
		}
		setLoading(true);
		try {
			const next = await getAccount();
			setAccount((prev) => prev && sameAccount(prev, next) ? prev : next);
			return next;
		} catch {
			setAccount(null);
			return null;
		} finally {
			setLoading(false);
		}
	}, [userId]);
	(0, import_react.useEffect)(() => {
		if (isPending) return;
		refresh();
	}, [isPending, refresh]);
	return {
		account,
		setAccount,
		loading,
		user,
		isPending,
		refresh
	};
}
function modelCaption(account) {
	if (!account) return "Hosted Grok";
	if (account.modelSource === "hosted") return `Hosted Grok · ${account.remaining} left`;
	const name = providerShort(account.modelSource);
	const last4 = account.keys[account.modelSource]?.last4;
	return last4 ? `Your ${name} ···${last4}` : `Your ${name}`;
}
//#endregion
export { useAccount as n, modelCaption as t };
