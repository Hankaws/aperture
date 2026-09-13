import { o as __toESM } from "../_runtime.mjs";
import { t as PLANS } from "./plans-CTIRB29R.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { o as setPlan } from "./api-CT8K4ti-.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
import { a as buttonVariants, i as SignedOut, o as useCurrentUserState, r as Button, t as ApertureMark } from "./auth-slot-TCLjKAfg.mjs";
import { G as Check } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pricing-table-Bteo47lM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SiteFooter() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
		className: "border-t border-border",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center gap-2 text-sm text-subtle",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApertureMark, { className: "size-4" }), "Aperture"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "hover:text-fg",
						children: "Product"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/pricing",
						className: "hover:text-fg",
						children: "Pricing"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/settings",
						search: { tab: "models" },
						className: "hover:text-fg",
						children: "Models"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app",
						className: "hover:text-fg",
						children: "Editor"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedOut, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						search: { next: "/app" },
						className: "hover:text-fg",
						children: "Sign in"
					}) })
				]
			})]
		})
	});
}
function PricingTable({ currentPlan }) {
	const [yearly, setYearly] = (0, import_react.useState)(true);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	async function activate(id) {
		if (isPending) return;
		if (!user) {
			navigate({
				to: "/login",
				search: { next: "/pricing" }
			});
			return;
		}
		setBusy(id);
		try {
			await setPlan({ data: id });
			toast.success(`${id === "hobby" ? "Hobby" : id === "pro" ? "Pro" : "Team"} is active on this account`);
			navigate({
				to: "/settings",
				search: { tab: "plan" }
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not update plan");
		} finally {
			setBusy(null);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-8 flex justify-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex rounded-lg border border-border p-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cn("h-10 rounded-md px-4 text-sm", !yearly ? "bg-elevated text-fg" : "text-muted"),
					onClick: () => setYearly(false),
					children: "Monthly"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cn("h-10 rounded-md px-4 text-sm", yearly ? "bg-elevated text-fg" : "text-muted"),
					onClick: () => setYearly(true),
					children: "Yearly · 20% off"
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-4 md:grid-cols-3",
			children: PLANS.map((plan) => {
				const price = yearly ? plan.yearlyMonthly : plan.monthly;
				const active = currentPlan === plan.id;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: cn("flex flex-col rounded-2xl border bg-surface p-5", plan.featured ? "border-fg/30" : "border-border"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: plan.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: plan.blurb
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-5 font-medium tracking-tight",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-4xl",
								children: ["$", price]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm text-muted",
								children: " / mo"
							})]
						}),
						yearly && plan.monthly > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-subtle",
							children: ["Billed annually at $", price * 12]
						}),
						plan.monthly === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-subtle",
							children: "No card required"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-5 flex flex-1 flex-col gap-2 text-sm text-muted",
							children: plan.features.map((feature) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-4 shrink-0 text-ok" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: feature })]
							}, feature))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-6 h-11 w-full",
							variant: plan.featured ? "default" : "outline",
							disabled: active || busy === plan.id,
							onClick: () => void activate(plan.id),
							children: active ? "Current plan" : busy === plan.id ? "Activating…" : plan.cta
						})
					]
				}, plan.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-6 text-center text-xs text-subtle",
			children: [
				"Preview billing is instant on the account — no card is charged here.",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings",
					search: { tab: "models" },
					className: cn(buttonVariants({
						variant: "ghost",
						size: "sm"
					}), "h-auto px-1"),
					children: "Bring your own key"
				})
			]
		})
	] });
}
//#endregion
export { SiteFooter as n, PricingTable as t };
