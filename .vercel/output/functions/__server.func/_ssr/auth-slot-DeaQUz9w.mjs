import { o as __toESM } from "../_runtime.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { n as cn } from "./utils-DTfuEt1f.mjs";
import { a as signOut, t as authClient } from "./client-BXBOTlUB.mjs";
import { a as hasGateSessionMarker } from "./server-BInRgz1J.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-slot-DeaQUz9w.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ApertureMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: cn("text-fg", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M7.2 3.4 16.8 3.4 21.6 12 16.8 20.6 7.2 20.6 2.4 12Z",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinejoin: "round"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "5.1",
				stroke: "currentColor",
				strokeWidth: "1.4"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "2.1",
				fill: "currentColor"
			})
		]
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[transform,background-color,opacity,color] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-40", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg hover:opacity-90",
			ghost: "text-muted hover:bg-elevated hover:text-fg",
			outline: "border border-border bg-transparent text-fg hover:bg-elevated",
			subtle: "bg-elevated text-fg hover:bg-border",
			danger: "bg-danger/15 text-danger hover:bg-danger/25"
		},
		size: {
			sm: "h-8 rounded-md px-3 text-sm",
			md: "h-10 rounded-lg px-4 text-sm",
			lg: "h-12 rounded-xl px-5 text-[15px]",
			icon: "size-10 rounded-lg",
			"icon-sm": "size-8 rounded-md"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "md"
	}
});
function Button({ className, variant, size, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const raw = data?.user;
	return {
		user: (0, import_react.useMemo)(() => {
			if (!raw) return null;
			return {
				id: raw.id,
				displayName: raw.name ?? null,
				primaryEmail: raw.email ?? null,
				profileImageUrl: raw.image ?? null,
				isDevFallback: false
			};
		}, [
			raw?.id,
			raw?.name,
			raw?.email,
			raw?.image
		]),
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/**
* Render children only once we KNOW the visitor is signed out (`isPending` has
* cleared and there is no user). Hidden while the session is still loading.
*/
function SignedOut({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending || user) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton({ compact = false }) {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const [open, setOpen] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	const avatar = user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
		src: user.profileImageUrl,
		alt: "",
		className: "size-7 rounded-full object-cover"
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "grid size-7 place-items-center rounded-full bg-elevated text-xs font-medium text-fg",
		children: label.charAt(0).toUpperCase()
	});
	if (compact) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": label,
			"aria-expanded": open,
			className: "rounded-full",
			onClick: () => setOpen((v) => !v),
			children: avatar
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute right-0 top-9 z-40 w-52 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate px-3 py-2 text-sm text-fg",
				children: label
			}), !gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				className: "flex h-11 w-full items-center px-3 text-left text-sm text-fg hover:bg-bg disabled:opacity-50",
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				children: signingOut ? "Signing out…" : "Sign out"
			})]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			avatar,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden max-w-28 truncate text-sm font-medium lg:inline",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "hidden cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline md:inline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
function AuthSlot({ compact = false }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("animate-pulse rounded-lg bg-elevated", compact ? "h-8 w-8 rounded-full" : "h-10 w-28") });
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 items-center gap-2",
		children: [!compact && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/app",
			className: cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex"),
			children: "Open editor"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, { compact })]
	});
	if (compact) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/login",
		search: { next: "/app" },
		className: cn(buttonVariants({
			variant: "ghost",
			size: "sm"
		}), "h-7 px-2.5 text-xs"),
		children: "Sign in"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/login",
			search: { next: "/app" },
			className: cn(buttonVariants({
				variant: "ghost",
				size: "sm"
			})),
			children: "Sign in"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/login",
			search: { next: "/app" },
			className: cn(buttonVariants({ size: "sm" })),
			children: "Start free"
		})]
	});
}
//#endregion
export { buttonVariants as a, SignedOut as i, AuthSlot as n, useCurrentUser as o, Button as r, useCurrentUserState as s, ApertureMark as t };
