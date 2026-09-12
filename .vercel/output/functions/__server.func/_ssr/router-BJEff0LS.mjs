import { o as __toESM } from "../_runtime.mjs";
import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as useRouter, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { L as string, N as number, P as object, R as union, j as literal } from "../_libs/@better-auth/core+[...].mjs";
import { n as auth } from "./server-BInRgz1J.mjs";
import { a as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-BJEff0LS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-CIgSKar2.css";
var APP_NAME = "Aperture";
var Route$8 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Aperture is an AI code editor that indexes a whole repo, searches it semantically, and proposes diffs you can apply."
			},
			{
				name: "theme-color",
				content: "#09090b"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					theme: "dark",
					position: "bottom-right",
					toastOptions: {
						className: "font-sans",
						style: {
							background: "var(--color-elevated)",
							border: "1px solid var(--color-border)",
							color: "var(--color-fg)"
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter$4 = () => import("./routes-De_kYa1-.mjs");
var Route$7 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./app-Cg9tPx1z.mjs");
var Route$6 = createFileRoute("/app")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./login-CiJHgwi7.mjs");
var NEXT_ROUTES = [
	"/app",
	"/pricing",
	"/settings"
];
function parseNext(value) {
	return NEXT_ROUTES.includes(value) ? value : "/app";
}
var Route$5 = createFileRoute("/login")({
	validateSearch: (s) => ({ next: parseNext(s.next) }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./pricing-CD33JzCG.mjs");
var Route$4 = createFileRoute("/pricing")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./settings-D9fCHntR.mjs");
var Route$3 = createFileRoute("/settings")({
	validateSearch: (s) => ({ tab: s.tab === "models" || s.tab === "limits" || s.tab === "agents" ? s.tab : "plan" }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var Route$2 = createFileRoute("/api/agent")({ server: { handlers: { POST: async ({ request }) => {
	const { assertSameSiteRequest } = await import("./isolation.server-CGNg1r0B.mjs");
	const { requireUserId, UnauthorizedError } = await import("./verify.server-CqsEMVBc.mjs");
	try {
		assertSameSiteRequest();
	} catch {
		return new Response("Forbidden", { status: 403 });
	}
	let userId;
	try {
		const header = request.headers.get("authorization");
		userId = await requireUserId(header?.startsWith("Bearer ") ? header.slice(7) : void 0);
	} catch (error) {
		if (error instanceof UnauthorizedError || error instanceof Error && error.message === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
		throw error;
	}
	const { MAX_AGENT_BODY, rateLimit, sanitizeAgentInput } = await import("./agent-guard.server-DAZJvnkN.mjs");
	if (!rateLimit(userId)) return Response.json({ error: "Too many Composer sends. Wait a few seconds." }, { status: 429 });
	const raw = await request.text();
	if (raw.length > MAX_AGENT_BODY) return Response.json({ error: "Request is too large." }, { status: 413 });
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}
	const input = sanitizeAgentInput(parsed);
	if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
	if (input.agentId) {
		const { planById } = await import("./plans-CTIRB29R.mjs").then((n) => n.o).then((n) => n.o);
		const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
		if (!planById((await (await getSql())`select plan from user_settings where user_id = ${userId}`)[0]?.plan ?? "hobby").acp) return Response.json({ error: "External agents are on Pro. Upgrade to run Claude Code, Codex, or OpenCode in this panel." }, { status: 403 });
	}
	const encoder = new TextEncoder();
	const stream = new ReadableStream({ async start(controller) {
		const emit = (event) => {
			try {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			} catch {}
		};
		try {
			if (input.agentId) {
				const { runAcpSession } = await import("./session.server-BnD_6toD.mjs");
				await runAcpSession(input, {
					userId,
					emit,
					signal: request.signal
				});
			} else {
				const { resolveModel, recordAgentRun } = await import("./api-BHHVIIah.mjs").then((n) => n.t).then((n) => n.t);
				const resolved = await resolveModel(userId, input.source);
				if (!resolved.ok) {
					emit({
						type: "error",
						error: resolved.error
					});
					return;
				}
				const { runAgentLoopStreaming } = await import("./loop.server-Dkdk3YDs.mjs");
				if ((await runAgentLoopStreaming(input, {
					provider: resolved.provider,
					apiKey: resolved.apiKey
				}, emit, request.signal)).ok) await recordAgentRun(userId, resolved.hosted, resolved.cents);
			}
		} catch (error) {
			if (request.signal.aborted || error instanceof Error && (error.name === "AbortError" || error.message === "This operation was aborted")) return;
			emit({
				type: "error",
				error: error instanceof Error ? error.message : "Agent failed"
			});
		} finally {
			try {
				controller.close();
			} catch {}
		}
	} });
	return new Response(stream, { headers: {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform"
	} });
} } } });
var Route$1 = createFileRoute("/api/tab")({ server: { handlers: { POST: async ({ request }) => {
	const { assertSameSiteRequest } = await import("./isolation.server-CGNg1r0B.mjs");
	const { requireUserId, UnauthorizedError } = await import("./verify.server-CqsEMVBc.mjs");
	try {
		assertSameSiteRequest();
	} catch {
		return new Response("Forbidden", { status: 403 });
	}
	let userId;
	try {
		const header = request.headers.get("authorization");
		userId = await requireUserId(header?.startsWith("Bearer ") ? header.slice(7) : void 0);
	} catch (error) {
		if (error instanceof UnauthorizedError || error instanceof Error && error.message === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
		throw error;
	}
	const { rateLimit } = await import("./agent-guard.server-DAZJvnkN.mjs");
	if (!rateLimit(`tab:${userId}`, 20, 6e4)) return Response.json({ text: "" }, { status: 200 });
	const raw = await request.text();
	if (raw.length > 2e4) return Response.json({ error: "Too large" }, { status: 413 });
	let body;
	try {
		body = JSON.parse(raw);
	} catch {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}
	const { safeRelPath } = await import("./redact-Ckw8E-v4.mjs").then((n) => n.r).then((n) => n.r);
	const path = typeof body.path === "string" ? safeRelPath(body.path) : null;
	const prefix = typeof body.prefix === "string" ? body.prefix.slice(-2800) : "";
	const suffix = typeof body.suffix === "string" ? body.suffix.slice(0, 400) : "";
	if (!path || prefix.length < 8) return Response.json({ text: "" });
	const { tabCacheGet, tabCacheKey, tabCacheSet, completeTab } = await import("./tab.server-BlzjJBUq.mjs");
	const cacheKey = tabCacheKey(path, prefix, suffix);
	const cached = tabCacheGet(cacheKey);
	if (cached !== null) return Response.json({ text: cached });
	const { resolveTabModel, recordTabUse } = await import("./api-BHHVIIah.mjs").then((n) => n.t).then((n) => n.t);
	const resolved = await resolveTabModel(userId);
	if (!resolved.ok) return Response.json({
		error: resolved.error,
		text: ""
	}, { status: 200 });
	try {
		const text = await completeTab({
			provider: resolved.provider,
			apiKey: resolved.apiKey
		}, {
			path,
			prefix,
			suffix
		}, request.signal);
		tabCacheSet(cacheKey, text);
		if (text) await recordTabUse(userId, resolved.hosted);
		return Response.json({ text });
	} catch {
		return Response.json({ text: "" });
	}
} } } });
var Route = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var rootRouteChildren = {
	IndexRoute: Route$7.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$8
	}),
	AppRoute: Route$6.update({
		id: "/app",
		path: "/app",
		getParentRoute: () => Route$8
	}),
	LoginRoute: Route$5.update({
		id: "/login",
		path: "/login",
		getParentRoute: () => Route$8
	}),
	PricingRoute: Route$4.update({
		id: "/pricing",
		path: "/pricing",
		getParentRoute: () => Route$8
	}),
	SettingsRoute: Route$3.update({
		id: "/settings",
		path: "/settings",
		getParentRoute: () => Route$8
	}),
	ApiAgentRoute: Route$2.update({
		id: "/api/agent",
		path: "/api/agent",
		getParentRoute: () => Route$8
	}),
	ApiTabRoute: Route$1.update({
		id: "/api/tab",
		path: "/api/tab",
		getParentRoute: () => Route$8
	}),
	ApiAuthSplatRoute: Route.update({
		id: "/api/auth/$",
		path: "/api/auth/$",
		getParentRoute: () => Route$8
	})
};
var routeTree = Route$8._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { Route$3 as n, Route$5 as r, router_exports as t };
