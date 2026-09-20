import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
import { a as buttonVariants } from "./auth-slot-DeaQUz9w.mjs";
import { c as useAccount } from "./router-DD9YiLP-.mjs";
import { t as SiteNav } from "./site-nav-gLpqlr2d.mjs";
import { n as SiteFooter, t as PricingTable } from "./pricing-table-DQ9nAlEm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pricing-yBkyqyHQ.js
var import_jsx_runtime = require_jsx_runtime();
function PricingPage() {
	const { account } = useAccount();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto max-w-6xl px-4 py-12 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-center text-xs font-medium tracking-[0.16em] text-subtle uppercase",
						children: "Pricing"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 text-center text-4xl font-medium tracking-tight",
						children: "Choose a plan"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-3 max-w-lg text-center text-muted",
						children: "Hosted Grok is included. Agents are the product on every plan — not an Ultra add-on. You pick the model. There is no Auto."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-10",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingTable, { currentPlan: account?.plan })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto mt-14 max-w-2xl rounded-2xl border border-border bg-surface p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-medium tracking-tight",
								children: "What the plan actually limits"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "mt-3 space-y-2 text-sm leading-relaxed text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Composer, Chat, and Inline on Hobby, Pro, and Team. Nothing waits for Ultra." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "One send = one hosted turn — the whole tool loop, not each grep." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Hosted Grok turns each month — Hobby 50, Pro 500, Team 2,000." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Session cap on by default (8 hosted turns or about $1 on your keys). Raise it in Settings." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "You pick Hosted Grok, or your Grok, GPT, Claude, Gemini, or DeepSeek. No silent Auto." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Tab ghost-text on Pro uses a fast model (250 hosted / day), not grok-4.5 per keystroke. Your own key is uncapped." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Your provider bill is theirs. We do not markup tokens on a key you attached." })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/settings",
								search: { tab: "models" },
								className: cn(buttonVariants({
									variant: "outline",
									size: "sm"
								}), "mt-4"),
								children: "Go to model settings"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { PricingPage as component };
