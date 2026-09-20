import { o as __toESM } from "../_runtime.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, v as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as signIn, t as authClient } from "./client-BXBOTlUB.mjs";
import { t as GROK_PROVIDERS } from "./server-BInRgz1J.mjs";
import { r as Button, s as useCurrentUserState, t as ApertureMark } from "./auth-slot-DeaQUz9w.mjs";
import { i as Input, r as Route$5 } from "./router-DD9YiLP-.mjs";
import { t as SiteNav } from "./site-nav-gLpqlr2d.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-nFSs0-aZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const { next } = Route$5.useSearch();
	const { user, isPending } = useCurrentUserState();
	const [mode, setMode] = (0, import_react.useState)("in");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-24 h-40 max-w-sm animate-pulse rounded-2xl bg-elevated" })]
	});
	if (user) {
		if (next === "/settings") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
			to: "/settings",
			search: { tab: "plan" }
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: next });
	}
	async function onEmail(event) {
		event.preventDefault();
		setError(null);
		setBusy(true);
		try {
			if (mode === "up") {
				const res = await authClient.signUp.email({
					email,
					password,
					name: name || email.split("@")[0]
				});
				if (res.error) throw new Error(res.error.message);
			} else {
				const res = await authClient.signIn.email({
					email,
					password
				});
				if (res.error) throw new Error(res.error.message);
			}
			window.location.assign(next);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign-in failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
			className: "mx-auto grid max-w-md place-items-center px-4 py-16",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full rounded-2xl border border-border bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApertureMark, { className: "size-7" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-4 text-xl font-medium tracking-tight",
						children: "Sign in to Aperture"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "One account for the editor, plans, and API keys."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 flex flex-col gap-2",
						children: GROK_PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							className: "h-11 w-full",
							onClick: () => void signIn(provider.providerId, {
								callbackURL: next,
								errorCallbackURL: "/login"
							}),
							children: ["Continue with ", provider.label]
						}, provider.providerId))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "my-6 flex items-center gap-3 text-[11px] tracking-wide text-subtle uppercase",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" }),
							"Email",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex rounded-lg border border-border p-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `h-10 flex-1 rounded-md text-sm ${mode === "in" ? "bg-elevated text-fg" : "text-muted"}`,
							onClick: () => setMode("in"),
							children: "Sign in"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `h-10 flex-1 rounded-md text-sm ${mode === "up" ? "bg-elevated text-fg" : "text-muted"}`,
							onClick: () => setMode("up"),
							children: "Create account"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "space-y-3",
						onSubmit: (event) => void onEmail(event),
						children: [
							mode === "up" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: name,
								onChange: (event) => setName(event.target.value),
								placeholder: "Name",
								autoComplete: "name"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "email",
								required: true,
								value: email,
								onChange: (event) => setEmail(event.target.value),
								placeholder: "you@studio.dev",
								autoComplete: "email"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "password",
								required: true,
								minLength: 8,
								value: password,
								onChange: (event) => setPassword(event.target.value),
								placeholder: "Password",
								autoComplete: mode === "up" ? "new-password" : "current-password"
							}),
							error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-danger",
								children: error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								className: "h-11 w-full",
								disabled: busy,
								children: busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-center text-xs text-subtle",
						children: [
							"New accounts start on Hobby. Upgrade anytime on",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/pricing",
								className: "text-muted hover:text-fg",
								children: "pricing"
							}),
							"."
						]
					})
				]
			})
		})]
	});
}
//#endregion
export { Login as component };
