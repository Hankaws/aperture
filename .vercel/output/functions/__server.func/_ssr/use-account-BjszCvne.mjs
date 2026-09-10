import { o as __toESM } from "../_runtime.mjs";
import { s as providerShort } from "./plans-DGQaVOnT.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { r as getAccount } from "./api-B6IoZzRV.mjs";
import { o as useCurrentUserState } from "./auth-slot-wt-qTGp_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-account-BjszCvne.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useAccount() {
	const { user, isPending } = useCurrentUserState();
	const [account, setAccount] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)(async () => {
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
