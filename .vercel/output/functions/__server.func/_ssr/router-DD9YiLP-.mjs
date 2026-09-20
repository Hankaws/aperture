import { o as __toESM } from "../_runtime.mjs";
import { n as BUILTIN_ACP } from "./kinds-CCf1JBpH.mjs";
import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { i as safeRelPath, t as isSecretPath } from "./redact-Ckw8E-v4.mjs";
import { n as nextComposerPhase, t as isBuildIntent } from "./phase-Dk9J4-qu.mjs";
import { n as PROVIDERS, s as providerShort } from "./plans-CTIRB29R.mjs";
import { t as billedWorkers } from "./fanout-7r58zqMR.mjs";
import { a as modelSeats, c as proposeWorkers, i as dropWorker, l as selectedSeats, n as availableSeats, r as canConfirm, s as proposeReviewer, t as addWorker, u as toggleWorkerRole } from "./crew-D0crwclb.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, b as useRouter, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-BW7VTtXx.mjs";
import { a as quoteRuns, i as quoteRun } from "./cost-_vUFI9Un.mjs";
import { a as setModelSource, c as createSsrRpc, n as getAccount } from "./api-CT8K4ti-.mjs";
import { a as isModEvent, i as fuzzyMatch, n as cn, o as modSymbol, r as extOf, t as basename } from "./utils-DTfuEt1f.mjs";
import { n as assembleImport, r as filesFromZipBuffer } from "./project-files-B6R06HJh.mjs";
import { L as string, N as number, P as object, R as union, j as literal } from "../_libs/@better-auth/core+[...].mjs";
import { a as signOut, r as getBearerToken } from "./client-BXBOTlUB.mjs";
import { C as hunksFromDiff, D as languageLabel, E as languageFromPath, F as previewNotesForEdit, I as priorMessages, M as nearestUiFiles, N as parseMentions, O as lineDiff, S as hunkLines, T as isUiTask, a as activeMention, c as autoContextPaths, d as diffStats, f as dropHunk, g as findRules, h as filterMentions, i as SYNTAX, j as mergeStackSection, k as mentionItems, l as compactHistory, m as extractStack, n as EDITOR, r as RULE_CANDIDATES, s as applyStackMemory, t as DEFAULT_RULES, v as formatStackBody, w as indexFiles } from "./stack-BS70QEOJ.mjs";
import { t as parseUnifiedDiff } from "./patch-BCE3WVGP.mjs";
import { n as auth } from "./server-BInRgz1J.mjs";
import { a as buttonVariants, n as AuthSlot, o as useCurrentUser, r as Button, s as useCurrentUserState, t as ApertureMark } from "./auth-slot-DeaQUz9w.mjs";
import { B as FileCode, C as LogOut, D as Library, E as ListTodo, F as FolderOpen, G as Clock, H as Eye, I as FileText, J as ChevronRight, K as Circle, L as FileSearch, M as Github, N as Folder, P as FolderTree, Q as ArrowUp, R as FileJson, S as MessageSquare, T as ListTree, U as Download, V as FileArchive, W as CodeXml, X as Bug, Y as Check, Z as AtSign, _ as Play, a as Undo2, b as Palette, c as Square, d as Settings, f as Send, g as Plus, h as RotateCcw, i as Users, j as History, k as Keyboard, l as Sparkles, m as ScrollText, n as Wrench, o as TriangleAlert, p as Search, q as CircleDot, r as WandSparkles, s as Trash2, t as X, v as Pin, w as LoaderCircle, x as MousePointer2, y as Paperclip, z as FileDiff } from "../_libs/lucide-react.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { n as nn, r as qt, t as Qt } from "../_libs/react-resizable-panels.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { t as require_lib } from "../_libs/jszip+[...].mjs";
import { $ as GutterMarker, A as indentOnInput, B as tags, C as foldGutter, I as syntaxHighlighting, Q as EditorView, St as Prec, Tt as StateField, X as Decoration, at as gutter, bt as EditorState, ct as keymap, et as ViewPlugin, g as bracketMatching, i as closeBracketsKeymap, l as HighlightStyle, lt as lineNumbers, mt as Annotation, n as autocompletion, nt as drawSelection, o as completionKeymap, ot as highlightActiveLine, r as closeBrackets, st as highlightActiveLineGutter, tt as WidgetType, vt as Compartment, wt as StateEffect, y as defaultHighlightStyle } from "../_libs/@codemirror/autocomplete+[...].mjs";
import { i as indentWithTab, n as history, r as historyKeymap, t as defaultKeymap } from "../_libs/codemirror__commands.mjs";
import { n as openSearchPanel, r as searchKeymap, t as highlightSelectionMatches } from "../_libs/codemirror__search.mjs";
import { t as css } from "../_libs/@codemirror/lang-css+[...].mjs";
import { r as javascript, t as html } from "../_libs/@codemirror/lang-html+[...].mjs";
import { t as json } from "../_libs/@codemirror/lang-json+[...].mjs";
import { t as markdown } from "../_libs/@codemirror/lang-markdown+[...].mjs";
import { t as python } from "../_libs/@codemirror/lang-python+[...].mjs";
import { t as _e } from "../_libs/cmdk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DD9YiLP-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_lib = /* @__PURE__ */ __toESM(require_lib());
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
var RELOAD_KEY = "aperture-chunk-reload";
function errorMessage(error) {
	const raw = error instanceof Error && error.message ? error.message : typeof error === "string" && error ? error : FALLBACK_MESSAGE;
	if (/Minified React error #(\d+)/i.exec(raw)?.[1] === "185") return "The editor hit an update loop and stopped. Reload to continue.";
	return raw;
}
function isStaleChunk(message) {
	return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(message);
}
function hardReload() {
	try {
		sessionStorage.removeItem(RELOAD_KEY);
	} catch {}
	const url = new URL(window.location.href);
	url.searchParams.set("_r", String(Date.now()));
	window.location.replace(url.pathname + url.search + url.hash);
}
function AppErrorComponent({ error }) {
	const message = errorMessage(error);
	const stale = isStaleChunk(message);
	(0, import_react.useEffect)(() => {
		if (!stale || typeof window === "undefined") return;
		try {
			if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
			sessionStorage.setItem(RELOAD_KEY, "1");
		} catch {
			return;
		}
		const url = new URL(window.location.href);
		url.searchParams.set("_r", String(Date.now()));
		window.location.replace(url.pathname + url.search + url.hash);
	}, [stale]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-danger",
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
				className: "max-w-md text-sm break-words text-muted",
				children: stale ? "The editor failed to load a cached file. Reload to pick up the latest version." : message
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90",
				onClick: hardReload,
				children: "Reload"
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
var styles_default = "/assets/styles-CB_s5TlT.css";
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
				rel: "preload",
				as: "style",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
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
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: "try{var t=localStorage.getItem(\"aperture-theme\");if(t)document.documentElement.setAttribute(\"data-theme\",t);var d=localStorage.getItem(\"aperture-density\");if(d)document.documentElement.setAttribute(\"data-density\",d);}catch(e){}" } })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
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
var $$splitComponentImporter$3 = () => import("./routes-CDaGtMK6.mjs");
var Route$7 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var DEMO_WORKSPACE_NAME = "harbor-api";
var DEMO_FILES = {
	".aperture.md": `# Project rules

- This is harbor-api, a tiny in-memory task HTTP API.
- Prefer the smallest unique search/replace. Do not rewrite files unless asked.
- Match the existing style. Cite path:line when you explain.
- Known bugs to fix if asked: listTasks off-by-one, getTask 200+null, missing title length check.
- Do not add dependencies unless the user asks.
`,
	"README.md": `# harbor-api

Tiny in-memory task API used as the default Aperture workspace.

## Layout

- \`src/index.ts\` — process entry, wires the router
- \`src/router.ts\` — method + path dispatch
- \`src/store.ts\` — in-memory task collection
- \`src/routes/tasks.ts\` — list / create / get / patch
- \`src/lib/validate.ts\` — request checks
- \`src/lib/errors.ts\` — typed HTTP errors

## Known issues (on purpose)

1. \`listTasks\` skips the first item of every page (off-by-one).
2. \`createTask\` does not validate title length.
3. \`getTask\` returns 200 with \`null\` instead of 404.

Ask Composer to fix any of them, or press the inline edit shortcut on a selection.
`,
	"package.json": `{
  "name": "harbor-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node --experimental-strip-types src/index.ts",
    "test": "node --experimental-strip-types tests/store.test.ts"
  }
}
`,
	"tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
`,
	"src/index.ts": `import { createServer } from "node:http";
import { handleRequest } from "./router.ts";

const port = Number(process.env.PORT ?? 3333);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", \`http://\${req.headers.host ?? "localhost"}\`);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    const result = await handleRequest({
      method: req.method ?? "GET",
      pathname: url.pathname,
      search: url.searchParams,
      body,
    });
    res.writeHead(result.status, {
      "content-type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "internal" }));
  }
});

server.listen(port, () => {
  console.log(\`harbor-api listening on :\${port}\`);
});
`,
	"src/types.ts": `export type TaskStatus = "open" | "doing" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
};

export type HttpResult = {
  status: number;
  body: unknown;
};

export type HttpRequest = {
  method: string;
  pathname: string;
  search: URLSearchParams;
  body: string;
};
`,
	"src/store.ts": `import type { Task, TaskStatus } from "./types.ts";

const tasks: Task[] = [
  {
    id: "tsk_100",
    title: "Index the workspace",
    status: "done",
    createdAt: 1_714_000_000_000,
    updatedAt: 1_714_000_100_000,
  },
  {
    id: "tsk_101",
    title: "Fix pagination",
    status: "open",
    createdAt: 1_714_000_200_000,
    updatedAt: 1_714_000_200_000,
  },
  {
    id: "tsk_102",
    title: "Validate createTask input",
    status: "open",
    createdAt: 1_714_000_300_000,
    updatedAt: 1_714_000_300_000,
  },
];

let seq = 103;

export function listTasks(page: number, pageSize: number): Task[] {
  const start = Math.max(0, page) * pageSize;
  // Off-by-one: skips the first item on every page.
  return tasks.slice(start + 1, start + pageSize + 1);
}

export function countTasks(): number {
  return tasks.length;
}

export function getTask(id: string): Task | null {
  return tasks.find((task) => task.id === id) ?? null;
}

export function createTask(title: string): Task {
  const now = Date.now();
  const task: Task = {
    id: \`tsk_\${seq++}\`,
    title,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  return task;
}

export function patchTask(
  id: string,
  patch: { title?: string; status?: TaskStatus },
): Task | null {
  const task = getTask(id);
  if (!task) return null;
  if (typeof patch.title === "string") task.title = patch.title;
  if (patch.status) task.status = patch.status;
  task.updatedAt = Date.now();
  return task;
}
`,
	"src/router.ts": `import type { HttpRequest, HttpResult } from "./types.ts";
import { handleHealth } from "./routes/health.ts";
import { handleTasks } from "./routes/tasks.ts";
import { HttpError } from "./lib/errors.ts";

export async function handleRequest(req: HttpRequest): Promise<HttpResult> {
  try {
    if (req.pathname === "/health") return handleHealth();
    if (req.pathname === "/tasks" || req.pathname.startsWith("/tasks/")) {
      return handleTasks(req);
    }
    return { status: 404, body: { error: "not_found" } };
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: error.status, body: { error: error.code, message: error.message } };
    }
    throw error;
  }
}
`,
	"src/routes/health.ts": `import type { HttpResult } from "../types.ts";
import { countTasks } from "../store.ts";

export function handleHealth(): HttpResult {
  return {
    status: 200,
    body: {
      ok: true,
      service: "harbor-api",
      tasks: countTasks(),
    },
  };
}
`,
	"src/routes/tasks.ts": `import type { HttpRequest, HttpResult } from "../types.ts";
import { countTasks, createTask, getTask, listTasks, patchTask } from "../store.ts";
import { HttpError } from "../lib/errors.ts";
import { parseJson, requireTitle } from "../lib/validate.ts";

export function handleTasks(req: HttpRequest): HttpResult {
  if (req.pathname === "/tasks" && req.method === "GET") {
    const page = Number(req.search.get("page") ?? "0");
    const pageSize = Number(req.search.get("pageSize") ?? "20");
    return {
      status: 200,
      body: {
        items: listTasks(page, pageSize),
        total: countTasks(),
        page,
        pageSize,
      },
    };
  }

  if (req.pathname === "/tasks" && req.method === "POST") {
    const payload = parseJson(req.body) as { title?: unknown };
    const title = requireTitle(payload.title);
    const task = createTask(title);
    return { status: 201, body: task };
  }

  const match = /^\\/tasks\\/([^/]+)$/.exec(req.pathname);
  if (!match) return { status: 404, body: { error: "not_found" } };
  const id = decodeURIComponent(match[1] ?? "");

  if (req.method === "GET") {
    const task = getTask(id);
    // Should be 404 when missing — currently returns null with 200.
    return { status: 200, body: task };
  }

  if (req.method === "PATCH") {
    const payload = parseJson(req.body) as { title?: unknown; status?: unknown };
    const title = typeof payload.title === "string" ? payload.title : undefined;
    const status =
      payload.status === "open" || payload.status === "doing" || payload.status === "done"
        ? payload.status
        : undefined;
    const task = patchTask(id, { title, status });
    if (!task) throw new HttpError(404, "not_found", \`Task \${id} does not exist\`);
    return { status: 200, body: task };
  }

  throw new HttpError(405, "method_not_allowed", \`Cannot \${req.method} \${req.pathname}\`);
}
`,
	"src/lib/validate.ts": `import { HttpError } from "./errors.ts";

export function parseJson(raw: string): unknown {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }
}

export function requireTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "invalid_title", "title is required");
  }
  // Missing: reject titles longer than 80 characters.
  return value.trim();
}
`,
	"src/lib/errors.ts": `export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
`,
	"tests/store.test.ts": `import { createTask, getTask, listTasks } from "../src/store.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const page = listTasks(0, 2);
assert(page.length === 2, "page 0 should contain the first two seed tasks");
assert(page[0]?.id === "tsk_100", "first item should be tsk_100");

const created = createTask("Write embeddings");
assert(created.title === "Write embeddings", "created title should round-trip");
assert(getTask(created.id)?.id === created.id, "getTask should find the new row");

console.log("store tests would pass once listTasks is fixed");
`
};
function snapshotPaths(files, paths) {
	const before = {};
	for (const path of paths) before[path] = files[path] !== void 0 ? files[path] : null;
	return before;
}
function restoreFiles(files, before) {
	const next = { ...files };
	for (const [path, content] of Object.entries(before)) if (content === null) delete next[path];
	else next[path] = content;
	return next;
}
function pushCheckpoint(list, next) {
	return [...list, next].slice(-8);
}
function checkpointLabel(text, fallback = "Composer run") {
	const clean = (text ?? "").replace(/\s+/g, " ").trim();
	if (!clean) return fallback;
	return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}
function hunkAnchorLines(edit) {
	return hunksFromDiff(edit.oldText, edit.newText).map((hunk) => hunk.deleted[0] ?? Math.max(1, hunk.insertAfter));
}
function hunkIndexAt(lines, currentLine) {
	if (lines.length === 0) return -1;
	if (currentLine <= 0) return 0;
	const exact = lines.indexOf(currentLine);
	if (exact >= 0) return exact;
	const next = lines.findIndex((n) => n > currentLine);
	if (next === 0) return 0;
	if (next < 0) return lines.length - 1;
	return next - 1;
}
function stepReview(files, activePath, currentLine, dir, fileOnly = false) {
	if (files.length === 0) return null;
	const index = Math.max(0, files.findIndex((f) => f.path === activePath));
	const current = files[index] ?? files[0];
	if (!fileOnly) {
		const lines = current.lines;
		if (dir === 1) {
			const next = lines.find((n) => n > currentLine);
			if (next != null) return {
				path: current.path,
				line: next
			};
		} else {
			const prev = [...lines].reverse().find((n) => n < currentLine);
			if (prev != null) return {
				path: current.path,
				line: prev
			};
		}
	}
	const nextFile = files[(index + dir + files.length) % files.length];
	const line = dir === 1 ? nextFile.lines[0] ?? 1 : nextFile.lines[nextFile.lines.length - 1] ?? 1;
	return {
		path: nextFile.path,
		line
	};
}
var THEME_KEY = "aperture-theme";
var DENSITY_KEY = "aperture-density";
function readTheme() {
	try {
		return localStorage.getItem("aperture-theme") === "claude" ? "claude" : "cursor";
	} catch {
		return "cursor";
	}
}
function readDensity() {
	try {
		return localStorage.getItem("aperture-density") === "comfortable" ? "comfortable" : "compact";
	} catch {
		return "compact";
	}
}
function applyAppearance(theme, density) {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.theme = theme;
	document.documentElement.dataset.density = density;
	try {
		localStorage.setItem(THEME_KEY, theme);
		localStorage.setItem(DENSITY_KEY, density);
	} catch {}
}
var CREW_KEY = "aperture-crew";
function readCrew() {
	if (typeof window === "undefined") return ["hosted"];
	try {
		const raw = window.localStorage.getItem(CREW_KEY);
		if (!raw) return ["hosted"];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) return ["hosted"];
		const ids = parsed.filter((x) => x.length > 0 && x.length < 80).slice(0, 6);
		return ids.length ? ids : ["hosted"];
	} catch {
		return ["hosted"];
	}
}
function persistCrew(ids) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(CREW_KEY, JSON.stringify(ids));
	} catch {}
}
var useIdeUi = create((set) => ({
	sidebarOpen: true,
	chatOpen: true,
	commandOpen: false,
	helpOpen: false,
	newFileOpen: false,
	githubOpen: false,
	inlineOpen: false,
	historyOpen: false,
	debug: false,
	designOpen: false,
	codePeek: false,
	captures: [],
	previewErrors: [],
	mobilePane: "editor",
	theme: "cursor",
	density: "compact",
	composerUnread: false,
	reveal: null,
	findTick: 0,
	steerQueue: [],
	crewIds: ["hosted"],
	toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
	toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
	setChatOpen: (open) => set((s) => ({
		chatOpen: open,
		composerUnread: open ? false : s.composerUnread
	})),
	setCommandOpen: (open) => set({ commandOpen: open }),
	setHelpOpen: (open) => set({ helpOpen: open }),
	setNewFileOpen: (open) => set({ newFileOpen: open }),
	setGithubOpen: (open) => set({ githubOpen: open }),
	setInlineOpen: (open) => set({ inlineOpen: open }),
	setHistoryOpen: (open) => set({ historyOpen: open }),
	setDebug: (on) => {
		if (typeof window !== "undefined") try {
			window.localStorage.setItem("aperture-debug", on ? "1" : "0");
		} catch {}
		set({ debug: on });
	},
	setDesignOpen: (open) => set((s) => ({
		designOpen: open,
		codePeek: open ? false : s.codePeek,
		mobilePane: open ? "editor" : s.mobilePane
	})),
	setCodePeek: (open) => set({ codePeek: open }),
	addCapture: (capture) => set((s) => ({ captures: [...s.captures, capture].slice(-8) })),
	setPreviewErrors: (errors) => set((s) => {
		const next = [...new Set(errors.map((row) => row.trim()).filter(Boolean))].slice(0, 6);
		if (s.previewErrors.length === next.length && s.previewErrors.every((row, i) => row === next[i])) return s;
		return { previewErrors: next };
	}),
	updateCapture: (id, patch) => set((s) => ({ captures: s.captures.map((c) => c.id === id ? {
		...c,
		...patch
	} : c) })),
	removeCapture: (id) => set((s) => ({ captures: s.captures.filter((c) => c.id !== id) })),
	clearCaptures: () => set({ captures: [] }),
	setMobilePane: (pane) => set((s) => {
		const unread = pane === "agent" ? false : s.composerUnread;
		if (s.mobilePane === pane && s.composerUnread === unread) return s;
		return {
			mobilePane: pane,
			composerUnread: unread
		};
	}),
	setTheme: (theme) => {
		set((s) => {
			applyAppearance(theme, s.density);
			return { theme };
		});
	},
	setDensity: (density) => {
		set((s) => {
			applyAppearance(s.theme, density);
			return { density };
		});
	},
	setComposerUnread: (on) => set({ composerUnread: on }),
	setReveal: (reveal) => set({ reveal }),
	requestFind: () => set((s) => ({ findTick: s.findTick + 1 })),
	enqueueSteer: (text) => set((s) => {
		const line = text.trim();
		if (!line) return s;
		return { steerQueue: [...s.steerQueue, line].slice(-5) };
	}),
	shiftSteer: () => {
		let first;
		set((s) => {
			first = s.steerQueue[0];
			return { steerQueue: s.steerQueue.slice(1) };
		});
		return first;
	},
	dropSteer: (index) => set((s) => ({ steerQueue: s.steerQueue.filter((_, i) => i !== index) })),
	clearSteer: () => set({ steerQueue: [] }),
	toggleCrew: (id) => set((s) => {
		const crewIds = s.crewIds.includes(id) ? s.crewIds.filter((x) => x !== id) : [...s.crewIds, id].slice(0, 6);
		const next = crewIds.length ? crewIds : ["hosted"];
		persistCrew(next);
		return { crewIds: next };
	}),
	setCrew: (ids) => {
		const crewIds = ids.slice(0, 6);
		persistCrew(crewIds);
		set({ crewIds: crewIds.length ? crewIds : ["hosted"] });
	}
}));
function hydrateAppearance() {
	const theme = readTheme();
	const density = readDensity();
	applyAppearance(theme, density);
	useIdeUi.setState({
		theme,
		density,
		crewIds: readCrew()
	});
}
function fileListOf(files) {
	return Object.keys(files).sort();
}
function keepFileList(prev, files) {
	const next = fileListOf(files);
	if (prev.length === next.length && prev.every((path, i) => path === next[i])) return prev;
	return next;
}
function withFiles(files, prev) {
	return {
		files,
		fileList: keepFileList(prev, files)
	};
}
var STORAGE_KEY = "aperture-workspace-v2";
function persist(state) {
	if (typeof window === "undefined") return;
	const base = {
		name: state.name,
		files: state.files,
		openTabs: state.openTabs,
		recentPaths: state.recentPaths,
		activePath: state.activePath,
		previewPath: state.previewPath,
		pinned: state.pinned,
		dirtyPaths: state.dirtyPaths,
		messages: state.messages.slice(-40)
	};
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			...base,
			checkpoints: state.checkpoints.slice(-6)
		}));
	} catch {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
		} catch {}
	}
}
var persistTimer = null;
var previewForce = /* @__PURE__ */ new Set();
function schedulePersist() {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => persist(useWorkspace.getState()), 180);
}
var reindexTimer = null;
function scheduleReindex() {
	if (reindexTimer) clearTimeout(reindexTimer);
	reindexTimer = setTimeout(() => {
		useWorkspace.getState().reindex();
	}, 420);
}
function buildIndex(files) {
	return indexFiles(files);
}
function syncTabs(files, openTabs, activePath) {
	const tabs = openTabs.filter((p) => files[p] !== void 0);
	return {
		openTabs: tabs,
		activePath: activePath && files[activePath] !== void 0 ? activePath : tabs[tabs.length - 1] ?? null
	};
}
function orderTabs(tabs, pinned) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const path of pinned) if (tabs.includes(path) && !seen.has(path)) {
		seen.add(path);
		out.push(path);
	}
	for (const path of tabs) if (!seen.has(path)) {
		seen.add(path);
		out.push(path);
	}
	return out;
}
function remember(recent, path) {
	return [path, ...recent.filter((p) => p !== path)].slice(0, 8);
}
function withPath(list, path) {
	return list.includes(path) ? list : [...list, path];
}
function seedFiles(files, name) {
	return applyStackMemory(files, name);
}
var SEEDED_DEMO = seedFiles({ ...DEMO_FILES }, DEMO_WORKSPACE_NAME);
var useWorkspace = create((set, get) => {
	function ensureCheckpointForMessage(messageId) {
		const state = get();
		const message = state.messages.find((m) => m.id === messageId);
		if (!message?.edits?.length) return null;
		if (message.checkpointId) {
			const existing = state.checkpoints.find((c) => c.id === message.checkpointId);
			if (existing) return existing.id;
		}
		const pendingOrApplied = message.edits.filter((e) => e.status === "pending" || e.status === "applied");
		const paths = [...new Set(pendingOrApplied.map((e) => e.path))];
		if (paths.length === 0) return null;
		const idx = state.messages.findIndex((m) => m.id === messageId);
		const prev = idx > 0 ? state.messages[idx - 1] : null;
		const label = checkpointLabel(prev?.role === "user" ? prev.content : message.edits[0]?.description);
		const id = `ck_${crypto.randomUUID()}`;
		const checkpoint = {
			id,
			createdAt: Date.now(),
			label,
			messageId,
			before: snapshotPaths(state.files, paths)
		};
		set({
			checkpoints: pushCheckpoint(state.checkpoints, checkpoint),
			messages: state.messages.map((m) => m.id === messageId ? {
				...m,
				checkpointId: id
			} : m)
		});
		return id;
	}
	function applyOne(edit) {
		let files = {
			...get().files,
			[edit.path]: edit.newText
		};
		const rules = findRules(files);
		if (!rules || rules.path !== edit.path) files = applyStackMemory(files, get().name);
		const openTabs = get().openTabs.includes(edit.path) ? get().openTabs : [...get().openTabs, edit.path];
		const messages = get().messages.map((m) => ({
			...m,
			edits: m.edits?.map((e) => e.id === edit.id ? {
				...e,
				status: "applied"
			} : e)
		}));
		set({
			files,
			openTabs: orderTabs(openTabs, get().pinned),
			activePath: edit.path,
			previewPath: get().previewPath === edit.path ? null : get().previewPath,
			dirtyPaths: withPath(get().dirtyPaths, edit.path),
			chunks: buildIndex(files),
			messages,
			fileList: keepFileList(get().fileList, files)
		});
	}
	function restoreCheckpoint(id) {
		const ck = get().checkpoints.find((c) => c.id === id);
		if (!ck) return null;
		const files = restoreFiles(get().files, ck.before);
		const tabs = syncTabs(files, get().openTabs, get().activePath);
		const pinned = get().pinned.filter((p) => files[p] !== void 0);
		const prev = get().previewPath;
		const previewPath = prev && files[prev] !== void 0 ? prev : null;
		const messages = get().messages.map((m) => {
			if (m.id !== ck.messageId) return m;
			return {
				...m,
				edits: m.edits?.map((e) => e.status === "applied" ? {
					...e,
					status: "pending"
				} : e)
			};
		});
		set({
			files,
			...tabs,
			pinned,
			previewPath,
			chunks: buildIndex(files),
			messages,
			fileList: keepFileList(get().fileList, files)
		});
		schedulePersist();
		return ck;
	}
	return {
		ready: true,
		name: DEMO_WORKSPACE_NAME,
		files: SEEDED_DEMO,
		fileList: fileListOf(SEEDED_DEMO),
		openTabs: ["src/store.ts", "src/index.ts"],
		recentPaths: ["src/store.ts", "src/index.ts"],
		activePath: "src/store.ts",
		previewPath: null,
		pinned: [],
		dirtyPaths: [],
		chunks: buildIndex(DEMO_FILES),
		indexing: false,
		messages: [],
		checkpoints: [],
		agentRunning: false,
		runningMode: null,
		selection: null,
		hydrate: () => {
			if (typeof window === "undefined") return;
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					const nextFiles = seedFiles((parsed.files && Object.keys(parsed.files).length > 0 ? parsed.files : null) ?? get().files, parsed.name || "harbor-api");
					if (nextFiles && Object.keys(nextFiles).length > 0) {
						const nextTabs = parsed.openTabs?.length ? parsed.openTabs.filter((p) => nextFiles[p] !== void 0) : [Object.keys(nextFiles)[0]];
						const nextActive = parsed.activePath && nextFiles[parsed.activePath] !== void 0 ? parsed.activePath : nextTabs[0];
						const nextPreview = parsed.previewPath && nextFiles[parsed.previewPath] !== void 0 ? parsed.previewPath : null;
						const nextPinned = (parsed.pinned ?? []).filter((p) => nextFiles[p] !== void 0);
						const nextDirty = (parsed.dirtyPaths ?? []).filter((p) => nextFiles[p] !== void 0);
						const nextRecent = (parsed.recentPaths ?? nextTabs).filter((p) => nextFiles[p] !== void 0);
						set({
							name: parsed.name || "harbor-api",
							files: nextFiles,
							fileList: fileListOf(nextFiles),
							openTabs: nextTabs,
							recentPaths: nextRecent.length ? nextRecent : nextTabs,
							activePath: nextActive,
							previewPath: nextPreview,
							pinned: nextPinned,
							dirtyPaths: nextDirty,
							messages: parsed.messages ?? [],
							checkpoints: parsed.checkpoints ?? [],
							chunks: buildIndex(nextFiles),
							indexing: false,
							agentRunning: false,
							runningMode: null
						});
						return;
					}
				}
			} catch {}
			const files = get().files;
			set({
				chunks: buildIndex(files),
				indexing: false
			});
		},
		loadDemo: () => {
			const files = applyStackMemory({ ...DEMO_FILES }, DEMO_WORKSPACE_NAME);
			set({
				name: DEMO_WORKSPACE_NAME,
				files,
				fileList: fileListOf(files),
				openTabs: ["src/store.ts", "src/index.ts"],
				recentPaths: ["src/store.ts", "src/index.ts"],
				activePath: "src/store.ts",
				previewPath: null,
				pinned: [],
				dirtyPaths: [],
				chunks: buildIndex(files),
				messages: [],
				checkpoints: [],
				selection: null,
				agentRunning: false,
				runningMode: null
			});
			schedulePersist();
		},
		loadProject: (name, incoming) => {
			const nextFiles = seedFiles(incoming, name);
			const paths = Object.keys(nextFiles).sort();
			if (paths.length === 0) return;
			const preferred = paths.find((p) => /^(readme\.md|readme)$/i.test(p.split("/").pop() ?? "")) ?? paths.find((p) => p === ".aperture.md") ?? paths[0];
			set({
				indexing: true,
				name,
				files: nextFiles,
				fileList: fileListOf(nextFiles),
				openTabs: [preferred],
				recentPaths: [preferred],
				activePath: preferred,
				previewPath: null,
				pinned: [],
				dirtyPaths: [],
				messages: [],
				checkpoints: [],
				selection: null,
				agentRunning: false,
				runningMode: null
			});
			set({
				chunks: buildIndex(nextFiles),
				indexing: false
			});
			schedulePersist();
		},
		reindex: () => {
			const files = get().files;
			set({ indexing: true });
			set({
				chunks: buildIndex(files),
				indexing: false
			});
		},
		openFile: (path) => {
			const { files, openTabs, activePath, pinned, previewPath, recentPaths } = get();
			if (files[path] === void 0) return;
			const nextPreview = previewPath === path ? null : previewPath;
			const tabs = orderTabs(openTabs.includes(path) ? openTabs : [...openTabs, path], pinned);
			const recent = remember(recentPaths, path);
			if (activePath === path && openTabs.includes(path) && previewPath !== path) {
				set({ recentPaths: recent });
				schedulePersist();
				return;
			}
			set({
				openTabs: tabs,
				activePath: path,
				previewPath: nextPreview,
				recentPaths: recent
			});
			schedulePersist();
		},
		openPreview: (path) => {
			const { files, openTabs, activePath, pinned, previewPath, recentPaths } = get();
			if (files[path] === void 0) return;
			const recent = remember(recentPaths, path);
			if (openTabs.includes(path) && previewPath !== path) {
				if (activePath === path) {
					set({ recentPaths: recent });
					schedulePersist();
					return;
				}
				set({
					activePath: path,
					recentPaths: recent
				});
				schedulePersist();
				return;
			}
			if (previewPath === path) {
				set({
					activePath: path,
					recentPaths: recent
				});
				schedulePersist();
				return;
			}
			const withoutOld = openTabs.filter((p) => p !== previewPath);
			set({
				openTabs: orderTabs(withoutOld.includes(path) ? withoutOld : [...withoutOld, path], pinned),
				activePath: path,
				previewPath: path,
				recentPaths: recent
			});
			schedulePersist();
		},
		closeTab: (path) => {
			const tabs = get().openTabs.filter((p) => p !== path);
			set({
				openTabs: tabs,
				activePath: get().activePath === path ? tabs[tabs.length - 1] ?? null : get().activePath,
				pinned: get().pinned.filter((p) => p !== path),
				previewPath: get().previewPath === path ? null : get().previewPath
			});
			schedulePersist();
		},
		setActive: (path) => {
			set({
				activePath: path,
				recentPaths: remember(get().recentPaths, path)
			});
			schedulePersist();
		},
		pinTab: (path) => {
			const { files, openTabs, pinned, previewPath } = get();
			if (files[path] === void 0) return;
			const nextPinned = pinned.includes(path) ? pinned.filter((p) => p !== path) : [...pinned, path];
			set({
				pinned: nextPinned,
				openTabs: orderTabs(openTabs.includes(path) ? openTabs : [...openTabs, path], nextPinned),
				previewPath: previewPath === path ? null : previewPath,
				activePath: path
			});
			schedulePersist();
		},
		writeFile: (path, content) => {
			if (isSecretPath(path)) return;
			if (get().files[path] === content) return;
			const files = {
				...get().files,
				[path]: content
			};
			const previewPath = get().previewPath === path ? null : get().previewPath;
			set({
				...withFiles(files, get().fileList),
				dirtyPaths: withPath(get().dirtyPaths, path),
				previewPath
			});
			schedulePersist();
			scheduleReindex();
		},
		createFile: (path, content = "") => {
			const clean = safeRelPath(path);
			if (!clean || isSecretPath(clean)) return;
			let files = {
				...get().files,
				[clean]: content
			};
			files = seedFiles(files, get().name);
			const openTabs = orderTabs(get().openTabs.includes(clean) ? get().openTabs : [...get().openTabs, clean], get().pinned);
			set({
				files,
				fileList: keepFileList(get().fileList, files),
				openTabs,
				activePath: clean,
				previewPath: get().previewPath === clean ? null : get().previewPath,
				dirtyPaths: withPath(get().dirtyPaths, clean),
				chunks: buildIndex(files)
			});
			schedulePersist();
		},
		deleteFile: (path) => {
			const files = { ...get().files };
			delete files[path];
			const openTabs = get().openTabs.filter((p) => p !== path);
			const active = get().activePath === path ? openTabs[openTabs.length - 1] ?? null : get().activePath;
			const pinned = get().pinned.filter((p) => p !== path);
			const previewPath = get().previewPath === path ? null : get().previewPath;
			const dirtyPaths = get().dirtyPaths.filter((p) => p !== path);
			set({
				files,
				fileList: keepFileList(get().fileList, files),
				openTabs,
				activePath: active,
				pinned,
				previewPath,
				dirtyPaths,
				chunks: buildIndex(files)
			});
			schedulePersist();
		},
		setSelection: (selection) => {
			const prev = get().selection;
			if (prev === selection) return;
			if (prev && selection && prev.path === selection.path && prev.text === selection.text && prev.fromLine === selection.fromLine && prev.toLine === selection.toLine && prev.empty === selection.empty) return;
			set({ selection });
		},
		addMessage: (message) => {
			set({ messages: [...get().messages, message] });
			schedulePersist();
		},
		patchMessage: (id, patch) => {
			set({ messages: get().messages.map((m) => m.id === id ? {
				...m,
				...patch
			} : m) });
			schedulePersist();
		},
		setAgentRunning: (running, mode) => set({
			agentRunning: running,
			runningMode: running ? mode ?? get().runningMode : null
		}),
		applyEdit: (edit) => {
			if (edit.notes?.length) return;
			if (!previewForce.has(edit.id)) {
				const live = useIdeUi.getState().previewErrors;
				const notes = previewNotesForEdit(edit, get().files, live);
				if (notes.length) {
					set({ messages: get().messages.map((m) => ({
						...m,
						edits: m.edits?.map((e) => e.id === edit.id ? {
							...e,
							notes
						} : e)
					})) });
					schedulePersist();
					return;
				}
			}
			const message = get().messages.find((m) => m.edits?.some((e) => e.id === edit.id));
			if (message) ensureCheckpointForMessage(message.id);
			applyOne(edit);
			previewForce.delete(edit.id);
			schedulePersist();
		},
		rejectEdit: (editId) => {
			set({ messages: get().messages.map((m) => ({
				...m,
				edits: m.edits?.map((e) => e.id === editId ? {
					...e,
					status: "rejected"
				} : e)
			})) });
			schedulePersist();
		},
		applyAllPending: () => {
			const pending = get().messages.flatMap((m) => m.edits ?? []).filter((e) => e.status === "pending");
			if (pending.some((e) => (e.notes?.length ?? 0) > 0)) return;
			const live = useIdeUi.getState().previewErrors;
			const bounced = {};
			for (const edit of pending) {
				if (previewForce.has(edit.id)) continue;
				const notes = previewNotesForEdit(edit, get().files, live);
				if (notes.length) bounced[edit.id] = notes;
			}
			if (Object.keys(bounced).length) {
				set({ messages: get().messages.map((m) => ({
					...m,
					edits: m.edits?.map((e) => bounced[e.id] ? {
						...e,
						notes: bounced[e.id]
					} : e)
				})) });
				schedulePersist();
				return;
			}
			const pendingByMessage = get().messages.filter((m) => m.edits?.some((e) => e.status === "pending"));
			for (const message of pendingByMessage) ensureCheckpointForMessage(message.id);
			for (const edit of pending) {
				applyOne(edit);
				previewForce.delete(edit.id);
			}
			schedulePersist();
		},
		rejectAllPending: () => {
			set({ messages: get().messages.map((m) => ({
				...m,
				edits: m.edits?.map((e) => e.status === "pending" ? {
					...e,
					status: "rejected"
				} : e)
			})) });
			schedulePersist();
		},
		dropHunkAt: (editId, line) => {
			const edit = get().messages.flatMap((m) => m.edits ?? []).find((e) => e.id === editId && e.status === "pending");
			if (!edit) return;
			const index = hunkIndexAt(hunkAnchorLines(edit), line);
			const hunks = hunksFromDiff(edit.oldText, edit.newText);
			const hunk = hunks[index];
			if (!hunk) return;
			if (hunks.length <= 1) {
				get().rejectEdit(editId);
				return;
			}
			const nextText = dropHunk(edit.oldText, edit.newText, index);
			if (nextText === edit.oldText) {
				get().rejectEdit(editId);
				return;
			}
			const dropped = new Set(hunkLines(edit.oldText, hunk).map((text) => text.slice(0, 80)));
			const notes = (edit.notes ?? []).filter((note) => !dropped.has(note.excerpt));
			set({ messages: get().messages.map((m) => ({
				...m,
				edits: m.edits?.map((e) => e.id === editId ? {
					...e,
					newText: nextText,
					notes
				} : e)
			})) });
			schedulePersist();
		},
		clearPendingNotes: (editId) => {
			for (const message of get().messages) for (const edit of message.edits ?? []) if (edit.status === "pending" && (!editId || edit.id === editId)) previewForce.add(edit.id);
			set({ messages: get().messages.map((m) => ({
				...m,
				edits: m.edits?.map((e) => e.status === "pending" && (!editId || e.id === editId) ? {
					...e,
					notes: []
				} : e)
			})) });
			schedulePersist();
		},
		undoCheckpoint: (id) => restoreCheckpoint(id),
		undoLast: () => {
			const last = get().checkpoints[get().checkpoints.length - 1];
			if (!last) return null;
			return restoreCheckpoint(last.id);
		},
		clearChat: () => {
			set({ messages: [] });
			schedulePersist();
		},
		syncStackMemory: () => {
			const files = seedFiles(get().files, get().name);
			if (files === get().files) return;
			set({ ...withFiles(files, get().fileList) });
			schedulePersist();
		}
	};
});
function listPendingEdits(messages) {
	const out = [];
	for (const message of messages) for (const edit of message.edits ?? []) if (edit.status === "pending") out.push(edit);
	return out;
}
function pendingEditFor(messages, path) {
	if (!path) return null;
	let found = null;
	for (const edit of listPendingEdits(messages)) if (edit.path === path) found = edit;
	return found;
}
function pendingPathKey(messages) {
	const paths = /* @__PURE__ */ new Set();
	for (const edit of listPendingEdits(messages)) paths.add(edit.path);
	return [...paths].sort().join("|");
}
function pendingByPath(messages) {
	const map = /* @__PURE__ */ new Map();
	for (const edit of listPendingEdits(messages)) map.set(edit.path, edit);
	return [...map.values()];
}
function attachNotesToPending(messages, incoming) {
	const byMessage = /* @__PURE__ */ new Map();
	for (const message of messages) if (message.edits?.length) byMessage.set(message.id, message.edits.map((e) => ({
		...e,
		notes: [...e.notes ?? []]
	})));
	const touched = /* @__PURE__ */ new Set();
	for (const inc of incoming) {
		if (!inc.notes?.length) continue;
		for (const [id, edits] of byMessage) {
			const idx = edits.findIndex((e) => e.path === inc.path && e.status === "pending");
			if (idx < 0) continue;
			const current = edits[idx];
			edits[idx] = {
				...current,
				notes: [...current.notes ?? [], ...inc.notes]
			};
			touched.add(id);
			break;
		}
	}
	return [...touched].map((id) => ({
		id,
		edits: byMessage.get(id)
	}));
}
function hasCodeRange(selection) {
	if (!selection || selection.empty) return false;
	return selection.text.trim().length > 0;
}
var handlers = null;
function registerImportHandlers(next) {
	handlers = next;
	return () => {
		if (handlers === next) handlers = null;
	};
}
function pickFolder() {
	handlers?.pickFolder();
}
function pickZip() {
	handlers?.pickZip();
}
function zipName(name) {
	return `${name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project"}.zip`;
}
async function zipWorkspace(files) {
	const zip = new import_lib.default();
	let count = 0;
	for (const [path, content] of Object.entries(files)) {
		const clean = safeRelPath(path);
		if (!clean || isSecretPath(clean)) continue;
		zip.file(clean, content);
		count += 1;
	}
	if (count === 0) throw new Error("Nothing to download.");
	return {
		blob: await zip.generateAsync({
			type: "blob",
			compression: "DEFLATE"
		}),
		count
	};
}
async function downloadWorkspace(name, files) {
	const { blob, count } = await zipWorkspace(files);
	const href = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = href;
	a.download = zipName(name);
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.setTimeout(() => URL.revokeObjectURL(href), 4e3);
	return count;
}
async function downloadCurrentWorkspace() {
	const { name, files } = useWorkspace.getState();
	return {
		name,
		count: await downloadWorkspace(name, files)
	};
}
function fileIcon(path) {
	const ext = extOf(path);
	if (ext === "json") return FileJson;
	if (ext === "md") return FileText;
	return FileCode;
}
function buildTree(paths) {
	const root = /* @__PURE__ */ new Map();
	for (const path of paths) {
		const parts = path.split("/").filter(Boolean);
		let cursor = root;
		let acc = "";
		parts.forEach((part, i) => {
			acc = acc ? `${acc}/${part}` : part;
			const isFile = i === parts.length - 1;
			let node = cursor.get(part);
			if (!node) {
				node = {
					name: part,
					path: acc,
					kids: isFile ? void 0 : /* @__PURE__ */ new Map()
				};
				cursor.set(part, node);
			} else if (!isFile && !node.kids) node.kids = /* @__PURE__ */ new Map();
			if (!isFile) cursor = node.kids ?? (node.kids = /* @__PURE__ */ new Map());
		});
	}
	const toArr = (map) => {
		const nodes = [...map.values()].map((n) => ({
			name: n.name,
			path: n.path,
			children: n.kids ? toArr(n.kids) : void 0
		}));
		nodes.sort((a, b) => {
			const af = a.children ? 0 : 1;
			const bf = b.children ? 0 : 1;
			if (af !== bf) return af - bf;
			return a.name.localeCompare(b.name);
		});
		return nodes;
	};
	return toArr(root);
}
function TreeItem({ node, depth, pending }) {
	const activePath = useWorkspace((s) => s.activePath);
	const dirtyPaths = useWorkspace((s) => s.dirtyPaths);
	const openPreview = useWorkspace((s) => s.openPreview);
	const openFile = useWorkspace((s) => s.openFile);
	const deleteFile = useWorkspace((s) => s.deleteFile);
	const [open, setOpen] = (0, import_react.useState)(depth < 1);
	const isFolder = Boolean(node.children);
	const active = activePath === node.path;
	const dirty = dirtyPaths.includes(node.path);
	const Icon = isFolder ? open ? FolderOpen : Folder : fileIcon(node.path);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("tree-row group relative flex h-11 items-center gap-1 rounded-sm pr-1 text-[15px] md:h-7 md:text-[13px]", active ? "is-active text-fg" : "text-muted"),
		style: { paddingLeft: 8 + depth * 10 },
		children: [
			active && !isFolder && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "flex min-w-0 flex-1 items-center gap-1.5 text-left",
				onClick: () => {
					if (isFolder) {
						setOpen((v) => !v);
						return;
					}
					if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
						openFile(node.path);
						useIdeUi.getState().setMobilePane("editor");
					} else openPreview(node.path);
				},
				onDoubleClick: () => {
					if (!isFolder) openFile(node.path);
				},
				children: [
					isFolder ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: cn("size-3.5 shrink-0 text-subtle transition-transform duration-150", open && "rotate-90") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-3.5" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "size-3.5 shrink-0",
						strokeWidth: 1.6
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: node.name
					}),
					pending.has(node.path) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-1.5 shrink-0 rounded-full bg-ok",
						"aria-label": "Staged diff"
					}),
					dirty && !pending.has(node.path) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-1.5 shrink-0 rounded-full bg-tab-modified",
						"aria-label": "Unsaved"
					})
				]
			}),
			!isFolder && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": `Delete ${node.name}`,
				className: cn("flex size-9 items-center justify-center rounded-md text-subtle hover:text-danger md:size-7 md:opacity-0 md:group-hover:opacity-100", active ? "max-md:flex" : "max-md:hidden"),
				onClick: () => deleteFile(node.path),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
			})
		]
	}), isFolder && open && node.children?.map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeItem, {
		node: child,
		depth: depth + 1,
		pending
	}, child.path))] });
}
async function saveZip() {
	try {
		const result = await downloadCurrentWorkspace();
		toast.success(`Downloaded ${result.name} · ${result.count} files`);
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Could not download");
	}
}
function OpenMenu() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const rootRef = (0, import_react.useRef)(null);
	const setGithubOpen = useIdeUi((s) => s.setGithubOpen);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onPointer(e) {
			if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
		}
		function onKey(e) {
			if (e.key === "Escape") setOpen(false);
		}
		window.addEventListener("mousedown", onPointer);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousedown", onPointer);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			size: "sm",
			className: "h-7 px-1.5",
			"aria-label": "Open project",
			"aria-expanded": open,
			onClick: () => setOpen((v) => !v),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5" }), "Open"]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]",
			children: [
				{
					label: "Open folder",
					icon: FolderOpen,
					run: () => pickFolder()
				},
				{
					label: "Open zip",
					icon: FileArchive,
					run: () => pickZip()
				},
				{
					label: "Open GitHub",
					icon: Github,
					run: () => setGithubOpen(true)
				},
				{
					label: "Download zip",
					icon: Download,
					run: () => void saveZip()
				}
			].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-fg hover:bg-bg",
				onClick: () => {
					setOpen(false);
					item.run();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-3.5 text-subtle" }), item.label]
			}, item.label))
		})]
	});
}
function FileTree() {
	const files = useWorkspace((s) => s.fileList);
	const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
	const pending = (0, import_react.useMemo)(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);
	const setNewFileOpen = useIdeUi((s) => s.setNewFileOpen);
	const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
	const tree = (0, import_react.useMemo)(() => buildTree(files), [files]);
	const [dropOver, setDropOver] = (0, import_react.useState)(false);
	const count = files.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("file-tree ide-stack", dropOver && "is-drop"),
		onDragOver: (e) => {
			if (!e.dataTransfer?.types.includes("Files")) return;
			e.preventDefault();
			setDropOver(true);
		},
		onDragLeave: (e) => {
			if (e.currentTarget.contains(e.relatedTarget)) return;
			setDropOver(false);
		},
		onDrop: () => setDropOver(false),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-11 items-center justify-between gap-1 border-b border-border px-1.5 md:h-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-1 text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase",
					children: "Workspace"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							className: "h-9 px-1.5 md:h-7",
							"aria-label": "Search files",
							onClick: () => setCommandOpen(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "md:hidden",
								children: "Search"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenMenu, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							className: "h-9 px-1.5 md:h-7",
							"aria-label": "New file",
							onClick: () => setNewFileOpen(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), "New"]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "aperture-scroll min-h-0 overflow-y-auto px-1 py-1",
				children: tree.map((node) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeItem, {
					node,
					depth: 0,
					pending
				}, node.path))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-border px-2.5 py-1 font-mono text-[11px] text-subtle",
				children: [
					count,
					" ",
					count === 1 ? "file" : "files"
				]
			})
		]
	});
}
function tabIcon(path) {
	const ext = extOf(path);
	if (ext === "json") return FileJson;
	if (ext === "md") return FileText;
	return FileCode;
}
function PreviewToggle({ className }) {
	const open = useIdeUi((s) => s.designOpen);
	const codePeek = useIdeUi((s) => s.codePeek);
	const setOpen = useIdeUi((s) => s.setDesignOpen);
	const setCodePeek = useIdeUi((s) => s.setCodePeek);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-1",
		children: [open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setCodePeek(!codePeek),
			"aria-pressed": codePeek,
			"aria-label": codePeek ? "Hide code" : "Show code beside preview",
			className: cn("hidden h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium md:inline-flex", codePeek ? "bg-elevated text-fg" : "text-muted hover:bg-list-hover hover:text-fg"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, {
				className: "size-3.5",
				strokeWidth: 2
			}), "Code"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen(!open),
			"aria-pressed": open,
			"aria-label": open ? "Close preview" : "Open preview",
			className: cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium md:h-7 md:px-2.5 md:text-[12px]", open ? "bg-accent text-bg" : "border border-border bg-elevated text-fg hover:bg-list-hover", className),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {
				className: "size-3.5",
				strokeWidth: 2
			}), "Preview"]
		})]
	});
}
function TabBar() {
	const openTabs = useWorkspace((s) => s.openTabs);
	const activePath = useWorkspace((s) => s.activePath);
	const previewPath = useWorkspace((s) => s.previewPath);
	const pinned = useWorkspace((s) => s.pinned);
	const dirtyPaths = useWorkspace((s) => s.dirtyPaths);
	const setActive = useWorkspace((s) => s.setActive);
	const closeTab = useWorkspace((s) => s.closeTab);
	const pinTab = useWorkspace((s) => s.pinTab);
	const openFile = useWorkspace((s) => s.openFile);
	const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
	const pending = (0, import_react.useMemo)(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-10 items-stretch border-b border-border bg-surface md:h-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex min-w-0 flex-1 items-stretch overflow-x-auto",
			children: openTabs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex items-center px-3 text-xs text-subtle",
				children: "Open a file from Workspace to start"
			}) : openTabs.map((path) => {
				const active = path === activePath;
				const preview = path === previewPath;
				const isPinned = pinned.includes(path);
				const dirty = dirtyPaths.includes(path);
				const Icon = tabIcon(path);
				const staged = pending.has(path);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("group relative flex min-w-0 shrink-0 items-center gap-0.5 border-r border-border px-1.5", active ? "bg-bg text-fg" : "text-muted hover:bg-tab-hover hover:text-fg"),
					onDoubleClick: () => openFile(path),
					onAuxClick: (e) => {
						if (e.button === 1) {
							e.preventDefault();
							closeTab(path);
						}
					},
					children: [
						active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-x-0 top-0 h-0.5 bg-accent" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex max-w-44 items-center gap-1 truncate px-1 py-1.5 text-xs",
							title: preview ? "Preview tab — double-click to keep" : isPinned ? "Pinned" : basename(path),
							onClick: () => setActive(path),
							children: [
								isPinned && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, {
									className: "size-3 shrink-0 text-subtle",
									strokeWidth: 1.8
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "size-3 shrink-0 text-subtle",
									strokeWidth: 1.6
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("truncate", active && "font-medium", preview && "tab-preview"),
									children: basename(path)
								}),
								staged && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "size-1.5 shrink-0 rounded-full bg-ok",
									"aria-label": "Staged change"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": isPinned ? `Unpin ${basename(path)}` : `Pin ${basename(path)}`,
							className: "hidden size-6 items-center justify-center rounded-md text-subtle hover:bg-elevated hover:text-fg group-hover:flex",
							onClick: (e) => {
								e.stopPropagation();
								pinTab(path);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, {
								className: cn("size-3", isPinned && "text-fg"),
								strokeWidth: 1.8
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-label": dirty ? `Unsaved · Close ${basename(path)}` : `Close ${basename(path)}`,
							className: cn("relative flex size-6 items-center justify-center rounded-md hover:bg-elevated", active || dirty ? "opacity-100" : "opacity-0 group-hover:opacity-100"),
							onClick: () => closeTab(path),
							children: [dirty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-tab-modified group-hover:opacity-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: cn("size-3", dirty && "absolute opacity-0 group-hover:opacity-100") })]
						})
					]
				}, path);
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "hidden shrink-0 items-center border-l border-border px-1.5 md:flex",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewToggle, {})
		})]
	});
}
function Breadcrumbs() {
	const path = useWorkspace((s) => s.activePath);
	if (!path) return null;
	const parts = path.split("/").filter(Boolean);
	function copy(value) {
		navigator.clipboard.writeText(value).then(() => toast.success("Copied path"), () => toast.error("Could not copy"));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": "Breadcrumb",
		className: "flex h-6 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-bg px-2.5 text-[11px]",
		children: parts.map((part, i) => {
			const acc = parts.slice(0, i + 1).join("/");
			const last = i === parts.length - 1;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1",
				children: [i > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-subtle",
					children: "/"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: last ? "truncate font-medium text-fg" : "truncate text-muted hover:text-fg",
					title: `Copy ${acc}`,
					onClick: () => copy(acc),
					children: part
				})]
			}, acc);
		})
	});
}
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
async function requestTabCompletion(input, signal) {
	const token = getBearerToken();
	const res = await fetch("/api/tab", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...token ? { Authorization: `Bearer ${token}` } : {}
		},
		credentials: "include",
		body: JSON.stringify(input),
		signal
	});
	if (res.status === 401 || res.status === 403) return null;
	if (!res.ok) return null;
	const text = ((await res.json()).text ?? "").trim();
	return text.length > 0 ? text : null;
}
function takeGhostWord(ghost) {
	if (!ghost) return {
		take: "",
		rest: ""
	};
	const take = /^(\n[^\n]*|\s*\.[A-Za-z_$][\w$]*|\s*[A-Za-z_$][\w$]*|\s*[^\s\w]+|\s+)/.exec(ghost)?.[1] ?? ghost[0];
	return {
		take,
		rest: ghost.slice(take.length)
	};
}
var GhostWidget = class extends WidgetType {
	text;
	constructor(text) {
		super();
		this.text = text;
	}
	eq(other) {
		return other.text === this.text;
	}
	toDOM() {
		const span = document.createElement("span");
		span.className = "cm-aperture-ghost";
		span.textContent = this.text.split("\n").slice(0, 8).join("\n");
		return span;
	}
};
var setGhost = StateEffect.define();
var ghostField = StateField.define({
	create: () => null,
	update(value, tr) {
		for (const effect of tr.effects) if (effect.is(setGhost)) return effect.value;
		if (tr.docChanged) return null;
		return value;
	}
});
function ghostDecorations(view, text) {
	if (!text) return Decoration.none;
	const pos = view.state.selection.main.head;
	return Decoration.set([Decoration.widget({
		widget: new GhostWidget(text),
		side: 1
	}).range(pos)]);
}
var ghostTheme = EditorView.theme({ ".cm-aperture-ghost": {
	color: EDITOR.ghost,
	fontStyle: "italic",
	pointerEvents: "none",
	opacity: "0.85",
	whiteSpace: "pre",
	display: "inline-block",
	verticalAlign: "text-top"
} });
var clientCache = /* @__PURE__ */ new Map();
var CLIENT_CACHE_MAX = 80;
function clientGet(key) {
	const hit = clientCache.get(key);
	if (hit === void 0) return void 0;
	clientCache.delete(key);
	clientCache.set(key, hit);
	return hit;
}
function clientSet(key, text) {
	clientCache.set(key, text);
	while (clientCache.size > CLIENT_CACHE_MAX) {
		const first = clientCache.keys().next().value;
		if (first === void 0) break;
		clientCache.delete(first);
	}
}
function ghostText(path) {
	let timer = null;
	let inflight = null;
	let lastKey = "";
	const plugin = ViewPlugin.fromClass(class {
		view;
		decorations = Decoration.none;
		constructor(view) {
			this.view = view;
		}
		update(update) {
			this.decorations = ghostDecorations(update.view, update.state.field(ghostField));
			if (!update.docChanged && !update.selectionSet) return;
			if (!update.state.selection.main.empty) return;
			if (timer) clearTimeout(timer);
			inflight?.abort();
			timer = setTimeout(() => {
				this.request();
			}, 280);
		}
		async request() {
			const filePath = path();
			if (!filePath) return;
			const state = this.view.state;
			const pos = state.selection.main.head;
			if (!state.selection.main.empty) return;
			if (state.doc.length < 12 || pos < 2) return;
			const prefix = state.doc.sliceString(Math.max(0, pos - 2400), pos);
			const suffix = state.doc.sliceString(pos, Math.min(state.doc.length, pos + 280));
			const key = `${filePath}:${prefix.slice(-100)}:${suffix.slice(0, 24)}`;
			if (key === lastKey) return;
			const cached = clientGet(key);
			if (cached !== void 0) {
				lastKey = key;
				if (cached) this.view.dispatch({ effects: setGhost.of(cached) });
				return;
			}
			inflight?.abort();
			const abort = new AbortController();
			inflight = abort;
			try {
				const text = await requestTabCompletion({
					path: filePath,
					prefix,
					suffix
				}, abort.signal);
				if (abort.signal.aborted) return;
				if (this.view.state.selection.main.head !== pos) return;
				lastKey = key;
				const next = text ?? "";
				clientSet(key, next);
				if (!next) return;
				this.view.dispatch({ effects: setGhost.of(next) });
			} catch {}
		}
		destroy() {
			if (timer) clearTimeout(timer);
			inflight?.abort();
		}
	}, { decorations: (v) => v.decorations });
	const accept = keymap.of([
		{
			key: "Tab",
			run: (view) => {
				const ghost = view.state.field(ghostField);
				if (!ghost) return false;
				const pos = view.state.selection.main.head;
				view.dispatch({
					changes: {
						from: pos,
						insert: ghost
					},
					selection: { anchor: pos + ghost.length },
					effects: setGhost.of(null)
				});
				return true;
			}
		},
		{
			key: "Ctrl-ArrowRight",
			mac: "Cmd-ArrowRight",
			run: (view) => {
				const ghost = view.state.field(ghostField);
				if (!ghost) return false;
				const { take, rest } = takeGhostWord(ghost);
				if (!take) return false;
				const pos = view.state.selection.main.head;
				view.dispatch({
					changes: {
						from: pos,
						insert: take
					},
					selection: { anchor: pos + take.length },
					effects: setGhost.of(rest.length ? rest : null)
				});
				return true;
			}
		},
		{
			key: "Escape",
			run: (view) => {
				if (!view.state.field(ghostField)) return false;
				view.dispatch({ effects: setGhost.of(null) });
				return true;
			}
		}
	]);
	return [
		ghostField,
		plugin,
		ghostTheme,
		Prec.high(accept)
	];
}
var KEYWORDS = /* @__PURE__ */ new Set([
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"default",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"for",
	"from",
	"function",
	"if",
	"import",
	"in",
	"let",
	"new",
	"null",
	"return",
	"static",
	"switch",
	"this",
	"true",
	"try",
	"type",
	"undefined",
	"var",
	"void",
	"while"
]);
function identifiersIn(doc, cap = 80) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const re = /\b[A-Za-z_][\w]{1,}\b/g;
	let match;
	while (match = re.exec(doc)) {
		const name = match[0];
		if (KEYWORDS.has(name) || seen.has(name)) continue;
		seen.add(name);
		out.push(name);
		if (out.length >= cap) break;
	}
	return out;
}
function collectSymbols(chunks, activePath, doc = "") {
	const hits = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (hit) => {
		const key = `${hit.path}:${hit.name}`;
		if (!hit.name || seen.has(key)) return;
		seen.add(key);
		hits.push(hit);
	};
	for (const name of identifiersIn(doc)) add({
		name,
		kind: "identifier",
		path: activePath ?? ""
	});
	for (const chunk of chunks) {
		if (chunk.name === "module" || chunk.kind === "block") continue;
		add({
			name: chunk.name,
			kind: chunk.kind,
			path: chunk.path
		});
	}
	return hits;
}
function filterSymbols(hits, query, activePath) {
	const q = query.trim().toLowerCase();
	const ranked = hits.map((hit) => {
		const name = hit.name.toLowerCase();
		if (q && !name.startsWith(q) && !name.includes(q)) return null;
		let score = 0;
		if (q && name.startsWith(q)) score += 40;
		else if (q && name.includes(q)) score += 12;
		if (hit.path === activePath) score += 20;
		if (hit.kind === "function" || hit.kind === "method") score += 6;
		if (hit.kind === "class") score += 4;
		score -= Math.min(hit.name.length, 20);
		return {
			hit,
			score
		};
	}).filter((row) => row !== null).sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name));
	const out = [];
	const names = /* @__PURE__ */ new Set();
	for (const row of ranked) {
		if (names.has(row.hit.name)) continue;
		names.add(row.hit.name);
		out.push(row.hit);
		if (out.length >= 30) break;
	}
	return out;
}
function completionType(kind) {
	if (kind === "class") return "class";
	if (kind === "function") return "function";
	if (kind === "method") return "method";
	if (kind === "heading") return "text";
	return "variable";
}
function workspaceSource(getChunks, getPath) {
	return (context) => {
		const word = context.matchBefore(/[\w$]{1,}/);
		if (!word && !context.explicit) return null;
		if (word && word.from === word.to && !context.explicit) return null;
		if (word && word.text.length < 2 && !context.explicit) return null;
		const path = getPath();
		const hits = filterSymbols(collectSymbols(getChunks(), path, context.state.doc.toString()), word?.text ?? "", path);
		if (hits.length === 0) return null;
		const options = hits.map((hit) => ({
			label: hit.name,
			type: completionType(hit.kind),
			detail: !hit.path || hit.path === path ? hit.kind : hit.path,
			boost: hit.path === path ? 10 : 0
		}));
		return {
			from: word ? word.from : context.pos,
			options,
			validFor: /^[\w$]*$/
		};
	};
}
function workspaceComplete(getChunks, getPath) {
	const source = workspaceSource(getChunks, getPath);
	return EditorState.languageData.of(() => [{ autocomplete: source }]);
}
var MAX_ADD_LINES = 80;
var AddBlockWidget = class extends WidgetType {
	lines;
	constructor(lines) {
		super();
		this.lines = lines;
	}
	eq(other) {
		return this.lines.length === other.lines.length && this.lines.every((line, i) => line === other.lines[i]);
	}
	toDOM() {
		const wrap = document.createElement("div");
		wrap.className = "cm-aperture-add-block";
		wrap.setAttribute("aria-hidden", "true");
		const shown = this.lines.slice(0, MAX_ADD_LINES);
		for (const text of shown) {
			const row = document.createElement("div");
			row.className = "cm-aperture-add-line";
			const sign = document.createElement("span");
			sign.className = "cm-aperture-add-sign";
			sign.textContent = "+";
			const body = document.createElement("span");
			body.textContent = text.length ? text : " ";
			row.append(sign, body);
			wrap.appendChild(row);
		}
		if (this.lines.length > MAX_ADD_LINES) {
			const more = document.createElement("div");
			more.className = "cm-aperture-add-more";
			more.textContent = `+${this.lines.length - MAX_ADD_LINES} more`;
			wrap.appendChild(more);
		}
		return wrap;
	}
	ignoreEvent() {
		return true;
	}
};
var SignMarker = class extends GutterMarker {
	sign;
	cls;
	constructor(sign, cls) {
		super();
		this.sign = sign;
		this.cls = cls;
	}
	eq(other) {
		return other.sign === this.sign;
	}
	toDOM() {
		const el = document.createElement("span");
		el.className = this.cls;
		el.textContent = this.sign;
		return el;
	}
};
var delMarker = new SignMarker("−", "cm-aperture-diff-sign cm-aperture-diff-sign-del");
function buildDecorations(state, edit) {
	if (state.doc.toString() !== edit.oldText) return Decoration.none;
	const hunks = hunksFromDiff(edit.oldText, edit.newText);
	const ranges = [];
	for (const hunk of hunks) {
		for (const n of hunk.deleted) {
			if (n < 1 || n > state.doc.lines) continue;
			ranges.push(Decoration.line({ class: "cm-aperture-del" }).range(state.doc.line(n).from));
		}
		if (hunk.added.length === 0) continue;
		const pos = hunk.insertAfter <= 0 ? 0 : hunk.insertAfter >= state.doc.lines ? state.doc.length : state.doc.line(hunk.insertAfter).to;
		ranges.push(Decoration.widget({
			widget: new AddBlockWidget(hunk.added),
			block: true,
			side: hunk.insertAfter <= 0 ? -1 : 1
		}).range(pos));
	}
	return Decoration.set(ranges, true);
}
function firstHunkPos(edit, lineCount, lineFrom) {
	const hunk = hunksFromDiff(edit.oldText, edit.newText)[0];
	if (!hunk) return null;
	const lineNo = hunk.deleted[0] ?? Math.max(1, hunk.insertAfter);
	return lineFrom(Math.min(Math.max(1, lineNo), lineCount));
}
function pendingDiff(edit, handlers) {
	if (!edit) return [];
	const deleted = new Set(hunksFromDiff(edit.oldText, edit.newText).flatMap((hunk) => hunk.deleted));
	const decoField = StateField.define({
		create: (state) => buildDecorations(state, edit),
		update(value, tr) {
			if (tr.docChanged) return buildDecorations(tr.state, edit);
			return value;
		},
		provide: (field) => EditorView.decorations.from(field)
	});
	const matchField = StateField.define({
		create: (state) => state.doc.toString() === edit.oldText,
		update(value, tr) {
			if (tr.docChanged) return tr.state.doc.toString() === edit.oldText;
			return value;
		}
	});
	return [
		decoField,
		matchField,
		gutter({
			class: "cm-aperture-diffGutter",
			lineMarker(view, line) {
				if (!view.state.field(matchField)) return null;
				const number = view.state.doc.lineAt(line.from).number;
				return deleted.has(number) ? delMarker : null;
			}
		}),
		Prec.high(keymap.of([
			{
				key: "Enter",
				run: () => {
					handlers.keep();
					return true;
				}
			},
			{
				key: "Backspace",
				run: (view) => {
					const line = view.state.doc.lineAt(view.state.selection.main.head).number;
					handlers.drop(line);
					return true;
				}
			},
			{
				key: "Delete",
				run: (view) => {
					const line = view.state.doc.lineAt(view.state.selection.main.head).number;
					handlers.drop(line);
					return true;
				}
			},
			{
				key: "Mod-Enter",
				run: () => {
					if (edit.notes?.length) return false;
					handlers.apply(edit);
					return true;
				}
			},
			{
				key: "Mod-Backspace",
				run: () => {
					handlers.reject(edit.id);
					return true;
				}
			}
		]))
	];
}
function jumpReview(dir, fileOnly = false) {
	const ws = useWorkspace.getState();
	const files = pendingByPath(ws.messages).map((edit) => ({
		path: edit.path,
		lines: hunkAnchorLines(edit)
	}));
	const line = ws.selection && ws.selection.path === ws.activePath ? ws.selection.fromLine : 0;
	const next = stepReview(files, ws.activePath, line, dir, fileOnly);
	if (!next) return;
	ws.openFile(next.path);
	const ui = useIdeUi.getState();
	ui.setMobilePane("editor");
	if (ui.designOpen) ui.setCodePeek(true);
	ui.setReveal({
		path: next.path,
		line: next.line
	});
}
var sessions = /* @__PURE__ */ new Map();
function saveSession(path, session) {
	sessions.set(path, session);
}
function loadSession(path) {
	return sessions.get(path);
}
function clampSession(session, length) {
	return {
		anchor: Math.max(0, Math.min(session.anchor, length)),
		head: Math.max(0, Math.min(session.head, length)),
		scrollTop: Math.max(0, session.scrollTop)
	};
}
var DECL = /^\s*(export\s+)?(default\s+)?(async\s+)?(function\*?|class|const|let|var|type|interface|enum|def|async def)\b/;
function stickyLine(doc, fromLine) {
	const floor = Math.max(1, fromLine - 80);
	for (let n = fromLine; n >= floor; n -= 1) {
		const line = doc.line(n);
		if (DECL.test(line.text)) return {
			number: line.number,
			text: line.text.trimEnd()
		};
	}
	return null;
}
function stickyScroll() {
	return ViewPlugin.fromClass(class {
		view;
		dom;
		onScroll;
		raf = 0;
		constructor(view) {
			this.view = view;
			this.dom = document.createElement("div");
			this.dom.className = "cm-aperture-sticky";
			this.dom.hidden = true;
			this.dom.setAttribute("aria-hidden", "true");
			view.dom.appendChild(this.dom);
			this.onScroll = () => this.schedule(view);
			view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
			this.schedule(view);
		}
		update(update) {
			if (update.viewportChanged || update.docChanged || update.geometryChanged) this.schedule(update.view);
		}
		schedule(view) {
			if (this.raf) cancelAnimationFrame(this.raf);
			this.raf = requestAnimationFrame(() => this.sync(view));
		}
		sync(view) {
			const height = view.scrollDOM.scrollTop + 4;
			const block = view.lineBlockAtHeight(height);
			const vis = view.state.doc.lineAt(block.from);
			const found = stickyLine(view.state.doc, vis.number);
			if (!found || found.number >= vis.number) {
				this.dom.hidden = true;
				this.dom.textContent = "";
				return;
			}
			this.dom.hidden = false;
			this.dom.textContent = found.text;
		}
		destroy() {
			if (this.raf) cancelAnimationFrame(this.raf);
			this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
			this.dom.remove();
		}
	});
}
function paintMinimap(host, text, scrollTop, clientHeight, scrollHeight) {
	const h = host.clientHeight || 200;
	const w = host.clientWidth || 52;
	const lines = text.split("\n");
	const max = Math.min(lines.length, 900);
	const lineH = h / Math.max(max, 1);
	const bars = [];
	for (let i = 0; i < max; i += 1) {
		const t = (lines[i] ?? "").trim();
		if (!t) continue;
		const comment = t.startsWith("//") || t.startsWith("#") || t.startsWith("*");
		const width = Math.min(w - 8, Math.max(6, t.length * 1.15));
		bars.push(`<i style="top:${(i * lineH).toFixed(2)}px;width:${width.toFixed(1)}px;height:${Math.max(1, lineH - .4).toFixed(2)}px;opacity:${comment ? .4 : .28};background:${comment ? SYNTAX.comment : EDITOR.fg}"></i>`);
	}
	const ratio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
	const top = scrollHeight > 0 ? scrollTop / scrollHeight * h : 0;
	const sliderH = Math.max(12, h * ratio);
	host.innerHTML = `<span class="aperture-minimap-slider" style="top:${top.toFixed(1)}px;height:${sliderH.toFixed(1)}px"></span>${bars.join("")}`;
}
function minimapScrollTo(host, clientY, scrollHeight) {
	const rect = host.getBoundingClientRect();
	const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
	return (rect.height > 0 ? y / rect.height : 0) * scrollHeight;
}
var theme = EditorView.theme({
	"&": {
		backgroundColor: SYNTAX.bg,
		color: SYNTAX.fg,
		height: "100%",
		fontSize: "13px"
	},
	".cm-scroller": {
		overflow: "auto",
		fontFamily: "var(--font-mono)",
		fontKerning: "none",
		fontVariantLigatures: "none",
		fontFeatureSettings: "\"liga\" 0, \"calt\" 0, \"kern\" 0",
		lineHeight: "1.5",
		tabSize: 2
	},
	".cm-content": {
		caretColor: SYNTAX.caret,
		padding: "8px 0"
	},
	".cm-gutters": {
		backgroundColor: SYNTAX.gutter,
		color: SYNTAX.gutterFg,
		border: "none",
		borderRight: `1px solid ${EDITOR.elevated}`
	},
	".cm-lineNumbers .cm-gutterElement": {
		minWidth: "2.2rem",
		padding: "0 8px 0 6px"
	},
	".cm-activeLine": { backgroundColor: SYNTAX.activeLine },
	".cm-activeLineGutter": {
		backgroundColor: SYNTAX.activeLine,
		color: EDITOR.activeLineGutter
	},
	".cm-cursor": {
		borderLeftColor: SYNTAX.caret,
		borderLeftWidth: "2px"
	},
	".cm-selectionBackground": { backgroundColor: EDITOR.selectionInactive },
	"&.cm-focused .cm-selectionBackground": { backgroundColor: EDITOR.selection },
	".cm-selectionMatch": { backgroundColor: EDITOR.wordRead },
	"&.cm-focused .cm-selectionMatch": { backgroundColor: EDITOR.wordRead },
	"&.cm-focused .cm-matchingBracket": {
		backgroundColor: EDITOR.wordWrite,
		outline: `1px solid ${EDITOR.matchBorder}`
	},
	".cm-nonmatchingBracket": {
		color: EDITOR.danger,
		outline: `1px solid ${EDITOR.danger}`
	},
	".cm-foldPlaceholder": {
		background: EDITOR.elevated,
		border: "none",
		color: EDITOR.muted
	},
	".cm-tooltip": {
		backgroundColor: EDITOR.elevated,
		border: `1px solid ${EDITOR.border}`,
		color: SYNTAX.fg
	},
	".cm-tooltip-autocomplete ul li[aria-selected]": { background: EDITOR.paletteFocus },
	".cm-inlayHint, .cm-aperture-inlay": {
		background: EDITOR.inlayBg,
		color: EDITOR.inlayFg,
		fontStyle: "italic",
		padding: "0 5px",
		borderRadius: "4px"
	},
	".cm-searchMatch": { backgroundColor: EDITOR.wordRead },
	".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: EDITOR.wordWrite },
	".cm-panels": {
		backgroundColor: EDITOR.peekBg,
		borderTop: `1px solid ${EDITOR.peekBorder}`,
		color: EDITOR.fg
	},
	".cm-lintRange-error": { textDecoration: `underline wavy ${EDITOR.squiggleError}` },
	".cm-lintRange-warning": { textDecoration: `underline wavy ${EDITOR.squiggleWarn}` },
	".cm-textfield": {
		background: EDITOR.bg,
		border: `1px solid ${EDITOR.border}`,
		color: EDITOR.fg,
		borderRadius: "6px",
		padding: "2px 8px"
	},
	".cm-button": {
		background: EDITOR.elevated,
		border: `1px solid ${EDITOR.border}`,
		color: EDITOR.fg,
		borderRadius: "6px"
	},
	".cm-panel.cm-search label": {
		fontSize: "11px",
		color: EDITOR.muted
	}
}, { dark: true });
var highlight = HighlightStyle.define([
	{
		tag: tags.keyword,
		color: SYNTAX.keyword
	},
	{
		tag: tags.controlKeyword,
		color: SYNTAX.keyword
	},
	{
		tag: tags.moduleKeyword,
		color: SYNTAX.keyword
	},
	{
		tag: tags.comment,
		color: SYNTAX.comment,
		fontStyle: "italic"
	},
	{
		tag: tags.lineComment,
		color: SYNTAX.comment,
		fontStyle: "italic"
	},
	{
		tag: tags.string,
		color: SYNTAX.string
	},
	{
		tag: tags.number,
		color: SYNTAX.number
	},
	{
		tag: tags.bool,
		color: SYNTAX.number
	},
	{
		tag: tags.null,
		color: SYNTAX.number
	},
	{
		tag: tags.function(tags.variableName),
		color: SYNTAX.fn
	},
	{
		tag: tags.function(tags.propertyName),
		color: SYNTAX.fn
	},
	{
		tag: tags.definition(tags.variableName),
		color: SYNTAX.fn
	},
	{
		tag: tags.definition(tags.function(tags.variableName)),
		color: SYNTAX.fn
	},
	{
		tag: tags.typeName,
		color: SYNTAX.type
	},
	{
		tag: tags.className,
		color: SYNTAX.type
	},
	{
		tag: tags.propertyName,
		color: SYNTAX.property
	},
	{
		tag: tags.operator,
		color: SYNTAX.operator
	},
	{
		tag: tags.punctuation,
		color: SYNTAX.operator
	},
	{
		tag: tags.tagName,
		color: SYNTAX.tag
	},
	{
		tag: tags.angleBracket,
		color: SYNTAX.operator
	},
	{
		tag: tags.attributeName,
		color: SYNTAX.fn
	},
	{
		tag: tags.heading,
		color: SYNTAX.fg,
		fontWeight: "500"
	},
	{
		tag: tags.link,
		color: SYNTAX.keyword
	},
	{
		tag: tags.url,
		color: SYNTAX.keyword
	},
	{
		tag: tags.processingInstruction,
		color: SYNTAX.comment
	},
	{
		tag: tags.meta,
		color: SYNTAX.comment
	},
	{
		tag: tags.invalid,
		color: SYNTAX.invalid
	}
]);
function languageExtension(path) {
	const lang = languageFromPath(path);
	if (lang === "typescript") return javascript({
		typescript: true,
		jsx: path.endsWith("x")
	});
	if (lang === "javascript") return javascript({ jsx: path.endsWith("x") });
	if (lang === "json") return json();
	if (lang === "markdown") return markdown();
	if (lang === "python") return python();
	if (lang === "html") return html();
	if (lang === "css") return css();
	return [];
}
function languageKey(path) {
	return `${languageFromPath(path)}:${path.endsWith("x") ? "x" : ""}`;
}
function pendingKeyOf(edit) {
	if (!edit) return "";
	return `${edit.id}:${edit.oldText.length}:${edit.newText.length}:${edit.notes?.length ?? 0}`;
}
var syncAnn = Annotation.define();
function CodePane() {
	const parentRef = (0, import_react.useRef)(null);
	const miniRef = (0, import_react.useRef)(null);
	const viewRef = (0, import_react.useRef)(null);
	const lastValue = (0, import_react.useRef)("");
	const pathRef = (0, import_react.useRef)(null);
	const chunksRef = (0, import_react.useRef)(useWorkspace.getState().chunks);
	const writeFileRef = (0, import_react.useRef)(useWorkspace.getState().writeFile);
	const setSelectionRef = (0, import_react.useRef)(useWorkspace.getState().setSelection);
	const applyRef = (0, import_react.useRef)(useWorkspace.getState().applyEdit);
	const rejectRef = (0, import_react.useRef)(useWorkspace.getState().rejectEdit);
	const langConf = (0, import_react.useRef)(new Compartment()).current;
	const listenerConf = (0, import_react.useRef)(new Compartment()).current;
	const ghostConf = (0, import_react.useRef)(new Compartment()).current;
	const diffConf = (0, import_react.useRef)(new Compartment()).current;
	const wrapConf = (0, import_react.useRef)(new Compartment()).current;
	const scrolledFor = (0, import_react.useRef)(null);
	const jumpedFor = (0, import_react.useRef)(null);
	const langKeyRef = (0, import_react.useRef)("");
	const ghostOnRef = (0, import_react.useRef)(false);
	const diffKeyRef = (0, import_react.useRef)("");
	const activePath = useWorkspace((s) => s.activePath);
	const chunks = useWorkspace((s) => s.chunks);
	const value = useWorkspace((s) => s.activePath ? s.files[s.activePath] ?? "" : "");
	const pendingEdit = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
	const writeFile = useWorkspace((s) => s.writeFile);
	const setSelection = useWorkspace((s) => s.setSelection);
	const applyEdit = useWorkspace((s) => s.applyEdit);
	const rejectEdit = useWorkspace((s) => s.rejectEdit);
	const pendingRef = (0, import_react.useRef)(pendingEdit);
	const { account } = useAccount();
	const reveal = useIdeUi((s) => s.reveal);
	const findTick = useIdeUi((s) => s.findTick);
	const tabOn = Boolean(account?.tab) && !pendingEdit;
	chunksRef.current = chunks;
	writeFileRef.current = writeFile;
	setSelectionRef.current = setSelection;
	applyRef.current = applyEdit;
	rejectRef.current = rejectEdit;
	pendingRef.current = pendingEdit;
	(0, import_react.useEffect)(() => {
		if (!parentRef.current || viewRef.current) return;
		const view = new EditorView({
			parent: parentRef.current,
			state: EditorState.create({
				doc: value,
				extensions: [
					lineNumbers(),
					highlightActiveLine(),
					highlightActiveLineGutter(),
					foldGutter(),
					drawSelection(),
					history(),
					indentOnInput(),
					bracketMatching(),
					closeBrackets(),
					autocompletion({ activateOnTyping: true }),
					workspaceComplete(() => chunksRef.current, () => pathRef.current),
					highlightSelectionMatches({ highlightWordAroundCursor: true }),
					stickyScroll(),
					keymap.of([
						...closeBracketsKeymap,
						...defaultKeymap,
						...historyKeymap,
						...searchKeymap,
						...completionKeymap,
						indentWithTab
					]),
					theme,
					syntaxHighlighting(highlight),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					langConf.of(languageExtension(activePath ?? "")),
					listenerConf.of(EditorView.updateListener.of((update) => {
						if (update.transactions.some((tr) => tr.annotation(syncAnn))) {
							if (update.docChanged) lastValue.current = update.state.doc.toString();
							return;
						}
						if (update.docChanged) {
							const next = update.state.doc.toString();
							lastValue.current = next;
							const path = pathRef.current;
							if (path) writeFileRef.current(path, next);
						}
						if (update.selectionSet) {
							const sel = update.state.selection.main;
							const fromLine = update.state.doc.lineAt(sel.from);
							const toLine = update.state.doc.lineAt(sel.to);
							const text = sel.empty ? fromLine.text : update.state.doc.sliceString(sel.from, sel.to);
							const path = pathRef.current;
							if (path) setSelectionRef.current({
								path,
								text,
								fromLine: fromLine.number,
								toLine: toLine.number,
								empty: sel.empty
							});
						}
					})),
					ghostConf.of([]),
					diffConf.of([]),
					wrapConf.of(languageFromPath(activePath ?? "") === "markdown" ? EditorView.lineWrapping : [])
				]
			})
		});
		viewRef.current = view;
		lastValue.current = value;
		pathRef.current = activePath;
		langKeyRef.current = languageKey(activePath ?? "");
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view) return;
		if (ghostOnRef.current === tabOn) return;
		ghostOnRef.current = tabOn;
		view.dispatch({
			effects: ghostConf.reconfigure(tabOn ? ghostText(() => pathRef.current) : []),
			annotations: syncAnn.of(true)
		});
	}, [tabOn]);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view || !activePath) return;
		const prev = pathRef.current;
		const pathChanged = Boolean(prev && prev !== activePath);
		if (pathChanged && prev) {
			const sel = view.state.selection.main;
			saveSession(prev, {
				anchor: sel.anchor,
				head: sel.head,
				scrollTop: view.scrollDOM.scrollTop
			});
		}
		pathRef.current = activePath;
		const nextLang = languageKey(activePath);
		const langChanged = langKeyRef.current !== nextLang;
		if (langChanged) langKeyRef.current = nextLang;
		const wrap = languageFromPath(activePath) === "markdown" ? EditorView.lineWrapping : [];
		const effects = langChanged ? [langConf.reconfigure(languageExtension(activePath)), wrapConf.reconfigure(wrap)] : [];
		if (value !== lastValue.current) {
			lastValue.current = value;
			const current = view.state.selection.main;
			const saved = pathChanged ? loadSession(activePath) : void 0;
			const sel = clampSession(saved ?? {
				anchor: pathChanged ? 0 : current.anchor,
				head: pathChanged ? 0 : current.head,
				scrollTop: pathChanged ? 0 : view.scrollDOM.scrollTop
			}, value.length);
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: value
				},
				selection: {
					anchor: sel.anchor,
					head: sel.head
				},
				effects,
				annotations: syncAnn.of(true)
			});
			if (saved) requestAnimationFrame(() => {
				if (viewRef.current === view) view.scrollDOM.scrollTop = sel.scrollTop;
			});
			return;
		}
		if (effects.length === 0) return;
		view.dispatch({
			effects,
			annotations: syncAnn.of(true)
		});
	}, [activePath, value]);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view) return;
		const key = pendingKeyOf(pendingEdit);
		if (diffKeyRef.current === key) return;
		diffKeyRef.current = key;
		view.dispatch({
			effects: diffConf.reconfigure(pendingDiff(pendingEdit, {
				apply: (edit) => applyRef.current(edit),
				reject: (id) => rejectRef.current(id),
				keep: () => jumpReview(1),
				drop: (line) => {
					const edit = pendingRef.current;
					if (!edit) return;
					useWorkspace.getState().dropHunkAt(edit.id, line);
					jumpReview(1);
				}
			})),
			annotations: syncAnn.of(true)
		});
	}, [pendingEdit]);
	(0, import_react.useEffect)(() => {
		if (!pendingEdit) {
			jumpedFor.current = null;
			return;
		}
		if (jumpedFor.current === pendingEdit.id) return;
		jumpedFor.current = pendingEdit.id;
		const ui = useIdeUi.getState();
		if (ui.mobilePane !== "editor") ui.setMobilePane("editor");
	}, [pendingEdit]);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		const host = miniRef.current;
		if (!view || !host || !activePath) return;
		const scroller = view.scrollDOM;
		const paint = () => {
			paintMinimap(host, view.state.doc.toString(), scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight);
		};
		paint();
		scroller.addEventListener("scroll", paint, { passive: true });
		const ro = new ResizeObserver(paint);
		ro.observe(scroller);
		return () => {
			scroller.removeEventListener("scroll", paint);
			ro.disconnect();
		};
	}, [activePath, value]);
	(0, import_react.useEffect)(() => {
		if (!pendingEdit) {
			scrolledFor.current = null;
			return;
		}
		if (pendingEdit.id === scrolledFor.current) return;
		if (value !== pendingEdit.oldText) return;
		const id = pendingEdit.id;
		const timer = window.setTimeout(() => {
			const live = viewRef.current;
			if (!live) return;
			const still = pendingEditFor(useWorkspace.getState().messages, pathRef.current);
			if (!still || still.id !== id) return;
			const pos = firstHunkPos(still, live.state.doc.lines, (n) => live.state.doc.line(n).from);
			if (pos == null) return;
			scrolledFor.current = id;
			live.dispatch({
				selection: { anchor: pos },
				effects: EditorView.scrollIntoView(pos, {
					y: "start",
					yMargin: 36
				}),
				annotations: syncAnn.of(true)
			});
		}, 80);
		return () => window.clearTimeout(timer);
	}, [pendingEdit, value]);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view || !reveal || reveal.path !== activePath) return;
		const line = Math.min(Math.max(1, reveal.line), view.state.doc.lines);
		const pos = view.state.doc.line(line).from;
		view.dispatch({
			selection: { anchor: pos },
			effects: EditorView.scrollIntoView(pos, { y: "center" }),
			annotations: syncAnn.of(true)
		});
		useIdeUi.getState().setReveal(null);
	}, [reveal, activePath]);
	(0, import_react.useEffect)(() => {
		if (!findTick) return;
		const view = viewRef.current;
		if (view) openSearchPanel(view);
	}, [findTick]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "editor-stage relative flex h-full min-h-0 bg-bg",
		children: [
			!activePath && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, {
					className: "size-8 text-subtle",
					strokeWidth: 1.4
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-fg",
					children: "Open a file to start"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xs text-sm text-pretty text-muted",
					children: "Click a file on the left. Or ask Composer on the right — it plans first, then waits."
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: parentRef,
				className: activePath ? "h-full min-h-0 min-w-0 flex-1" : "hidden"
			}),
			activePath ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: miniRef,
				className: "aperture-minimap hidden h-full w-10 shrink-0 cursor-pointer border-l border-border md:block",
				"aria-hidden": "true",
				onPointerDown: (e) => {
					const view = viewRef.current;
					const host = miniRef.current;
					if (!view || !host) return;
					view.scrollDOM.scrollTop = minimapScrollTo(host, e.clientY, view.scrollDOM.scrollHeight);
				}
			}) : null
		]
	});
}
function formatDiffNotes(edits) {
	const blocks = [];
	for (const edit of edits) {
		if (edit.status !== "pending" || !edit.notes?.length) continue;
		const lines = edit.notes.map((note) => {
			return `  ${note.type === "add" ? "+" : note.type === "del" ? "−" : " "} ${note.excerpt}\n    ${note.text}`;
		});
		blocks.push(`${edit.path}\n${lines.join("\n")}`);
	}
	if (blocks.length === 0) return null;
	return [
		"Revise the staged edits using these notes. Keep the same files. Do not expand scope. Call propose_edit for each change.",
		"",
		blocks.join("\n\n")
	].join("\n");
}
function notesOn(edits) {
	return edits.reduce((n, edit) => n + (edit.status === "pending" ? edit.notes?.length ?? 0 : 0), 0);
}
function esc(value) {
	const amp = "&";
	return value.replaceAll("&", `${amp}amp;`).replaceAll("<", `${amp}lt;`).replaceAll(">", `${amp}gt;`);
}
function slug(value) {
	return value.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "diff";
}
function filesFromEdits(edits) {
	const byPath = /* @__PURE__ */ new Map();
	for (const edit of edits) {
		const prev = byPath.get(edit.path);
		byPath.set(edit.path, {
			path: edit.path,
			oldText: prev?.oldText ?? edit.oldText,
			newText: edit.newText
		});
	}
	return [...byPath.values()];
}
function filesFromCheckpoint(checkpoint, messages, current) {
	const message = checkpoint.messageId ? messages.find((m) => m.id === checkpoint.messageId) : void 0;
	if (message?.edits?.length) return filesFromEdits(message.edits);
	return Object.entries(checkpoint.before).map(([path, oldText]) => ({
		path,
		oldText: oldText ?? "",
		newText: current[path] ?? ""
	}));
}
function htmlDiffReport(opts) {
	const blocks = opts.files.map((file) => {
		const stats = diffStats(file.oldText, file.newText);
		const rows = lineDiff(file.oldText, file.newText).map((row) => {
			const mark = row.type === "add" ? "+" : row.type === "del" ? "−" : " ";
			return `<div class="ln ${row.type}">${mark} ${esc(row.text)}</div>`;
		}).join("");
		return `<section class="file">
  <header>
    <h2>${esc(file.path)}</h2>
    <p>+${stats.added} −${stats.removed}</p>
  </header>
  <pre>${rows || `<div class="ln eq">  (unchanged)</div>`}</pre>
</section>`;
	});
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(opts.title)} · ${esc(opts.workspace)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #09090b; color: #f4f4f5; font: 14px/1.5 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
    header.top { padding: 28px 32px 12px; border-bottom: 1px solid #27272a; }
    header.top p { margin: 6px 0 0; color: #a1a1aa; }
    h1 { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: -0.02em; }
    .file { margin: 24px 32px 40px; border: 1px solid #27272a; border-radius: 14px; overflow: hidden; background: #111113; }
    .file header { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #27272a; }
    .file h2 { margin: 0; font: 500 13px/1.4 "IBM Plex Mono", ui-monospace, monospace; }
    .file header p { margin: 0; color: #6ee7b7; font-variant-numeric: tabular-nums; }
    pre { margin: 0; padding: 8px 0 12px; font: 12.5px/1.7 "IBM Plex Mono", ui-monospace, monospace; overflow: auto; }
    .ln { padding: 0 16px; white-space: pre-wrap; }
    .add { background: rgba(110, 231, 183, 0.12); color: #b7f5d8; }
    .del { background: rgba(248, 113, 113, 0.12); color: #fecaca; }
    .eq { color: #71717a; }
  </style>
</head>
<body>
  <header class="top">
    <h1>${esc(opts.title)}</h1>
    <p>${esc(opts.workspace)} · ${opts.files.length} ${opts.files.length === 1 ? "file" : "files"} · Aperture</p>
  </header>
  ${blocks.join("\n") || "<p style='padding:32px;color:#a1a1aa'>No file changes.</p>"}
</body>
</html>`;
}
function downloadDiffReport(opts) {
	const html = htmlDiffReport(opts);
	const blob = new Blob([html], { type: "text/html;charset=utf-8" });
	const href = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = href;
	a.download = `aperture-${slug(opts.title)}.html`;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.setTimeout(() => URL.revokeObjectURL(href), 4e3);
}
function ReviewStrip() {
	const messages = useWorkspace((s) => s.messages);
	const activePath = useWorkspace((s) => s.activePath);
	const running = useWorkspace((s) => s.agentRunning);
	const name = useWorkspace((s) => s.name);
	const applyEdit = useWorkspace((s) => s.applyEdit);
	const rejectEdit = useWorkspace((s) => s.rejectEdit);
	const applyAllPending = useWorkspace((s) => s.applyAllPending);
	const rejectAllPending = useWorkspace((s) => s.rejectAllPending);
	const clearPendingNotes = useWorkspace((s) => s.clearPendingNotes);
	const openFile = useWorkspace((s) => s.openFile);
	const rows = pendingByPath(messages);
	const noteCount = notesOn(rows);
	const previewErrors = useIdeUi((s) => s.previewErrors);
	if (running || rows.length === 0) return null;
	function jump(path) {
		openFile(path);
		useIdeUi.getState().setMobilePane("editor");
		if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border bg-elevated",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 px-2.5 py-1.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "min-w-0 flex-1 truncate text-xs text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-fg",
						children: "Review"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-subtle",
						children: [
							" ",
							"· ",
							rows.length,
							" ",
							rows.length === 1 ? "file" : "files",
							" · Enter keep · Backspace skip",
							noteCount > 0 ? ` · ${noteCount} notes` : "",
							previewErrors.length > 0 ? ` · preview ${previewErrors[0]}` : ""
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-7 px-2",
					onClick: () => downloadDiffReport({
						title: rows[0]?.description || "Staged diffs",
						workspace: name,
						files: filesFromEdits(rows)
					}),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDiff, { className: "size-3.5" }), "Report"]
				}),
				noteCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-7 px-2",
					onClick: () => clearPendingNotes(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5" }), "Dismiss notes"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-7 px-2",
					onClick: () => rejectAllPending(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), "Reject all"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					className: "h-7 px-2.5",
					disabled: noteCount > 0,
					title: noteCount > 0 ? "Send or dismiss notes first" : void 0,
					onClick: () => applyAllPending(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "Apply all"]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "max-h-28 overflow-y-auto border-t border-border",
			children: rows.map((edit) => {
				const stats = diffStats(edit.oldText, edit.newText);
				const active = edit.path === activePath;
				const blocked = (edit.notes?.length ?? 0) > 0;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: cn("flex items-center gap-1 px-1.5", active && "bg-list-selected"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left",
							onClick: () => jump(edit.path),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("truncate font-mono text-[12px]", active ? "text-fg" : "text-muted"),
									children: basename(edit.path)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden truncate text-[11px] text-subtle sm:inline",
									children: edit.description
								}),
								blocked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex shrink-0 items-center gap-0.5 text-[10px] text-accent",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3" }), edit.notes?.length]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-auto shrink-0 font-mono text-[11px] tabular-nums text-ok",
									children: ["+", stats.added]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "shrink-0 font-mono text-[11px] tabular-nums text-danger",
									children: ["−", stats.removed]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							className: "size-7",
							"aria-label": `Reject ${edit.path}`,
							onClick: () => rejectEdit(edit.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
						}),
						blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							className: "h-7 px-2",
							onClick: () => clearPendingNotes(edit.id),
							children: "Dismiss"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							className: "h-7 px-2",
							onClick: () => applyEdit(edit),
							children: "Apply"
						})
					]
				}, edit.id);
			})
		})]
	});
}
function lastAssistant(messages) {
	for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === "assistant") return messages[i];
}
function isGenerating(message, mode) {
	if (!message || mode === "chat") return false;
	if (message.awaitingBuild) return false;
	if (message.edits?.length) return true;
	if (message.traces?.some((t) => /edit|write|patch|create/.test(t.name))) return true;
	const status = (message.status ?? "").toLowerCase();
	if (/plan/.test(status)) return false;
	return /build|writ|generat|edit/.test(status);
}
function generatingPath(message, fallback) {
	const traces = message?.traces ?? [];
	for (let i = traces.length - 1; i >= 0; i--) {
		const t = traces[i];
		if (t && typeof t.args.path === "string" && /edit|write|patch|create/.test(t.name)) return t.args.path;
	}
	const edit = message?.edits?.[message.edits.length - 1];
	if (edit?.path) return edit.path;
	for (let i = traces.length - 1; i >= 0; i--) {
		const t = traces[i];
		if (t && typeof t.args.path === "string") return t.args.path;
	}
	return fallback;
}
function streamLines(message, path, files) {
	const edits = message?.edits ?? [];
	const lines = (((path ? [...edits].reverse().find((e) => e.path === path) : void 0) ?? edits[edits.length - 1])?.newText || (path ? files[path] : "") || "").split("\n");
	const start = Math.max(0, lines.length - 16);
	return {
		start,
		lines: lines.slice(start)
	};
}
function GenerateOverlay() {
	const running = useWorkspace((s) => s.agentRunning);
	const mode = useWorkspace((s) => s.runningMode);
	const messages = useWorkspace((s) => s.messages);
	const activePath = useWorkspace((s) => s.activePath);
	const files = useWorkspace((s) => s.files);
	if (!running) return null;
	const last = lastAssistant(messages);
	if (!isGenerating(last, mode)) return null;
	const path = generatingPath(last, activePath);
	const stream = streamLines(last, path, files);
	const label = path ? `Generating ${path}` : last?.status || "Generating…";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "generate-overlay pointer-events-none absolute inset-0 z-10 grid place-items-center px-6",
		"data-testid": "generate-overlay",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-4 flex justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApertureMark, { className: "generate-spin size-9 text-accent" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-center text-sm text-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shimmer-text",
						children: label
					})
				}),
				stream.lines.some((line) => line.trim()) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "generate-stream",
					children: stream.lines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "generate-stream-line",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "generate-gutter",
							children: stream.start + i + 1
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: line || " " })]
					}, stream.start + i))
				})
			]
		})
	});
}
var getAiStatus = createServerFn({ method: "POST" }).handler(createSsrRpc("f06e765097cd01ae1f0ecd38bb7749a1bdb7f0e3a10daf23cb1bb01a7a37343a"));
var runAgent = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("5a883aeda48a7c277fc8d161d1c2939700d59765653c6b0c344daba878a2fb56"));
var PREVIEW_HTML_PATH = "preview.html";
var PREVIEW_CSS_PATH = "preview.css";
var STARTER_PREVIEW_CSS = `:root {
  --bg: #0b0b0e;
  --card: #121214;
  --line: #1f1f24;
  --fg: #e8e8ed;
  --muted: #8b8b93;
  --accent: #3b9eff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 14px/1.45 ui-sans-serif, system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}
.cta {
  border: 0;
  background: var(--accent);
  color: #061018;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.list { margin: 0; padding: 16px; display: grid; gap: 10px; }
.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.card button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}
`;
var STARTER_PREVIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>harbor-api</title>
    <link rel="stylesheet" href="preview.css" />
  </head>
  <body>
    <header class="top">
      <strong>harbor-api</strong>
      <button class="cta" type="button">Create task</button>
    </header>
    <ul class="list">
      <li class="card"><span>Fix listTasks off-by-one</span><button type="button">Done</button></li>
      <li class="card"><span>Return 404 from getTask</span><button type="button">Done</button></li>
      <li class="card"><span>Reject long titles</span><button type="button">Done</button></li>
    </ul>
  </body>
</html>
`;
function htmlFiles(files) {
	return Object.keys(files).filter((path) => /\.html?$/i.test(path)).sort();
}
function pickHtmlEntry(files, activePath) {
	const list = htmlFiles(files);
	if (list.length === 0) return null;
	if (activePath && list.includes(activePath)) return activePath;
	return list.find((path) => /index\.html?$/i.test(path) || path === "preview.html") ?? list[0];
}
function guessSource(files, selector) {
	const id = /#([A-Za-z0-9_-]+)/.exec(selector)?.[1];
	const cls = /\.([A-Za-z0-9_-]+)/.exec(selector)?.[1];
	const needles = [
		id ? `#${id}` : "",
		cls ? `.${cls}` : "",
		cls ?? ""
	].filter(Boolean);
	if (needles.length === 0) return null;
	for (const [path, body] of Object.entries(files)) {
		if (!/\.(html?|css|tsx?|jsx?)$/i.test(path)) continue;
		const lines = body.split("\n");
		for (let i = 0; i < lines.length; i++) if (needles.some((n) => lines[i].includes(n))) return `${path}:${i + 1}`;
	}
	return null;
}
function resolveRel(from, href) {
	const clean = href.split("?")[0].split("#")[0].trim();
	if (!clean || clean.startsWith("data:") || /^[a-z]+:/i.test(clean)) return null;
	const stripped = clean.replace(/^\.\//, "");
	if (stripped.startsWith("/")) return stripped.slice(1);
	const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
	const parts = (dir ? `${dir}/${stripped}` : stripped).split("/");
	const out = [];
	for (const part of parts) {
		if (!part || part === ".") continue;
		if (part === "..") out.pop();
		else out.push(part);
	}
	return out.join("/");
}
function sanitizePreviewHtml(html) {
	return html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<script\b[^>]*\/?>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript:/gi, "").replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "").replace(/<(object|embed|applet|form)\b[\s\S]*?<\/\1>/gi, "").replace(/<base\b[^>]*>/gi, "").replace(/<meta\b[^>]*http-equiv\s*=\s*['"]?refresh[^>]*>/gi, "");
}
function isDesignPayload(value) {
	if (!value || typeof value !== "object") return false;
	const o = value;
	const bounds = o.bounds;
	return typeof o.selector === "string" && o.selector.length <= 240 && typeof o.tag === "string" && o.tag.length <= 40 && typeof o.text === "string" && o.text.length <= 240 && typeof o.html === "string" && o.html.length <= 8e3 && typeof o.neighborhood === "string" && o.neighborhood.length <= 8e3 && typeof o.css === "string" && o.css.length <= 4e3 && Boolean(bounds) && typeof bounds.x === "number" && typeof bounds.y === "number" && typeof bounds.w === "number" && typeof bounds.h === "number" && (o.screenshot === null || typeof o.screenshot === "string");
}
function assembleHtmlPreview(files, entry) {
	let html = sanitizePreviewHtml(files[entry] ?? "");
	if (!html.trim()) html = STARTER_PREVIEW_HTML;
	html = html.replace(/<link\b[^>]*>/gi, (tag) => {
		const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
		if (!href) return tag;
		const path = resolveRel(entry, href);
		if (!path || files[path] === void 0) return tag;
		return `<style data-from="${path}">\n${files[path]}\n</style>`;
	});
	if (!/<body[\s>]/i.test(html)) html = `<!doctype html><html><body>${html}</body></html>`;
	const script = `<script>${PICKER_SCRIPT}<\/script>`;
	if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
	return `${html}${script}`;
}
function previewMarkupKey(html) {
	return html.replace(/<style data-from="[^"]*">[\s\S]*?<\/style>/gi, "<style/>");
}
function cssFromPreview(html) {
	const out = {};
	const re = /<style data-from="([^"]+)">([\s\S]*?)<\/style>/gi;
	let match;
	while (match = re.exec(html)) out[match[1]] = match[2].trim();
	return out;
}
function hotReloadStyles(doc, html) {
	const next = cssFromPreview(html);
	let changed = false;
	for (const el of doc.querySelectorAll("style[data-from]")) {
		const path = el.getAttribute("data-from");
		if (!path || next[path] === void 0) continue;
		if ((el.textContent ?? "").trim() !== next[path]) {
			el.textContent = next[path];
			changed = true;
		}
	}
	return changed;
}
function formatDesignCaptures(captures) {
	if (captures.length === 0) return "";
	return captures.map((c) => {
		const shot = c.screenshot && c.screenshot.length < 14e3 ? `screenshot:\n${c.screenshot}` : `screenshot: ${c.bounds.w}×${c.bounds.h} crop (bytes omitted)`;
		return [
			`Design Mode capture from ${c.path}`,
			`selector: ${c.selector}`,
			`tag: ${c.tag}`,
			c.source ? `source: ${c.source}` : null,
			`text: ${c.text}`,
			c.note ? `intent: ${c.note}` : null,
			`bounds: ${c.bounds.w}×${c.bounds.h} at (${c.bounds.x}, ${c.bounds.y})`,
			`html:\n${c.html}`,
			c.neighborhood ? `neighborhood:\n${c.neighborhood}` : null,
			`css:\n${c.css}`,
			shot
		].filter(Boolean).join("\n");
	}).join("\n\n---\n\n");
}
var PICKER_SCRIPT = `(() => {
  function report(msg) {
    try { parent.postMessage({ type: "aperture-preview-error", message: String(msg).slice(0, 180) }, "*"); } catch (e) {}
  }
  window.addEventListener("error", function (e) { report(e.message || e.type); });
  window.addEventListener("unhandledrejection", function (e) { report(e.reason); });
  document.documentElement.style.cursor = "crosshair";
  const box = document.createElement("div");
  box.setAttribute("data-aperture-picker", "1");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b9eff;background:rgba(59,158,255,.14);display:none;";
  document.documentElement.appendChild(box);
  const keys = ["display","position","top","left","right","bottom","width","height","margin","padding","color","background-color","background-image","font-family","font-size","font-weight","line-height","border","border-radius","flex","gap","align-items","justify-content","text-align","opacity","overflow","box-shadow","z-index"];
  function hit(e) {
    box.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    box.style.display = "block";
    if (!el || el === box || el === document.documentElement || el === document.body) return null;
    return el;
  }
  function selector(el) {
    if (el.id) return el.tagName.toLowerCase() + "#" + el.id;
    const raw = typeof el.className === "string" ? el.className.trim() : "";
    const cls = raw ? "." + raw.split(/\\s+/).slice(0, 3).join(".") : "";
    return el.tagName.toLowerCase() + cls;
  }
  function css(el) {
    const s = getComputedStyle(el);
    return keys.map((k) => k + ": " + s.getPropertyValue(k)).join("; ");
  }
  function snap(el, done) {
    try {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.min(480, Math.round(r.width)));
      const h = Math.max(1, Math.min(280, Math.round(r.height)));
      const clone = el.cloneNode(true);
      const s = getComputedStyle(el);
      clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      clone.style.cssText = "margin:0;position:static;width:" + r.width + "px;height:" + r.height + "px;background:" + s.backgroundColor + ";color:" + s.color + ";font:" + s.font + ";border:" + s.border + ";border-radius:" + s.borderRadius + ";display:" + s.display + ";align-items:" + s.alignItems + ";justify-content:" + s.justifyContent + ";padding:" + s.padding + ";";
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' + new XMLSerializer().serializeToString(clone) + "</foreignObject></svg>";
      const img = new Image();
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) { done(null); return; }
        ctx.fillStyle = s.backgroundColor || "#111";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try { done(c.toDataURL("image/jpeg", 0.7)); } catch (err) { done(null); }
      };
      img.onerror = function () { done(null); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } catch (err) { done(null); }
  }
  window.addEventListener("mousemove", (e) => {
    const el = hit(e);
    if (!el) { box.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left + "px";
    box.style.top = r.top + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
  }, true);
  window.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = hit(e);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const wrap = el.parentElement && el.parentElement !== document.body ? el.parentElement : null;
    const payload = {
      selector: selector(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 160),
      html: (el.outerHTML || "").slice(0, 4000),
      neighborhood: wrap ? (wrap.outerHTML || "").slice(0, 4000) : "",
      css: css(el),
      bounds: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      screenshot: null
    };
    snap(el, (shot) => {
      payload.screenshot = shot;
      parent.postMessage({ type: "aperture-design-pick", payload }, "*");
    });
  }, true);
})();
`;
function describeError(error) {
	const raw = error instanceof Error ? error.message : "Request failed";
	if (/unauthorized/i.test(raw)) return "Sign in to run Composer. Plans and API keys live on the account.";
	return raw;
}
var currentAbort = null;
function abortAgent() {
	currentAbort?.abort();
	currentAbort = null;
	useWorkspace.getState().setAgentRunning(false);
}
async function readSse(res, onEvent, signal) {
	const reader = res.body?.getReader();
	if (!reader) throw new Error("No stream from Composer");
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (signal.aborted) return;
		buffer += decoder.decode(value, { stream: true });
		const chunks = buffer.split("\n\n");
		buffer = chunks.pop() ?? "";
		for (const chunk of chunks) {
			const line = chunk.split("\n").map((l) => l.trim()).find((l) => l.startsWith("data:"));
			if (!line) continue;
			const payload = line.slice(5).trim();
			if (!payload) continue;
			try {
				onEvent(JSON.parse(payload));
			} catch {}
		}
	}
}
function agentPayload(instruction, mode, source, agentId, extra) {
	useWorkspace.getState().syncStackMemory();
	const latest = useWorkspace.getState();
	const { history, compacted } = compactHistory(priorMessages(latest.messages, instruction));
	const captures = formatDesignCaptures(useIdeUi.getState().captures);
	const mentioned = parseMentions(instruction, latest.files);
	const focusPaths = autoContextPaths({
		activePath: latest.activePath,
		openTabs: latest.openTabs,
		recentPaths: latest.recentPaths,
		mentioned,
		extra: [...listPendingEdits(latest.messages).map((e) => e.path), ...isUiTask(instruction) ? nearestUiFiles(latest.files, instruction, latest.activePath, 3) : []]
	});
	return {
		mode,
		instruction: captures ? `${captures}\n\n${instruction}` : instruction,
		history,
		files: Object.entries(latest.files).map(([path, content]) => ({
			path,
			content
		})),
		activePath: latest.activePath,
		selection: latest.selection,
		openTabs: latest.openTabs,
		recentPaths: latest.recentPaths,
		focusPaths,
		source: source ?? void 0,
		agentId: agentId ?? null,
		phase: extra?.phase,
		approvedPlan: extra?.approvedPlan,
		workers: extra?.workers,
		role: extra?.role,
		pendingEdits: extra?.pendingEdits ?? listPendingEdits(latest.messages),
		debug: useIdeUi.getState().debug,
		compacted: compacted || void 0
	};
}
async function submitAgent(instruction, mode, source, opts) {
	const trimmed = instruction.trim();
	if (!trimmed) return;
	const state = useWorkspace.getState();
	if (state.agentRunning) return;
	const stamp = Date.now();
	const userId = `u_${stamp}`;
	const asstId = `a_${stamp}`;
	const agentLabel = opts?.agentLabel?.trim() || "Aperture";
	const phase = opts?.phase;
	const planning = mode === "composer" && phase !== "skip" && phase !== "build";
	state.addMessage({
		id: userId,
		role: "user",
		content: trimmed,
		createdAt: stamp
	});
	state.addMessage({
		id: asstId,
		role: "assistant",
		content: "",
		status: opts?.agentId ? `ACP session/new · ${agentLabel}` : mode === "chat" ? "Analyzing your code…" : phase === "build" ? "Building…" : phase === "skip" ? "Writing…" : planning ? "Planning…" : "Working…",
		agentLabel,
		createdAt: stamp + 1
	});
	state.setAgentRunning(true, mode);
	const input = agentPayload(opts?.apiInstruction ?? (phase === "build" && opts?.approvedPlan?.length ? `${trimmed}\n\nApproved plan:\n${opts.approvedPlan.map((e, i) => `${i + 1}. ${e.content}`).join("\n")}` : trimmed), mode, source, opts?.agentId, {
		phase,
		approvedPlan: opts?.approvedPlan,
		workers: opts?.workers,
		role: opts?.role,
		pendingEdits: opts?.pendingEdits
	});
	if (mode === "inline") {
		try {
			const result = await runAgent({ data: input });
			if (!result.ok) {
				useWorkspace.getState().patchMessage(asstId, {
					content: result.error,
					status: void 0
				});
				return;
			}
			useWorkspace.getState().patchMessage(asstId, {
				content: result.text,
				traces: result.traces,
				edits: result.edits,
				plan: result.plan,
				status: void 0,
				debug: result.debug
			});
		} catch (error) {
			useWorkspace.getState().patchMessage(asstId, {
				content: describeError(error),
				status: void 0
			});
		} finally {
			useWorkspace.getState().setAgentRunning(false);
		}
		return;
	}
	currentAbort?.abort();
	const abort = new AbortController();
	currentAbort = abort;
	try {
		const token = getBearerToken();
		const res = await fetch("/api/agent", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...token ? { Authorization: `Bearer ${token}` } : {}
			},
			credentials: "include",
			body: JSON.stringify(input),
			signal: abort.signal
		});
		if (res.status === 401) {
			useWorkspace.getState().patchMessage(asstId, {
				content: "Sign in to run Composer. Plans and API keys live on the account.",
				status: void 0
			});
			return;
		}
		const contentType = res.headers.get("content-type") ?? "";
		if (!res.ok || !contentType.includes("text/event-stream")) {
			let message = `Composer failed (${res.status})`;
			try {
				const body = await res.json();
				if (body.error) message = body.error;
			} catch {}
			useWorkspace.getState().patchMessage(asstId, {
				content: message,
				status: void 0
			});
			return;
		}
		let text = "";
		let traces = [];
		let edits = [];
		let plan = [];
		await readSse(res, (event) => {
			const ws = useWorkspace.getState();
			if (event.type === "status") {
				ws.patchMessage(asstId, {
					status: event.text,
					traces,
					edits,
					plan
				});
				return;
			}
			if (event.type === "text") {
				text += event.delta;
				ws.patchMessage(asstId, {
					content: text,
					traces,
					edits,
					plan,
					status: void 0
				});
				return;
			}
			if (event.type === "plan") {
				plan = event.entries;
				ws.patchMessage(asstId, {
					content: text,
					traces,
					edits,
					plan,
					status: void 0
				});
				return;
			}
			if (event.type === "trace") {
				traces = [...traces, event.trace];
				ws.patchMessage(asstId, {
					content: text,
					traces,
					edits,
					plan,
					status: `${event.trace.name}…`
				});
				return;
			}
			if (event.type === "edits") {
				edits = event.edits;
				ws.patchMessage(asstId, {
					content: text,
					traces,
					edits,
					plan
				});
				const last = edits[edits.length - 1];
				if (last?.path) ws.openFile(last.path);
				return;
			}
			if (event.type === "done") {
				text = event.text;
				traces = event.traces;
				edits = event.edits;
				plan = event.plan ?? plan;
				if (Boolean(opts?.workers?.length && opts.workers.every((w) => w.role === "review")) && edits.length) {
					for (const patch of attachNotesToPending(ws.messages, edits)) ws.patchMessage(patch.id, { edits: patch.edits });
					edits = [];
				}
				ws.patchMessage(asstId, {
					content: text,
					traces,
					edits,
					plan,
					status: void 0,
					awaitingBuild: Boolean(event.awaitingBuild),
					debug: event.debug
				});
				const firstPending = edits.find((e) => e.status === "pending");
				if (firstPending?.path) ws.openFile(firstPending.path);
				return;
			}
			if (event.type === "error") ws.patchMessage(asstId, {
				content: event.error || "Agent failed",
				traces,
				edits,
				plan,
				status: void 0
			});
		}, abort.signal);
		const latest = useWorkspace.getState().messages.find((m) => m.id === asstId);
		if (latest && !latest.content && traces.length === 0 && (latest.plan?.length ?? 0) === 0) useWorkspace.getState().patchMessage(asstId, {
			content: "Stopped.",
			status: void 0
		});
	} catch (error) {
		if (abort.signal.aborted) {
			const latest = useWorkspace.getState().messages.find((m) => m.id === asstId);
			if (latest && !latest.content) useWorkspace.getState().patchMessage(asstId, {
				content: "Stopped.",
				status: void 0
			});
			return;
		}
		useWorkspace.getState().patchMessage(asstId, {
			content: describeError(error),
			status: void 0
		});
	} finally {
		if (currentAbort === abort) currentAbort = null;
		useWorkspace.getState().setAgentRunning(false);
	}
}
function explainPrompt(path, fromLine, toLine) {
	return `Explain the selected code in ${path} (L${fromLine}–${toLine}). First say what it is and how it works. Then 2–4 key insights. Do not edit.`;
}
function useAssistActions() {
	const selection = useWorkspace((s) => s.selection);
	const activePath = useWorkspace((s) => s.activePath);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const { user } = useCurrentUserState();
	const { account, refresh } = useAccount();
	const quote = quoteRun(account, account?.modelSource ?? "hosted");
	const ranged = hasCodeRange(selection);
	async function run(kind) {
		if (agentRunning) return;
		if ((kind === "explain" || kind === "fix") && !ranged) {
			toast.message("No code selected", { description: "Select some code in the editor to explain or fix it." });
			return;
		}
		if (!user) {
			toast.error("Sign in to run Composer.");
			return;
		}
		if (quote.blocked) {
			toast.error(quote.blockReason ?? "This run is blocked.");
			return;
		}
		useIdeUi.getState().setChatOpen(true);
		useIdeUi.getState().setMobilePane("agent");
		const source = account?.modelSource ?? "hosted";
		if (kind === "explain" && selection) await submitAgent(explainPrompt(selection.path, selection.fromLine, selection.toLine), "chat", source);
		else if (kind === "fix") await submitAgent("Fix the selected code. Keep the change as small as possible.", "composer", source, { phase: "skip" });
		else await submitAgent(`Find bugs${activePath ? ` in @${activePath}` : ""}. Cite path:line. Do not edit unless I ask.`, "chat", source);
		refresh();
	}
	return {
		run,
		ranged,
		agentRunning,
		selection
	};
}
function SelectionActions() {
	const { run, ranged, agentRunning, selection } = useAssistActions();
	if (!ranged || agentRunning || !selection) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface/95 px-2 py-1.5 shadow-[var(--shadow-float)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "hidden max-w-40 truncate px-1.5 font-mono text-[11px] text-subtle sm:block",
					children: [
						selection.path,
						":",
						selection.fromLine,
						selection.toLine !== selection.fromLine ? `–${selection.toLine}` : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-7 px-2",
					onClick: () => void run("explain"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Explain"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					className: "h-7 px-2.5",
					onClick: () => void run("fix"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WandSparkles, { className: "size-3.5" }), "Fix this"]
				})
			]
		})
	});
}
function AssistChips({ className }) {
	const { run, ranged, agentRunning } = useAssistActions();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-wrap gap-1.5", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "assist-chip",
				disabled: agentRunning,
				onClick: () => void run("explain"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }),
					"Explain this",
					!ranged && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-subtle",
						children: " · select"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "assist-chip",
				disabled: agentRunning,
				onClick: () => void run("fix"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WandSparkles, { className: "size-3.5" }), "Fix this"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "assist-chip",
				disabled: agentRunning,
				onClick: () => void run("bugs"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bug, { className: "size-3.5" }), "Find bugs"]
			})
		]
	});
}
function parseMarkdown(src) {
	const lines = src.replace(/\r\n/g, "\n").split("\n");
	const out = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.startsWith("```")) {
			const lang = line.slice(3).trim();
			const body = [];
			i += 1;
			while (i < lines.length && !lines[i].startsWith("```")) {
				body.push(lines[i]);
				i += 1;
			}
			if (i < lines.length) i += 1;
			out.push({
				type: "code",
				lang,
				text: body.join("\n")
			});
			continue;
		}
		const heading = /^(#{1,3})\s+(.+)$/.exec(line);
		if (heading) {
			out.push({
				type: "h",
				level: heading[1].length,
				text: heading[2].trim()
			});
			i += 1;
			continue;
		}
		if (line.startsWith("> ")) {
			out.push({
				type: "quote",
				text: line.slice(2)
			});
			i += 1;
			continue;
		}
		if (/^\s*[-*]\s+/.test(line)) {
			const items = [];
			while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
				items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
				i += 1;
			}
			out.push({
				type: "ul",
				items
			});
			continue;
		}
		if (!line.trim()) {
			i += 1;
			continue;
		}
		const para = [];
		while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith("```") && !/^\s*[-*]\s+/.test(lines[i])) {
			para.push(lines[i]);
			i += 1;
		}
		out.push({
			type: "p",
			text: para.join(" ")
		});
	}
	return out;
}
function Inline({ text }) {
	const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: parts.map((part, i) => {
		if (part.startsWith("**") && part.endsWith("**")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: part.slice(2, -2) }, i);
		if (part.startsWith("*") && part.endsWith("*")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: part.slice(1, -1) }, i);
		if (part.startsWith("`") && part.endsWith("`")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
			className: "rounded-sm bg-elevated px-1 font-mono text-[12px]",
			children: part.slice(1, -1)
		}, i);
		const link = /^\[([^\]]+)\]\((https?:[^)]+)\)$/.exec(part);
		if (link) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
			href: link[2],
			className: "text-accent underline-offset-2 hover:underline",
			target: "_blank",
			rel: "noreferrer",
			children: link[1]
		}, i);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: part }, i);
	}) });
}
function MarkdownPreview({ text }) {
	const blocks = parseMarkdown(text);
	if (blocks.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-6 py-8 text-sm text-subtle",
		children: "Empty markdown."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "aperture-scroll h-full overflow-auto px-6 py-4",
		children: blocks.map((block, i) => {
			if (block.type === "h") {
				const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
					className: block.level === 1 ? "mb-3 text-lg font-semibold text-fg" : block.level === 2 ? "mb-2 mt-4 text-base font-semibold text-fg" : "mb-2 mt-3 text-sm font-semibold text-fg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inline, { text: block.text })
				}, i);
			}
			if (block.type === "ul") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mb-3 list-disc space-y-1 pl-5 text-sm text-fg",
				children: block.items.map((item, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inline, { text: item }) }, j))
			}, i);
			if (block.type === "code") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "aperture-scroll mb-3 overflow-auto rounded-lg border border-border bg-elevated p-3 font-mono text-[12px] leading-5 text-fg",
				children: block.text
			}, i);
			if (block.type === "quote") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
				className: "mb-3 border-l-2 border-accent pl-3 text-sm text-muted",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inline, { text: block.text })
			}, i);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-sm leading-relaxed text-fg",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inline, { text: block.text })
			}, i);
		})
	});
}
function DesignPane() {
	const files = useWorkspace((s) => s.files);
	const activePath = useWorkspace((s) => s.activePath);
	const createFile = useWorkspace((s) => s.createFile);
	const captures = useIdeUi((s) => s.captures);
	const addCapture = useIdeUi((s) => s.addCapture);
	const updateCapture = useIdeUi((s) => s.updateCapture);
	const removeCapture = useIdeUi((s) => s.removeCapture);
	const pages = (0, import_react.useMemo)(() => htmlFiles(files), [files]);
	const [entry, setEntry] = (0, import_react.useState)(() => pickHtmlEntry(files, activePath));
	const [editingId, setEditingId] = (0, import_react.useState)(null);
	const [draft, setDraft] = (0, import_react.useState)("");
	const frameRef = (0, import_react.useRef)(null);
	const lastEntry = (0, import_react.useRef)(null);
	const lastHtml = (0, import_react.useRef)("");
	const pulseTimer = (0, import_react.useRef)(0);
	const [pulse, setPulse] = (0, import_react.useState)(null);
	const srcdoc = entry && files[entry] !== void 0 ? assembleHtmlPreview(files, entry) : "";
	(0, import_react.useEffect)(() => {
		const next = pickHtmlEntry(files, activePath);
		setEntry((prev) => prev && files[prev] !== void 0 ? prev : next);
	}, [files, activePath]);
	(0, import_react.useEffect)(() => {
		const iframe = frameRef.current;
		if (!iframe || !srcdoc || !entry) return;
		if (srcdoc === lastHtml.current && lastEntry.current === entry) return;
		const doc = iframe.contentDocument;
		const samePage = lastEntry.current === entry && Boolean(doc?.documentElement) && lastHtml.current !== "";
		if (samePage && previewMarkupKey(lastHtml.current) === previewMarkupKey(srcdoc)) {
			lastHtml.current = srcdoc;
			if (hotReloadStyles(doc, srcdoc)) flash("CSS");
			return;
		}
		const scroll = samePage ? {
			x: iframe.contentWindow?.scrollX ?? 0,
			y: iframe.contentWindow?.scrollY ?? 0
		} : null;
		lastEntry.current = entry;
		lastHtml.current = srcdoc;
		if (scroll) {
			iframe.onload = () => {
				iframe.contentWindow?.scrollTo(scroll.x, scroll.y);
				iframe.onload = null;
			};
			flash("HTML");
		}
		iframe.srcdoc = srcdoc;
	}, [srcdoc, entry]);
	(0, import_react.useEffect)(() => {
		useIdeUi.getState().setPreviewErrors([]);
	}, [srcdoc]);
	function flash(kind) {
		setPulse(kind);
		window.clearTimeout(pulseTimer.current);
		pulseTimer.current = window.setTimeout(() => setPulse(null), 900);
	}
	(0, import_react.useEffect)(() => {
		function onMsg(event) {
			if (event.source !== frameRef.current?.contentWindow) return;
			const data = event.data;
			if (data?.type === "aperture-preview-error") {
				const line = (data.message ?? "Preview error").trim();
				if (!line) return;
				const prev = useIdeUi.getState().previewErrors;
				if (prev.includes(line)) return;
				useIdeUi.getState().setPreviewErrors([...prev, line]);
				if (prev.length === 0) toast.error(line.slice(0, 80));
				return;
			}
			if (data?.type !== "aperture-design-pick" || !isDesignPayload(data.payload) || !entry) return;
			const id = `d_${Date.now()}`;
			addCapture({
				...data.payload,
				neighborhood: data.payload.neighborhood ?? "",
				id,
				path: entry,
				source: guessSource(useWorkspace.getState().files, data.payload.selector),
				note: ""
			});
			setEditingId(id);
			setDraft("");
			toast.success(`Pinned ${data.payload.selector}`);
		}
		window.addEventListener("message", onMsg);
		return () => window.removeEventListener("message", onMsg);
	}, [addCapture, entry]);
	function seedPreview() {
		if (files["preview.css"] === void 0) createFile(PREVIEW_CSS_PATH, STARTER_PREVIEW_CSS);
		if (files["preview.html"] === void 0) createFile(PREVIEW_HTML_PATH, STARTER_PREVIEW_HTML);
		setEntry(PREVIEW_HTML_PATH);
	}
	function saveNote() {
		if (!editingId) return;
		updateCapture(editingId, { note: draft.trim() });
		setEditingId(null);
		setDraft("");
	}
	function sendToComposer() {
		if (editingId) saveNote();
		useIdeUi.setState({
			chatOpen: true,
			mobilePane: "agent",
			designOpen: true
		});
		toast.success(`${captures.length} note${captures.length === 1 ? "" : "s"} in Composer`);
	}
	if (pages.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid h-full place-items-center px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-sm text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, { className: "mx-auto size-6 text-accent" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm font-medium text-fg",
					children: "Design Mode"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted",
					children: "Click any element on a page. HTML, CSS, and a crop pin here — add what to change, then send them to Composer."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					className: "mt-4",
					onClick: seedPreview,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), "Create preview.html"]
				})
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-8 shrink-0 items-center gap-2 border-b border-border px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, { className: "size-3.5 text-accent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[12px] font-medium text-fg",
						children: "Design Mode"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: entry ?? pages[0],
						onChange: (e) => setEntry(e.target.value),
						className: "h-6 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-[11px] text-fg",
						"aria-label": "Preview page",
						children: pages.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: path,
							children: path
						}, path))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("text-[11px]", pulse ? "text-ok" : "hidden text-subtle sm:inline"),
						children: pulse ? `Hot reload · ${pulse}` : "Click to pin"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
					ref: frameRef,
					title: "Design Mode",
					sandbox: "allow-scripts",
					referrerPolicy: "no-referrer",
					className: "absolute inset-0 h-full w-full border-0 bg-white"
				}), captures.map((cap, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cn("absolute z-10 grid size-5 place-items-center rounded-full text-[10px] font-semibold shadow-sm", editingId === cap.id ? "bg-accent text-bg" : "bg-fg text-bg"),
					style: {
						left: Math.max(4, cap.bounds.x),
						top: Math.max(4, cap.bounds.y)
					},
					"aria-label": `Note ${i + 1}: ${cap.selector}`,
					onClick: () => {
						setEditingId(cap.id);
						setDraft(cap.note);
					},
					children: i + 1
				}, cap.id))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-h-44 shrink-0 border-t border-border",
				children: [captures.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-3 py-2 text-xs text-subtle",
					children: "Click an element. Notes stay here until you send them to Composer."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "aperture-scroll max-h-32 overflow-y-auto",
					children: captures.map((cap, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "border-b border-border px-3 py-2 last:border-b-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-semibold text-fg",
									children: i + 1
								}),
								cap.screenshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: cap.screenshot,
									alt: "",
									className: "mt-0.5 size-8 shrink-0 rounded-sm object-cover"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate font-mono text-[11px] text-fg",
											children: cap.selector
										}),
										cap.source && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-[10px] text-subtle",
											children: cap.source
										}),
										editingId === cap.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
												value: draft,
												onChange: (e) => setDraft(e.target.value),
												placeholder: "What should change?",
												rows: 2,
												className: "w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-subtle"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-1 flex gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													size: "sm",
													className: "h-7 px-2 text-[11px]",
													onClick: saveNote,
													children: "Save"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													size: "sm",
													variant: "ghost",
													className: "h-7 px-2 text-[11px]",
													onClick: () => {
														setEditingId(null);
														setDraft("");
													},
													children: "Cancel"
												})]
											})]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "mt-0.5 text-left text-[11px] text-muted hover:text-fg",
											onClick: () => {
												setEditingId(cap.id);
												setDraft(cap.note);
											},
											children: cap.note || "Edit — add what to change"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": `Remove ${cap.selector}`,
									className: "grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:text-danger",
									onClick: () => {
										if (editingId === cap.id) {
											setEditingId(null);
											setDraft("");
										}
										removeCapture(cap.id);
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
								})
							]
						})
					}, cap.id))
				}), captures.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 border-t border-border px-3 py-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-subtle",
						children: [
							captures.length,
							" note",
							captures.length === 1 ? "" : "s"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						className: "h-7",
						onClick: sendToComposer,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-3.5" }), "Send to Composer"]
					})]
				})]
			})
		]
	});
}
function CodeStage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-full min-h-0 min-w-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodePane, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenerateOverlay, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectionActions, {})
		]
	});
}
function useColumnWide(min) {
	const ref = (0, import_react.useRef)(null);
	const [wide, setWide] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		const read = () => {
			const next = el.clientWidth >= min;
			setWide((prev) => prev === next ? prev : next);
		};
		read();
		const ro = new ResizeObserver(read);
		ro.observe(el);
		return () => ro.disconnect();
	}, [min]);
	return {
		ref,
		wide
	};
}
function CodeDesignSplit({ code, preview, split, peek }) {
	const together = split && peek;
	const { ref, wide } = useColumnWide(560);
	const stack = together && !wide;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		className: "ide-split",
		"data-split": split ? "on" : "off",
		"data-peek": peek ? "on" : "off",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(qt, {
			id: "aperture-code-design",
			orientation: stack ? "vertical" : "horizontal",
			className: "h-full min-h-0 min-w-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
					id: "code-peek",
					defaultSize: "38%",
					minSize: "16%",
					maxSize: "80%",
					className: "min-h-0 overflow-hidden",
					children: code
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(nn, {
					id: "sep-code-design",
					className: cn("z-10 bg-border hover:bg-accent data-[active]:bg-accent", stack ? "h-2" : "w-2"),
					title: "Drag to resize code and preview"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
					id: "design-peek",
					minSize: "20%",
					className: "min-h-0 overflow-hidden",
					children: preview
				})
			]
		})
	});
}
function EditorColumn() {
	const activePath = useWorkspace((s) => s.activePath);
	const body = useWorkspace((s) => s.activePath ? s.files[s.activePath] ?? "" : "");
	const previewOpen = useIdeUi((s) => s.designOpen);
	const codePeek = useIdeUi((s) => s.codePeek);
	const markdown = Boolean(activePath && languageFromPath(activePath) === "markdown");
	const showMarkdown = previewOpen && markdown;
	const showDesign = previewOpen && !markdown;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ide-editor bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabBar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Breadcrumbs, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewStrip, {})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeDesignSplit, {
				code: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeStage, {}),
				preview: showDesign ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DesignPane, {}) : showMarkdown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full min-h-0 overflow-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkdownPreview, { text: body })
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full bg-bg" }),
				split: showMarkdown || showDesign,
				peek: codePeek
			})
		]
	});
}
function latestAssistantPlan(messages) {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		const plan = message.plan ?? [];
		const current = plan.find((e) => e.status === "in_progress") ?? plan.find((e) => e.status === "pending");
		const tool = message.traces?.at(-1)?.name ?? null;
		if (plan.length > 0 || message.awaitingBuild || tool) return {
			plan,
			awaiting: Boolean(message.awaitingBuild),
			current,
			tool
		};
	}
	return {
		plan: [],
		awaiting: false,
		current: void 0,
		tool: null
	};
}
function resolveAgentTask(input) {
	const { plan, awaiting, current, tool } = latestAssistantPlan(input.messages);
	const done = plan.filter((e) => e.status === "completed").length;
	const total = plan.length;
	if (input.running) {
		const status = [...input.messages].reverse().find((m) => m.role === "assistant")?.status ?? "";
		return {
			kind: "running",
			label: /Build/i.test(status) ? "Building" : /Writ|Iterat|Verif/i.test(status) ? "Iterating" : /Analyz|Ask/i.test(status) ? "Asking" : "Planning",
			detail: current?.content || tool || "Composer",
			done,
			total
		};
	}
	if (awaiting) return {
		kind: "awaiting",
		label: "Needs you",
		detail: current?.content || "Build the plan",
		done,
		total
	};
	if (input.indexing) return {
		kind: "indexing",
		label: "Indexing",
		detail: "",
		done,
		total
	};
	if (input.preview) return {
		kind: "preview",
		label: "Design Mode",
		detail: total ? `${done}/${total}` : "",
		done,
		total
	};
	if (total > 0 && done < total) return {
		kind: "ready",
		label: "Plan",
		detail: current?.content || `${done}/${total}`,
		done,
		total
	};
	return {
		kind: "ready",
		label: "Ready",
		detail: "",
		done,
		total
	};
}
function StatusBar({ aiLabel }) {
	const activePath = useWorkspace((s) => s.activePath);
	const indexing = useWorkspace((s) => s.indexing);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const files = useWorkspace((s) => s.fileList);
	const selection = useWorkspace((s) => s.selection);
	const messages = useWorkspace((s) => s.messages);
	const staged = useWorkspace((s) => listPendingEdits(s.messages).length);
	const snapshots = useWorkspace((s) => s.checkpoints.length);
	const dirty = useWorkspace((s) => s.dirtyPaths.length);
	const debug = useIdeUi((s) => s.debug);
	const designOpen = useIdeUi((s) => s.designOpen);
	const captures = useIdeUi((s) => s.captures.length);
	const setHistoryOpen = useIdeUi((s) => s.setHistoryOpen);
	const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
	const lang = activePath ? languageLabel(activePath) : "";
	const line = selection && selection.path === activePath ? selection.fromLine : null;
	const fileCount = files.length;
	const task = resolveAgentTask({
		running: agentRunning,
		indexing,
		preview: designOpen,
		messages
	});
	function openComposer() {
		useIdeUi.setState({
			chatOpen: true,
			mobilePane: "agent"
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ide-status",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: openComposer,
					className: cn("inline-flex min-w-0 max-w-full items-center gap-1.5 hover:text-fg", task.kind === "running" && "shimmer-text", task.kind === "awaiting" && "text-ok", task.kind === "ready" && "text-fg"),
					"aria-label": `${task.label}${task.detail ? ` · ${task.detail}` : ""}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3 shrink-0" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0",
							children: task.label
						}),
						task.total > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "shrink-0 tabular-nums text-subtle",
							children: [
								task.done,
								"/",
								task.total
							]
						}),
						task.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate text-subtle",
							children: task.detail
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "hidden shrink-0 tabular-nums sm:inline",
					children: [
						fileCount,
						" ",
						fileCount === 1 ? "file" : "files"
					]
				}),
				dirty > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "hidden shrink-0 text-fg sm:inline",
					children: [dirty, " unsaved"]
				}),
				staged > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "shrink-0 text-ok hover:text-fg",
					onClick: () => useIdeUi.setState({
						chatOpen: true,
						mobilePane: "editor"
					}),
					children: [
						staged,
						" ",
						staged === 1 ? "diff" : "diffs"
					]
				}),
				captures > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "hidden shrink-0 hover:text-fg sm:inline",
					onClick: () => useIdeUi.setState({
						designOpen: true,
						mobilePane: "editor"
					}),
					children: [
						captures,
						" ",
						captures === 1 ? "note" : "notes"
					]
				}),
				snapshots > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "hidden hover:text-fg sm:inline",
					onClick: () => setHistoryOpen(true),
					children: "History"
				}),
				debug && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-warn",
					children: "Debug"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3",
			children: [
				line != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "hidden tabular-nums md:inline",
					children: ["Line ", line]
				}),
				lang && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden md:inline",
					children: lang
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden shrink-0 text-subtle md:inline",
					title: "Agents wait for Build it and Apply. Nothing runs unattended.",
					children: "Manual"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: aiLabel === "Sign in" ? "/login" : "/settings",
					search: aiLabel === "Sign in" ? { next: "/app" } : { tab: "models" },
					className: "max-w-36 truncate hover:text-fg",
					children: aiLabel
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "hidden hover:text-fg sm:inline",
					onClick: () => setHelpOpen(true),
					children: "How this works"
				})
			]
		})]
	});
}
function PlanCard({ entries, awaitingBuild = false }) {
	if (entries.length === 0) return null;
	const done = entries.filter((e) => e.status === "completed").length;
	const live = entries.some((e) => e.status === "in_progress");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2 overflow-hidden rounded-lg border border-border bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2 px-2.5 pt-2 pb-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[0.65rem] tracking-[0.14em] text-subtle uppercase",
				children: "Plan"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] text-subtle",
				children: [
					done,
					"/",
					entries.length,
					awaitingBuild ? " · waiting" : live ? " · running" : done === entries.length ? " · done" : ""
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "py-1",
			children: entries.map((entry, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-start gap-2 px-3 py-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusIcon, { status: entry.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: cn("min-w-0 flex-1 text-[12px] leading-snug", entry.status === "completed" ? "text-subtle line-through" : "text-fg", entry.status === "in_progress" && "text-accent"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mr-1.5 font-mono text-[10px] text-subtle",
						children: String(i + 1).padStart(2, "0")
					}), entry.content]
				})]
			}, entry.id))
		})]
	});
}
function StatusIcon({ status }) {
	if (status === "completed") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
		className: "mt-0.5 size-3.5 shrink-0 text-ok",
		"aria-hidden": true
	});
	if (status === "in_progress") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleDot, {
		className: "mt-0.5 size-3.5 shrink-0 text-accent",
		"aria-hidden": true
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, {
		className: "mt-0.5 size-3.5 shrink-0 text-subtle",
		"aria-hidden": true
	});
}
function iconFor(name) {
	if (name === "fix") return Wrench;
	if (name === "explain") return Search;
	return Sparkles;
}
function SlashPopover({ items, active, onPick }) {
	if (items.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-elevated py-1",
		children: items.map((item, index) => {
			const Icon = iconFor(item.name);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onMouseDown: (e) => {
					e.preventDefault();
					onPick(item);
				},
				className: cn("flex w-full items-start gap-2 px-2.5 py-1.5 text-left", index === active ? "bg-list-focus text-fg" : "text-muted hover:bg-list-hover hover:text-fg"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "mt-0.5 size-3.5 shrink-0",
					strokeWidth: 1.7
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block font-mono text-[13px] text-fg",
						children: ["/", item.name]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-[11px] leading-snug text-subtle",
						children: item.description
					})]
				})]
			}) }, item.name);
		})
	});
}
function mentionIcon(item) {
	if (item.path === "codebase") return Library;
	if (item.path === "repo-map") return ListTree;
	if (item.kind === "folder") return Folder;
	return FileCode;
}
function MentionPopover({ items, active, onPick }) {
	if (items.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-elevated py-1",
		children: items.map((item, index) => {
			const Icon = mentionIcon(item);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onMouseDown: (e) => {
					e.preventDefault();
					onPick(item);
				},
				className: cn("flex w-full items-start gap-2 px-2.5 py-1.5 text-left", index === active ? "bg-list-focus text-fg" : "text-muted hover:bg-list-hover hover:text-fg"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "mt-0.5 size-3.5 shrink-0",
						strokeWidth: 1.7
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate font-mono text-[13px] text-fg",
							children: item.path
						}), item.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate text-[11px] leading-snug text-subtle",
							children: item.description
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 shrink-0 text-[10px] tracking-wide text-subtle uppercase",
						children: item.kind === "source" ? "ctx" : item.kind
					})
				]
			}) }, `${item.kind}:${item.path}`);
		})
	});
}
function CostMeter({ quote, acpLabel, acpRemote }) {
	if (acpLabel && acpRemote) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "min-w-0 truncate text-[11px] text-subtle",
		children: [
			"ACP session on ",
			acpLabel,
			" · same diff UI · no hosted turn"
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: cn("truncate text-[11px]", quote.blocked && quote.blockReason ? "text-warn" : "text-subtle"),
			children: [
				quote.label,
				acpLabel ? ` · ACP ${acpLabel}` : "",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-subtle",
					children: [" · ", quote.sub]
				})
			]
		}), quote.blocked && quote.blockReason && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-0.5 text-[11px] leading-snug text-warn",
			children: [
				quote.blockReason,
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings",
					search: { tab: "limits" },
					className: cn(buttonVariants({
						variant: "ghost",
						size: "sm"
					}), "inline h-auto px-0 text-[11px] text-accent"),
					children: "Limits"
				})
			]
		})]
	});
}
var Textarea = (0, import_react.forwardRef)(function Textarea({ className, ...props }, ref) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		ref,
		className: cn("min-h-20 w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-fg placeholder:text-subtle", "transition-[box-shadow,border-color] duration-150 ease-out", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", className),
		...props
	});
});
var listJobs = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("2545e838152aebcc44ecadc566d3d3c7a5086bb0080a371b67dff82079e39e6a"));
var startJob = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("45eee6b45f13cc2c0aafd492fabcb4c4120d8ed3a7b9f7df7944466fbf99c0d5"));
var cancelJob = createServerFn({ method: "POST" }).validator((id) => id).middleware([authMiddleware]).handler(createSsrRpc("e54b9f52e92fd0ce5c89cc29868ce677b67be7b8d0ad8342d78166a538cfdfe0"));
function JobsTray({ jobs, cap, liveCount, acp, onJobs }) {
	const [patchOpen, setPatchOpen] = (0, import_react.useState)(false);
	const [patch, setPatch] = (0, import_react.useState)("");
	const visible = jobs.filter((j) => j.status === "queued" || j.status === "running" || j.status === "done" && (j.edits?.length ?? 0) > 0).slice(0, 4);
	function importJob(job) {
		const edits = (job.edits ?? []).map((edit, i) => ({
			...edit,
			id: `${job.id}_${i}_${edit.path}`,
			status: "pending"
		}));
		useWorkspace.getState().addMessage({
			id: `a_${job.id}`,
			role: "assistant",
			content: job.text?.trim() || "Background job finished.",
			edits,
			agentLabel: job.agentName ?? "Aperture",
			createdAt: Date.now()
		});
		toast.success("Opened in Composer");
	}
	function applyPatch() {
		const files = useWorkspace.getState().files;
		const result = parseUnifiedDiff(patch, files);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		useWorkspace.getState().addMessage({
			id: `a_patch_${Date.now()}`,
			role: "assistant",
			content: "Imported a patch into the same diff UI.",
			edits: result,
			agentLabel: "ACP patch",
			createdAt: Date.now()
		});
		setPatch("");
		setPatchOpen(false);
		toast.success(`${result.length} staged ${result.length === 1 ? "diff" : "diffs"}`);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-t border-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 px-3 py-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[11px] text-subtle",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "mr-1 inline size-3" }),
						liveCount,
						"/",
						cap,
						" background ",
						cap === 1 ? "job" : "jobs"
					]
				}), acp && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-[11px] text-muted hover:text-fg",
					onClick: () => setPatchOpen((v) => !v),
					children: "Import patch"
				})]
			}),
			visible.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-1 px-3 pb-2",
				children: visible.map((job) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-2 rounded-md bg-bg px-2 py-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 shrink-0 rounded-full", job.status === "running" || job.status === "queued" ? "bg-accent" : job.status === "done" ? "bg-ok" : "bg-danger") }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0 flex-1 truncate text-[11px] text-muted",
							children: [job.agentName ? `${job.agentName} · ` : "", job.instruction]
						}),
						job.status === "done" && job.edits && job.edits.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							className: "h-6 px-2 text-[11px]",
							onClick: () => importJob(job),
							children: "Open"
						}),
						(job.status === "queued" || job.status === "running") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "icon-sm",
							variant: "ghost",
							"aria-label": "Stop job",
							onClick: async () => {
								try {
									onJobs(await cancelJob({ data: job.id }));
								} catch (error) {
									toast.error(error instanceof Error ? error.message : "Could not stop");
								}
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3 fill-current" })
						})
					]
				}, job.id))
			}),
			patchOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "px-3 pb-3",
				onSubmit: (e) => {
					e.preventDefault();
					applyPatch();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: patch,
					onChange: (e) => setPatch(e.target.value),
					placeholder: "Paste a unified diff from Claude Code, Codex, or OpenCode",
					className: "min-h-24 font-mono text-[12px]"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex justify-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "ghost",
						onClick: () => setPatchOpen(false),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Cancel"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						disabled: !patch.trim(),
						children: "Stage diffs"
					})]
				})]
			})
		]
	});
}
function ModelPicker({ account, target, onTarget, onAccount, agents }) {
	async function pickModel(source) {
		onTarget({
			kind: "model",
			source
		});
		try {
			onAccount(await setModelSource({ data: source }));
		} catch {}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "relative min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Model"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
			className: cn("h-7 max-w-[12.5rem] truncate rounded-md border border-border bg-bg px-1.5 text-[11px] text-fg", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"),
			value: target.kind === "acp" ? `acp:${target.id}` : target.source,
			onChange: (e) => {
				const value = e.target.value;
				if (value.startsWith("acp:")) {
					const id = value.slice(4);
					const builtin = BUILTIN_ACP.find((a) => a.id === id);
					if (builtin) {
						onTarget({
							kind: "acp",
							id: builtin.id,
							name: builtin.name,
							remote: false
						});
						return;
					}
					const agent = agents.find((a) => a.id === id);
					if (agent) onTarget({
						kind: "acp",
						id: agent.id,
						name: agent.name,
						remote: true
					});
					return;
				}
				pickModel(value);
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "hosted",
					children: "Hosted Grok"
				}),
				PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: provider.id,
					disabled: !account.keys[provider.id]?.set,
					children: account.keys[provider.id]?.set ? `Your ${provider.short}` : `${provider.short} (add key)`
				}, provider.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("optgroup", {
					label: account.acp ? "ACP · same diff UI" : "ACP (Pro)",
					children: [BUILTIN_ACP.map((agent) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: `acp:${agent.id}`,
						disabled: !account.acp,
						children: agent.name
					}, agent.id)), agents.map((agent) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: `acp:${agent.id}`,
						children: [agent.name, " · bridge"]
					}, agent.id))]
				})
			]
		})]
	});
}
function CrewBar({ account }) {
	const crewIds = useIdeUi((s) => s.crewIds);
	const toggleCrew = useIdeUi((s) => s.toggleCrew);
	const seats = availableSeats(account).filter((s) => s.ready || crewIds.includes(s.id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 items-center gap-1 overflow-x-auto",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3.5 shrink-0 text-subtle" }), seats.map((seat) => {
			const on = crewIds.includes(seat.id);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: !seat.ready,
				title: seat.hint,
				onClick: () => toggleCrew(seat.id),
				className: cn("h-6 shrink-0 rounded-md border px-1.5 text-[11px]", on && seat.ready ? "border-accent/40 bg-elevated text-fg" : "border-border text-subtle", !seat.ready && "cursor-not-allowed opacity-40"),
				"aria-pressed": on,
				children: seat.label
			}, seat.id);
		})]
	});
}
function WorkerConfirm({ plan, account, quoteSource, disabled, onConfirm, onSingle }) {
	const fileList = useWorkspace((s) => s.fileList);
	const crewIds = useIdeUi((s) => s.crewIds);
	const seats = selectedSeats(availableSeats(account), crewIds);
	const files = fileList;
	const suggested = proposeWorkers(plan, files, seats);
	const planKey = plan.map((p) => p.id).join("|");
	const [workers, setWorkers] = (0, import_react.useState)(suggested);
	(0, import_react.useEffect)(() => {
		setWorkers(proposeWorkers(plan, files, seats));
	}, [planKey]);
	const quote = quoteRuns(account ?? null, quoteSource, Math.max(workers.length, 1));
	const ok = canConfirm(workers);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-2 mb-2 rounded-xl border border-border bg-bg px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium text-fg",
					children: "Workers"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-subtle hover:bg-elevated hover:text-fg disabled:opacity-40",
					disabled: disabled || workers.length >= 3,
					onClick: () => setWorkers((w) => addWorker(w, seats, files, plan)),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), "Add"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-[11px] text-muted",
				children: "Suggested from the plan. Toggle Build / Review. Nothing runs until you confirm."
			}),
			workers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] text-subtle",
				children: "One builder, or add a worker to split files across the crew."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-1",
				children: workers.map((worker, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-6 shrink-0 rounded-md border border-border px-1.5 text-[10px] font-medium uppercase tracking-wide text-subtle hover:text-fg",
							onClick: () => setWorkers((w) => toggleWorkerRole(w, i, seats)),
							children: worker.role === "review" ? "Review" : "Build"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 flex-1 truncate font-mono text-[11px] text-muted",
							children: worker.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "grid size-6 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg",
							"aria-label": "Remove worker",
							onClick: () => setWorkers((w) => dropWorker(w, i)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
						})
					]
				}, `${worker.label}-${i}`))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					disabled: disabled || quote.blocked || !ok,
					onClick: () => onConfirm(workers),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }),
						"Confirm ",
						workers.length || ""
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "ghost",
					disabled,
					onClick: onSingle,
					children: "One builder"
				})]
			})
		]
	});
}
var listAgents = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("a430df19b5efe91a0f9600ce19408af2615612b26ad11b3b036ce38a1a25313d"));
var saveAgent = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("e6c3bf3bc595548ea8ace93cb611972e3b1a86c99ba1031fb682662ee2b6d328"));
var deleteAgent = createServerFn({ method: "POST" }).validator((id) => id).middleware([authMiddleware]).handler(createSsrRpc("929b5a97545f35697cc70309886683070923d23416598b9474e0888b7580102c"));
function useJobs(enabled) {
	const [jobs, setJobs] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)(async () => {
		if (!enabled) {
			setJobs([]);
			return [];
		}
		setLoading(true);
		try {
			const next = await listJobs();
			setJobs(next);
			return next;
		} catch {
			return [];
		} finally {
			setLoading(false);
		}
	}, [enabled]);
	(0, import_react.useEffect)(() => {
		if (!enabled) return;
		refresh();
	}, [enabled, refresh]);
	const live = jobs.some((j) => j.status === "queued" || j.status === "running");
	(0, import_react.useEffect)(() => {
		if (!enabled || !live) return;
		const id = window.setInterval(() => {
			refresh();
		}, 2200);
		return () => window.clearInterval(id);
	}, [
		enabled,
		live,
		refresh
	]);
	return {
		jobs,
		setJobs,
		loading,
		refresh,
		liveCount: jobs.filter((j) => j.status === "queued" || j.status === "running").length
	};
}
function relativePath(file) {
	const rel = file.webkitRelativePath;
	if (rel && rel.length > 0) return rel.replace(/\\/g, "/");
	return file.name;
}
async function walkEntry(entry, acc) {
	if (entry.isFile) {
		const file = await new Promise((resolve, reject) => {
			entry.file(resolve, reject);
		});
		const path = entry.fullPath.replace(/^\//, "");
		Object.defineProperty(file, "webkitRelativePath", { value: path });
		acc.push(file);
		return;
	}
	if (!entry.isDirectory) return;
	const reader = entry.createReader();
	const batch = () => new Promise((resolve, reject) => {
		reader.readEntries(resolve, reject);
	});
	let chunk = await batch();
	while (chunk.length > 0) {
		for (const child of chunk) await walkEntry(child, acc);
		chunk = await batch();
	}
}
async function filesFromDataTransfer(dt) {
	const acc = [];
	const items = dt.items;
	if (items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === "function") {
		const entries = [];
		for (let i = 0; i < items.length; i++) {
			const entry = items[i].webkitGetAsEntry();
			if (entry) entries.push(entry);
		}
		if (entries.length > 0) {
			for (const entry of entries) await walkEntry(entry, acc);
			if (acc.length > 0) return acc;
		}
	}
	return Array.from(dt.files);
}
async function importLocalFiles(list, fallbackName) {
	if (list.length === 1 && list[0].name.toLowerCase().endsWith(".zip")) {
		const buf = await list[0].arrayBuffer();
		const name = fallbackName || list[0].name.replace(/\.zip$/i, "");
		return filesFromZipBuffer(buf, name);
	}
	const entries = [];
	let root = fallbackName ?? "";
	for (const file of list) {
		const path = relativePath(file);
		if (!root) {
			const first = path.split("/")[0];
			if (first && path.includes("/")) root = first;
		}
		const buf = new Uint8Array(await file.arrayBuffer());
		entries.push({
			path,
			bytes: buf
		});
	}
	return assembleImport(entries, root || fallbackName || "workspace");
}
function nextAction(input) {
	if (input.running) return {
		kind: "wait",
		title: "Composer is working",
		detail: "Steer in the box if you want to add a follow-up.",
		cta: "Wait"
	};
	if (input.awaiting && input.workerCount >= 2) return {
		kind: "workers",
		title: `Run ${input.workerCount} workers on this plan`,
		detail: "Each owns a file group. Nothing starts until you confirm.",
		cta: `Confirm ${input.workerCount}`
	};
	if (input.awaiting) return {
		kind: "build",
		title: "Build this plan",
		detail: "One builder. Diffs still wait for Apply.",
		cta: "Build it"
	};
	if (input.pending > 0 && (input.noteCount ?? 0) > 0) {
		const n = input.noteCount ?? 0;
		return {
			kind: "notes",
			title: `Send ${n} ${n === 1 ? "note" : "notes"} to Composer`,
			detail: "Apply is blocked until you send or dismiss the notes.",
			cta: "Send notes"
		};
	}
	if (input.pending > 0 && input.crewModels >= 2 && (input.noteCount ?? 0) === 0) return {
		kind: "reviewer",
		title: `${input.reviewerLabel ?? "Crew"} reviews these diffs`,
		detail: "Notes only. Diffs stay staged until you Apply.",
		cta: "Confirm review"
	};
	if (input.pending > 0) return {
		kind: "review",
		title: `Review ${input.pending} staged ${input.pending === 1 ? "file" : "files"}`,
		detail: "Enter keeps a hunk, Backspace drops it. F8 jumps. Apply when notes are clear.",
		cta: "Open review"
	};
	if (input.keyReady >= 2 && input.crewModels < 2) return {
		kind: "crew",
		title: "Put Claude and GPT on this project",
		detail: "Toggle seats in Crew. Plan with one, confirm workers to split the build.",
		cta: "Show crew"
	};
	if (input.messages === 0) return {
		kind: "compose",
		title: "Describe the change",
		detail: "Composer plans first. Use @ or Auto-context.",
		cta: "Focus"
	};
	return {
		kind: "compose",
		title: "Iterate or ask",
		detail: "/review staged work, or describe the next change.",
		cta: "Focus"
	};
}
var SLASH_COMMANDS = [
	{
		name: "review",
		description: "Review staged diffs"
	},
	{
		name: "fix",
		description: "Fix the selection or active file"
	},
	{
		name: "explain",
		description: "Explain the selection or active file"
	}
];
function activeSlash(text, caret) {
	if (!text.startsWith("/")) return null;
	const lineEnd = text.indexOf("\n");
	if (lineEnd >= 0 && caret > lineEnd) return null;
	const head = text.slice(1, caret);
	if (head.includes(" ") || head.includes("	")) return null;
	return { query: head };
}
function filterSlash(query) {
	const q = query.trim().toLowerCase();
	return SLASH_COMMANDS.filter((c) => !q || c.name.startsWith(q) || c.description.toLowerCase().includes(q));
}
function parseSlash(text) {
	const match = /^\/(review|fix|explain)(?:\s+([\s\S]*))?$/i.exec(text.trim());
	if (!match) return null;
	return {
		name: match[1].toLowerCase(),
		rest: (match[2] ?? "").trim()
	};
}
function compactDiff(oldText, newText, cap = 60) {
	const out = [];
	let extra = 0;
	for (const row of lineDiff(oldText, newText)) {
		if (row.type === "eq") continue;
		if (out.length >= cap) {
			extra += 1;
			continue;
		}
		out.push(`${row.type === "add" ? "+" : "-"} ${row.text}`);
	}
	if (extra) out.push(`… ${extra} more`);
	return out.join("\n");
}
function expandSlash(name, rest, ctx) {
	const target = ctx.selection && !ctx.selection.empty && ctx.selection.text.trim() ? `the selection in ${ctx.selection.path} L${ctx.selection.fromLine}-L${ctx.selection.toLine}` : ctx.activePath ? `the active file ${ctx.activePath}` : "the workspace";
	const note = rest ? `\n\n${rest}` : "";
	if (name === "review") return {
		instruction: `Review the staged diffs. Flag bugs, missing error handling, and leftovers. Do not write files unless asked.${note}\n\n${ctx.pending.length === 0 ? "No staged diffs. Review the auto-context files instead." : ctx.pending.map((edit) => `### ${edit.path}\n${compactDiff(edit.oldText, edit.newText) || "(empty)"}`).join("\n\n")}`,
		mode: "chat"
	};
	if (name === "fix") return {
		instruction: `Fix ${target}. Keep unrelated code.${note}`,
		mode: "composer",
		phase: "skip"
	};
	return {
		instruction: `Explain ${target}. Be concrete.${note}`,
		mode: "chat"
	};
}
var DEMO_SUGGESTIONS = [
	"Fix the off-by-one in listTasks",
	"Return 404 from getTask when the id is missing",
	"Reject titles longer than 80 characters",
	"Explain @src/store.ts"
];
var GENERIC_SUGGESTIONS = [
	"Summarize this repo",
	"Find bugs in the indexed files",
	"What does the active file do?",
	"Add a short README if one is missing"
];
function AgentPanel({ composerRef }) {
	const chatEmpty = useWorkspace((s) => s.messages.length === 0);
	const phaseHint = useWorkspace((s) => {
		const last = [...s.messages].reverse().find((m) => m.role === "assistant");
		if (last?.awaitingBuild && last.plan?.length) return "awaiting";
		if (last?.edits?.some((e) => e.status === "pending" || e.status === "applied")) return "edits";
		return "plan";
	});
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const fileList = useWorkspace((s) => s.fileList);
	const activePath = useWorkspace((s) => s.activePath);
	const openTabs = useWorkspace((s) => s.openTabs);
	const recentPaths = useWorkspace((s) => s.recentPaths);
	const name = useWorkspace((s) => s.name);
	const clearChat = useWorkspace((s) => s.clearChat);
	const undoLast = useWorkspace((s) => s.undoLast);
	const checkpoints = useWorkspace((s) => s.checkpoints);
	const captures = useIdeUi((s) => s.captures);
	const removeCapture = useIdeUi((s) => s.removeCapture);
	const steerQueue = useIdeUi((s) => s.steerQueue);
	const crewIds = useIdeUi((s) => s.crewIds);
	const { user, isPending } = useCurrentUserState();
	const { account, setAccount, refresh } = useAccount();
	const [draft, setDraft] = (0, import_react.useState)("");
	const [mode, setMode] = (0, import_react.useState)("composer");
	const [phaseLock, setPhaseLock] = (0, import_react.useState)("auto");
	const [caret, setCaret] = (0, import_react.useState)(0);
	const [mentionHi, setMentionHi] = (0, import_react.useState)(0);
	const [dismissMention, setDismissMention] = (0, import_react.useState)(false);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	const [agents, setAgents] = (0, import_react.useState)([]);
	const [target, setTarget] = (0, import_react.useState)({
		kind: "model",
		source: "hosted"
	});
	const [dropOn, setDropOn] = (0, import_react.useState)(false);
	const attachRef = (0, import_react.useRef)(null);
	const jobsOn = Boolean(account && (account.backgroundJobs > 0 || account.acp));
	const { jobs, setJobs, refresh: refreshJobs, liveCount } = useJobs(jobsOn);
	(0, import_react.useEffect)(() => {
		setMounted(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!account) return;
		setTarget((prev) => prev.kind === "model" && prev.source !== account.modelSource ? {
			kind: "model",
			source: account.modelSource
		} : prev);
	}, [account?.modelSource]);
	(0, import_react.useEffect)(() => {
		if (!account?.acp) {
			setAgents([]);
			return;
		}
		listAgents().then(setAgents).catch(() => setAgents([]));
	}, [account?.acp]);
	const catalog = (0, import_react.useMemo)(() => mentionItems(fileList), [fileList]);
	const mention = dismissMention ? null : activeMention(draft, caret);
	const mentionHits = mention ? filterMentions(catalog, mention.query) : [];
	const slash = dismissMention ? null : activeSlash(draft, caret);
	const slashHits = slash ? filterSlash(slash.query) : [];
	const autoPaths = autoContextPaths({
		activePath,
		openTabs,
		recentPaths,
		mentioned: []
	});
	const rulesPath = RULE_CANDIDATES.find((path) => fileList.includes(path)) ?? null;
	const signedOut = mounted && !isPending && !user;
	const suggestions = name === "harbor-api" ? DEMO_SUGGESTIONS : GENERIC_SUGGESTIONS;
	const source = target.kind === "model" ? target.source : account?.modelSource ?? "hosted";
	const quote = quoteRun(account, source);
	const blocked = target.kind === "model" && quote.blocked;
	const acpBlocked = target.kind === "acp" && target.remote === false && quote.blocked;
	(0, import_react.useEffect)(() => {
		setMentionHi(0);
	}, [
		mention?.query,
		mention?.start,
		slash?.query
	]);
	function syncCaret(el) {
		setCaret(el.selectionStart ?? el.value.length);
	}
	function insertMention(item) {
		if (!mention) return;
		const insert = `@${item.path} `;
		const next = draft.slice(0, mention.start) + insert + draft.slice(caret);
		const nextCaret = mention.start + insert.length;
		setDraft(next);
		setDismissMention(false);
		requestAnimationFrame(() => {
			const el = composerRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(nextCaret, nextCaret);
			setCaret(nextCaret);
		});
	}
	function insertContextPaths(paths) {
		if (paths.length === 0) return;
		const pos = composerRef.current?.selectionStart ?? draft.length;
		const token = paths.map((path) => `@${path}`).join(" ");
		const left = draft.slice(0, pos);
		const right = draft.slice(pos);
		const insert = `${left && !/\s$/.test(left) ? " " : ""}${token} `;
		const next = left + insert + right;
		const nextCaret = left.length + insert.length;
		setDraft(next);
		setCaret(nextCaret);
		requestAnimationFrame(() => {
			const box = composerRef.current;
			if (!box) return;
			box.focus();
			box.setSelectionRange(nextCaret, nextCaret);
		});
	}
	async function attachFiles(list) {
		if (list.length === 0) return;
		try {
			const result = await importLocalFiles(list, "attach");
			const paths = Object.keys(result.files);
			if (paths.length === 0) {
				toast.error("No text files in that drop. Images and binaries are skipped.");
				return;
			}
			for (const [path, content] of Object.entries(result.files)) {
				const current = useWorkspace.getState();
				if (current.files[path] === void 0) current.createFile(path, content);
				else if (current.files[path] !== content) current.writeFile(path, content);
			}
			insertContextPaths(paths);
			toast.success(`Attached ${paths.length === 1 ? paths[0] : `${paths.length} files`} with @`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not attach files");
		}
	}
	async function openContextPicker() {
		const el = composerRef.current;
		const pos = el?.selectionStart ?? draft.length;
		const left = draft.slice(0, pos);
		const at = left.lastIndexOf("@");
		if (at >= 0 && !/[\s\n]/.test(left.slice(at + 1))) {
			setDismissMention(false);
			setCaret(pos);
			el?.focus();
			return;
		}
		const insert = left.length === 0 || /\s$/.test(left) ? "@" : " @";
		const next = left + insert + draft.slice(pos);
		const nextCaret = left.length + insert.length;
		setDraft(next);
		setCaret(nextCaret);
		setDismissMention(false);
		requestAnimationFrame(() => {
			const box = composerRef.current;
			if (!box) return;
			box.focus();
			box.setSelectionRange(nextCaret, nextCaret);
		});
	}
	async function queueBackground(text) {
		if (!account) return;
		if (account.backgroundJobs <= 0) {
			toast.error("Background jobs are on Pro. Composer in the panel still runs on Hobby.");
			return;
		}
		if (target.kind === "acp" && !account.acp) {
			toast.error("External agents are on Pro.");
			return;
		}
		const payload = agentPayload(text, mode === "inline" ? "composer" : mode, source, target.kind === "acp" ? target.id : null, { phase: "skip" });
		try {
			const job = await startJob({ data: {
				...payload,
				agentId: target.kind === "acp" ? target.id : null
			} });
			setJobs([job, ...jobs.filter((j) => j.id !== job.id)]);
			refreshJobs();
			toast.success("Queued in the background");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not queue");
		}
	}
	async function send(text, background = false, phase) {
		const captures = useIdeUi.getState().captures;
		const trimmed = text.trim() || (captures.length > 0 ? "Revise the captured element. Keep the rest of the page." : "");
		if (!trimmed || !user) return;
		if (agentRunning) {
			useIdeUi.getState().enqueueSteer(trimmed);
			setDraft("");
			setDismissMention(false);
			return;
		}
		if (target.kind === "acp" && !account?.acp) {
			toast.error("ACP sessions are on Pro.");
			return;
		}
		if ((blocked || acpBlocked) && !background) return;
		setDraft("");
		setDismissMention(false);
		const parsed = parseSlash(trimmed);
		const ws = useWorkspace.getState();
		const slashRun = parsed ? expandSlash(parsed.name, parsed.rest, {
			activePath: ws.activePath,
			selection: ws.selection,
			pending: listPendingEdits(ws.messages)
		}) : null;
		if (background) {
			await queueBackground(slashRun?.instruction ?? trimmed);
			useIdeUi.getState().clearCaptures();
			return;
		}
		const resolved = slashRun ? {
			phase: slashRun.phase,
			approvedPlan: void 0
		} : mode === "composer" ? nextComposerPhase(ws.messages, trimmed, phase ?? (phaseLock === "auto" ? void 0 : phaseLock)) : {
			phase: void 0,
			approvedPlan: void 0
		};
		await submitAgent(trimmed, slashRun?.mode ?? (mode === "inline" ? "composer" : mode), source, {
			agentId: target.kind === "acp" ? target.id : null,
			agentLabel: target.kind === "acp" ? target.name : "Aperture",
			phase: resolved.phase,
			approvedPlan: resolved.approvedPlan,
			apiInstruction: slashRun?.instruction
		});
		useIdeUi.getState().clearCaptures();
		refresh();
	}
	async function buildPlan(message, workers) {
		if (agentRunning || !user || !message.plan?.length) return;
		useWorkspace.getState().patchMessage(message.id, { awaitingBuild: false });
		await submitAgent("Build it.", "composer", workers?.[0]?.source ?? source, {
			agentId: workers?.length ? null : target.kind === "acp" ? target.id : null,
			agentLabel: message.agentLabel || (target.kind === "acp" ? target.name : "Aperture"),
			phase: "build",
			approvedPlan: message.plan,
			workers
		});
		refresh();
	}
	async function sendNotes(edits) {
		const body = formatDiffNotes(edits ?? []);
		if (!body || agentRunning || !user) return;
		if (blocked || acpBlocked) return;
		await submitAgent(body, "composer", source, {
			agentId: target.kind === "acp" ? target.id : null,
			agentLabel: target.kind === "acp" ? target.name : "Aperture",
			phase: "skip"
		});
		refresh();
	}
	function insertSlash(item) {
		const next = `/${item.name} `;
		setDraft(next);
		setDismissMention(false);
		requestAnimationFrame(() => {
			const el = composerRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(next.length, next.length);
			setCaret(next.length);
		});
	}
	function onKeyDown(e) {
		if (slashHits.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setMentionHi((i) => (i + 1) % slashHits.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setMentionHi((i) => (i - 1 + slashHits.length) % slashHits.length);
				return;
			}
			if (e.key === "Tab" || e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const item = slashHits[mentionHi] ?? slashHits[0];
				if (item) insertSlash(item);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				setDismissMention(true);
				return;
			}
		}
		if (mentionHits.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setMentionHi((i) => (i + 1) % mentionHits.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setMentionHi((i) => (i - 1 + mentionHits.length) % mentionHits.length);
				return;
			}
			if (e.key === "Tab" || e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const item = mentionHits[mentionHi] ?? mentionHits[0];
				if (item) insertMention(item);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				setDismissMention(true);
				return;
			}
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send(draft);
		}
	}
	function openRules() {
		const ws = useWorkspace.getState();
		const existing = findRules(ws.files);
		if (existing) ws.openFile(existing.path);
		else ws.createFile(".aperture.md", mergeStackSection(DEFAULT_RULES, formatStackBody(extractStack(ws.files, ws.name))));
		useIdeUi.getState().setMobilePane("editor");
	}
	const sendBlocked = !draft.trim() && captures.length === 0 || isPending || !user || blocked || acpBlocked;
	const autoPhase = phaseHint === "awaiting" && isBuildIntent(draft) ? "build" : phaseHint === "edits" ? "skip" : "plan";
	const sendPhase = mode === "composer" ? phaseLock === "auto" ? autoPhase : phaseLock : "plan";
	const sendLabel = mode === "chat" ? "Ask" : sendPhase === "build" ? "Build" : sendPhase === "skip" ? "Iterate" : "Plan";
	(0, import_react.useEffect)(() => {
		if (agentRunning || !user) return;
		const next = useIdeUi.getState().steerQueue[0];
		if (!next) return;
		useIdeUi.getState().shiftSteer();
		send(next);
	}, [
		agentRunning,
		user,
		steerQueue[0]
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ide-stack bg-surface",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-8 items-center gap-1.5 border-b border-border px-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex rounded-md border border-border p-px",
					children: [[
						"composer",
						"Composer",
						Sparkles
					], [
						"chat",
						"Ask",
						MessageSquare
					]].map(([id, label, Icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setMode(id),
						className: cn("inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px]", mode === id ? "bg-elevated text-fg" : "text-subtle hover:text-fg"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3" }), label]
					}, id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							className: "size-7",
							title: rulesPath ? `Open ${rulesPath}` : "Create project rules",
							"aria-label": rulesPath ? `Open ${rulesPath}` : "Create project rules",
							onClick: openRules,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollText, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							className: "size-7",
							title: "File history",
							"aria-label": "File history",
							onClick: () => useIdeUi.getState().setHistoryOpen(true),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							className: "size-7",
							title: "Clear chat",
							"aria-label": "Clear chat",
							onClick: clearChat,
							disabled: chatEmpty,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanChrome, {
				mode,
				sendPhase,
				locked: phaseLock !== "auto",
				onPhase: (next) => setPhaseLock(next),
				actDisabled: agentRunning || !user,
				account,
				source,
				crewIds,
				fileList,
				canRun: Boolean(user) && !agentRunning,
				onBuild: buildPlan,
				onSendNotes: sendNotes,
				onFocus: () => composerRef.current?.focus()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageList, {
				running: agentRunning,
				quoteLabel: quote.label,
				account,
				source,
				fileList,
				suggestions,
				onPick: (text) => {
					setDraft(text);
					if (user && !blocked && !acpBlocked) send(text);
				},
				onBuild: buildPlan,
				onSendNotes: sendNotes
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				checkpoints.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 border-t border-border px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0 truncate text-xs text-muted",
						children: ["Last run: ", checkpoints[checkpoints.length - 1].label]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => useIdeUi.getState().setHistoryOpen(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-3.5" }), "History"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => {
								const ck = undoLast();
								if (ck) toast.success(`Undid “${ck.label}”`);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5" }), "Undo last"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-t border-border px-2.5 py-1.5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssistChips, {})
				}),
				account && jobsOn && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsTray, {
					jobs,
					cap: Math.max(1, account.backgroundJobs),
					liveCount,
					acp: account.acp,
					onJobs: setJobs
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t border-border p-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: (e) => {
							e.preventDefault();
							send(draft);
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlashPopover, {
								items: slashHits,
								active: mentionHi,
								onPick: insertSlash
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionPopover, {
								items: mentionHits,
								active: mentionHi,
								onPick: insertMention
							}),
							steerQueue.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mb-2 flex flex-wrap gap-1.5",
								children: steerQueue.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "flex max-w-full items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-fg",
									onClick: () => useIdeUi.getState().dropSteer(i),
									title: "Remove queued steer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "max-w-48 truncate",
										children: item
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3 text-subtle" })]
								}) }, `${i}-${item.slice(0, 24)}`))
							}),
							captures.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mb-2 flex flex-wrap gap-1.5",
								children: captures.map((cap) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-fg",
									onClick: () => removeCapture(cap.id),
									title: "Remove capture",
									children: [
										cap.screenshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: cap.screenshot,
											alt: "",
											className: "size-5 rounded-sm object-cover"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, { className: "size-3 text-accent" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "max-w-28 truncate font-mono",
											children: cap.note || cap.selector
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3 text-subtle" })
									]
								}) }, cap.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								"data-drop": "composer",
								className: cn("composer-rim relative rounded-xl p-px", agentRunning && "is-live", dropOn && "is-live"),
								onDragEnter: (e) => {
									if (!e.dataTransfer.types.includes("Files")) return;
									e.preventDefault();
									e.stopPropagation();
									setDropOn(true);
								},
								onDragOver: (e) => {
									if (!e.dataTransfer.types.includes("Files")) return;
									e.preventDefault();
									e.stopPropagation();
									setDropOn(true);
								},
								onDragLeave: (e) => {
									if (e.currentTarget.contains(e.relatedTarget)) return;
									setDropOn(false);
								},
								onDrop: (e) => {
									if (!e.dataTransfer?.files.length && !e.dataTransfer?.items.length) return;
									e.preventDefault();
									e.stopPropagation();
									setDropOn(false);
									filesFromDataTransfer(e.dataTransfer).then((list) => attachFiles(list));
								},
								children: [dropOn && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[11px] bg-list-drop/80",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium text-fg",
										children: "Drop files for Composer"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									ref: composerRef,
									value: draft,
									suppressHydrationWarning: true,
									onChange: (e) => {
										setDraft(e.target.value);
										setDismissMention(false);
										syncCaret(e.target);
									},
									onKeyUp: (e) => syncCaret(e.currentTarget),
									onClick: (e) => syncCaret(e.currentTarget),
									onKeyDown,
									placeholder: agentRunning ? "Steer this run — Enter queues, sends when it finishes" : mode === "chat" ? "Ask about the repo. Use @ for context." : "Describe the change. Use @ for context — Composer plans first.",
									rows: 2,
									className: "min-h-14 w-full resize-none rounded-[11px] border-0 bg-bg px-2.5 py-2 text-sm leading-snug text-fg placeholder:text-subtle focus-visible:outline-none"
								})]
							}),
							autoPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1.5 truncate text-[11px] text-subtle",
								title: autoPaths.join(" · "),
								children: ["Auto ", autoPaths.map((p) => basename(p)).join(" · ")]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostMeter, {
										quote,
										acpLabel: target.kind === "acp" ? target.name : null,
										acpRemote: target.kind === "acp" && target.remote
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CrewBar, { account }),
									signedOut ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": "Add context",
												title: "Add context with @",
												className: "grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg",
												onClick: openContextPicker,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AtSign, { className: "size-3.5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": "Add files",
												title: "Add files to Composer",
												className: "grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg",
												onClick: () => attachRef.current?.click(),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, { className: "size-3.5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												to: "/login",
												search: { next: "/app" },
												className: cn(buttonVariants({
													variant: "ghost",
													size: "sm"
												})),
												children: "Sign in"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
												to: "/login",
												search: { next: "/app" },
												className: cn(buttonVariants({ size: "sm" }), "ml-auto"),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-3.5" }), "Plan"]
											})
										]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": "Add context",
												title: "Add context with @",
												className: "grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg",
												onClick: openContextPicker,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AtSign, { className: "size-3.5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": "Add files",
												title: "Add files to Composer",
												className: "grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg",
												onClick: () => attachRef.current?.click(),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, { className: "size-3.5" })
											}),
											account && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelPicker, {
												account,
												target,
												onTarget: setTarget,
												onAccount: setAccount,
												agents
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "ml-auto flex items-center gap-1",
												children: [account && account.backgroundJobs > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													type: "button",
													size: "icon-sm",
													variant: "ghost",
													"aria-label": "Send in background",
													disabled: sendBlocked,
													onClick: () => void send(draft, true),
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5" })
												}), agentRunning ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
													type: "button",
													size: "sm",
													"aria-label": "Stop",
													onClick: () => abortAgent(),
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3.5 fill-current" }), "Stop"]
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
													type: "submit",
													size: "sm",
													disabled: sendBlocked,
													"aria-label": sendLabel,
													children: [sendPhase === "build" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-3.5" }), sendLabel]
												})]
											})
										]
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: attachRef,
						type: "file",
						multiple: true,
						className: "hidden",
						suppressHydrationWarning: true,
						onChange: (e) => {
							const list = e.target.files ? Array.from(e.target.files) : [];
							e.target.value = "";
							attachFiles(list);
						}
					})]
				})
			] })
		]
	});
}
function EmptyComposer({ suggestions, onPick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col justify-end gap-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm font-medium text-fg",
			children: "Composer plans first. You click Build it."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs leading-relaxed text-subtle",
			children: "@ a file for context, or open Preview, click a UI element, and send the notes here."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1",
			children: suggestions.slice(0, 3).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "w-full rounded-lg border border-border bg-bg px-3 py-2 text-left text-[13px] text-fg hover:bg-elevated",
				onClick: () => onPick(s),
				children: s
			}) }, s))
		})]
	});
}
function PlanChrome({ mode, sendPhase, locked, onPhase, actDisabled, account, source, crewIds, fileList, canRun, onBuild, onSendNotes, onFocus }) {
	const messages = useWorkspace((s) => s.messages);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const awaitingMsg = [...messages].reverse().find((m) => m.awaitingBuild && (m.plan?.length ?? 0) > 0);
	const pendingCount = listPendingEdits(messages).length;
	const seats = availableSeats(account);
	const crew = selectedSeats(seats, crewIds);
	const proposed = awaitingMsg?.plan ? proposeWorkers(awaitingMsg.plan, fileList, crew) : [];
	const hint = nextAction({
		running: agentRunning,
		awaiting: Boolean(awaitingMsg),
		pending: pendingCount,
		workerCount: proposed.length,
		crewModels: modelSeats(crew).length,
		keyReady: seats.filter((s) => s.kind === "model" && s.ready).length,
		messages: messages.length,
		noteCount: notesOn(listPendingEdits(messages)),
		reviewerLabel: modelSeats(crew).find((s) => s.source && s.source !== source)?.label
	});
	function actOnHint() {
		if (hint.kind === "workers" && awaitingMsg) {
			onBuild(awaitingMsg, proposed);
			return;
		}
		if (hint.kind === "build" && awaitingMsg) {
			onBuild(awaitingMsg);
			return;
		}
		if (hint.kind === "notes") {
			onSendNotes(listPendingEdits(messages));
			return;
		}
		if (hint.kind === "reviewer") {
			const pending = listPendingEdits(messages);
			const workers = proposeReviewer(pending.map((e) => e.path), crew, source);
			if (!workers.length || !canRun) return;
			submitAgent("Review the staged diffs.", "composer", workers[0]?.source ?? source, {
				agentId: null,
				agentLabel: "Review",
				phase: "skip",
				workers,
				role: "review",
				pendingEdits: pending
			});
			return;
		}
		if (hint.kind === "review") {
			const first = listPendingEdits(messages)[0];
			if (first) useWorkspace.getState().openFile(first.path);
			useIdeUi.getState().setMobilePane("editor");
			if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
			return;
		}
		if (hint.kind === "crew") {
			useIdeUi.getState().setChatOpen(true);
			return;
		}
		onFocus();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskStrip, {
		mode,
		activePhase: sendPhase,
		locked,
		onPhase,
		hint,
		onAct: actOnHint,
		actDisabled
	}), awaitingMsg && !agentRunning && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkerConfirm, {
		plan: awaitingMsg.plan ?? [],
		account,
		quoteSource: source,
		disabled: !canRun,
		onConfirm: (workers) => void onBuild(awaitingMsg, workers),
		onSingle: () => void onBuild(awaitingMsg)
	})] });
}
function MessageList({ running, quoteLabel, account, source, fileList, suggestions, onPick, onBuild, onSendNotes }) {
	const messages = useWorkspace((s) => s.messages);
	const listRef = (0, import_react.useRef)(null);
	const listEndRef = (0, import_react.useRef)(null);
	const stickToBottom = (0, import_react.useRef)(true);
	const messageCount = (0, import_react.useRef)(0);
	const buildRef = (0, import_react.useRef)(onBuild);
	const notesRef = (0, import_react.useRef)(onSendNotes);
	buildRef.current = onBuild;
	notesRef.current = onSendNotes;
	const last = messages[messages.length - 1];
	const streamKey = `${messages.length}:${last?.id ?? ""}:${last?.content.length ?? 0}:${last?.edits?.length ?? 0}:${last?.traces?.length ?? 0}:${running ? "1" : "0"}`;
	(0, import_react.useEffect)(() => {
		const grew = messages.length > messageCount.current;
		messageCount.current = messages.length;
		if (grew) stickToBottom.current = true;
		if (!stickToBottom.current) return;
		listEndRef.current?.scrollIntoView({
			behavior: grew ? "smooth" : "auto",
			block: "end"
		});
	}, [streamKey, messages.length]);
	const buildById = (0, import_react.useCallback)((id) => {
		const msg = useWorkspace.getState().messages.find((m) => m.id === id);
		if (msg) buildRef.current(msg);
	}, []);
	const notesById = (0, import_react.useCallback)((id) => {
		const msg = useWorkspace.getState().messages.find((m) => m.id === id);
		if (msg) notesRef.current(msg.edits);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: listRef,
		className: "aperture-scroll min-h-0 overflow-y-auto px-2.5 py-2",
		onScroll: (e) => {
			const el = e.currentTarget;
			stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
		},
		children: messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyComposer, {
			suggestions,
			onPick
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageBlock, {
				message,
				running,
				quoteLabel: message.awaitingBuild ? quoteRuns(account ?? null, source, billedWorkers(message.plan, fileList, (n) => !quoteRuns(account ?? null, source, n).blocked)).label : quoteLabel,
				onBuild: buildById,
				onSendNotes: notesById
			}, message.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: listEndRef,
				"aria-hidden": true,
				className: "h-px"
			})]
		})
	});
}
function TaskStrip({ mode, activePhase, locked, onPhase, hint, onAct, actDisabled }) {
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const indexing = useWorkspace((s) => s.indexing);
	const messages = useWorkspace((s) => s.messages);
	const task = resolveAgentTask({
		running: agentRunning,
		indexing,
		preview: useIdeUi((s) => s.designOpen),
		messages
	});
	const pct = task.total > 0 ? Math.round(task.done / task.total * 100) : task.kind === "running" ? 40 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-8 shrink-0 items-center gap-2 border-b border-border px-2.5",
		children: [
			mode === "composer" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex rounded-md border border-border p-px",
				title: locked ? "Phase locked" : "Phase follows the last turn",
				children: [
					["plan", "Plan"],
					["build", "Build"],
					["skip", "Iterate"]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: agentRunning,
					onClick: () => onPhase(id),
					className: cn("inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium tracking-wide uppercase", activePhase === id ? "bg-elevated text-fg" : "text-subtle hover:text-fg"),
					"aria-pressed": activePhase === id,
					children: label
				}, id))
			}) : null,
			task.total > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "relative h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-elevated",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute inset-y-0 left-0 rounded-full bg-accent",
					style: { width: `${pct}%` }
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "min-w-0 flex-1 truncate text-[11px] text-muted",
				children: hint.title
			}),
			hint.kind !== "wait" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "sm",
				className: "h-6 shrink-0 px-2",
				disabled: actDisabled,
				onClick: onAct,
				children: hint.cta
			})
		]
	});
}
function AnalyzingCard({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "analyze-card mt-3 rounded-xl border border-border px-4 py-7 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApertureMark, { className: "generate-spin mx-auto size-8 text-accent" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm font-medium text-fg",
				children: status || "Analyzing your code…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-subtle",
				children: "Scanning the selection."
			})
		]
	});
}
var MessageBlock = (0, import_react.memo)(function MessageBlock({ message, running, quoteLabel, onBuild, onSendNotes }) {
	const runningMode = useWorkspace((s) => s.runningMode);
	if (message.role === "user") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-bg px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs font-medium text-subtle",
			children: "You"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg",
			children: message.content
		})]
	});
	const traces = message.traces ?? [];
	const edits = message.edits ?? [];
	const plan = message.plan ?? [];
	const noteCount = notesOn(edits);
	const empty = !message.content.trim();
	const live = running && empty && plan.length === 0;
	const waiting = Boolean(message.awaitingBuild && plan.length > 0);
	const analyzing = live && runningMode === "chat";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs font-medium text-subtle",
			children: message.agentLabel || "Composer"
		}),
		plan.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanCard, {
			entries: plan,
			awaitingBuild: waiting
		}),
		traces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 space-y-1",
			children: traces.map((trace) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TraceLine, { trace }, trace.id))
		}),
		analyzing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnalyzingCard, { status: message.status }),
		live && !analyzing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "shimmer-text mt-2 text-sm text-muted",
			children: message.status || traces[traces.length - 1]?.name || "Planning…"
		}),
		running && empty && plan.length > 0 && message.status && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "shimmer-text mt-2 text-sm text-muted",
			children: message.status
		}),
		!empty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg",
			children: message.content
		}),
		waiting && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "min-w-0 text-xs text-muted",
				children: [
					"Nothing is written until you build. ",
					quoteLabel,
					"."
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				disabled: running,
				onClick: () => onBuild(message.id),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" }), "Build it"]
			})]
		}),
		edits.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 space-y-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left",
					onClick: () => {
						const first = edits.find((e) => e.status === "pending") ?? edits[0];
						if (first) useWorkspace.getState().openFile(first.path);
						useIdeUi.getState().setMobilePane("editor");
						if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 truncate text-xs text-muted",
						children: edits.filter((e) => e.status === "pending").length > 0 ? `Staged ${edits.filter((e) => e.status === "pending").length} ${edits.filter((e) => e.status === "pending").length === 1 ? "file" : "files"} · review in the editor` : `${edits.filter((e) => e.status === "applied").length} applied`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 font-mono text-[11px] text-subtle",
						children: edits.map((e) => e.path.split("/").pop()).slice(0, 3).join(" · ")
					})]
				}),
				noteCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0 text-xs text-muted",
						children: [
							noteCount,
							" ",
							noteCount === 1 ? "note" : "notes",
							" for Composer. ",
							quoteLabel,
							"."
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						disabled: running,
						onClick: () => onSendNotes(message.id),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-3.5" }), "Send notes"]
					})]
				}),
				edits.some((e) => e.status === "applied") && message.checkpointId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "outline",
					className: "w-full",
					onClick: () => {
						const ck = useWorkspace.getState().undoCheckpoint(message.checkpointId);
						if (ck) toast.success(`Undid “${ck.label}”`);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5" }), "Undo this run"]
				})
			]
		}),
		message.debug && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DebugBlock, { debug: message.debug })
	] });
});
function DebugBlock({ debug }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "mt-3 rounded-xl border border-border bg-bg px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
			className: "cursor-pointer text-xs text-subtle",
			children: [
				"Debug · ",
				debug.model,
				" · ",
				debug.steps,
				" ",
				debug.steps === 1 ? "step" : "steps"
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "aperture-scroll mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted",
			children: `# system\n${debug.system}\n\n# user\n${debug.user}\n\n# response\n${debug.response}`
		})]
	});
}
function TraceLine({ trace }) {
	const detail = typeof trace.args.path === "string" ? trace.args.path : typeof trace.args.query === "string" ? trace.args.query : "";
	const name = trace.name;
	const Icon = name.includes("plan") ? ListTodo : name.includes("edit") || name.includes("write") || name.includes("patch") ? FileDiff : name.includes("grep") || name.includes("search") ? Search : name.includes("read") || name.includes("file") ? FileSearch : Wrench;
	const label = name.replace(/_/g, " ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-center gap-2 rounded-md border border-border/80 bg-bg px-2 py-1 text-xs text-muted",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
				className: "size-3.5 shrink-0 text-subtle",
				strokeWidth: 1.7
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "truncate",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: label
				}), detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-subtle",
					children: [" · ", detail]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "ml-auto shrink-0 tabular-nums text-subtle",
				children: [trace.ms, "ms"]
			})
		]
	});
}
/** Parse `:12` or `store.ts:12` from the command palette. */
function parseGoto(query) {
	const text = query.trim();
	if (!text) return null;
	if (text.startsWith(":")) {
		const line = Number(text.slice(1));
		if (!Number.isInteger(line) || line < 1) return null;
		return {
			path: null,
			line
		};
	}
	const split = text.lastIndexOf(":");
	if (split <= 0) {
		if (!/^\d{1,7}$/.test(text)) return null;
		const line = Number(text);
		return Number.isInteger(line) && line >= 1 ? {
			path: null,
			line
		} : null;
	}
	const line = Number(text.slice(split + 1));
	if (!Number.isInteger(line) || line < 1) return null;
	const path = text.slice(0, split).trim();
	return path ? {
		path,
		line
	} : null;
}
function resolveGotoPath(files, fragment, activePath) {
	if (!fragment) return activePath;
	if (files.includes(fragment)) return fragment;
	return files.filter((path) => path === fragment || path.endsWith(`/${fragment}`) || path.endsWith(fragment))[0] ?? null;
}
function CommandPalette() {
	const open = useIdeUi((s) => s.commandOpen);
	const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
	const setMobilePane = useIdeUi((s) => s.setMobilePane);
	const setGithubOpen = useIdeUi((s) => s.setGithubOpen);
	const setHistoryOpen = useIdeUi((s) => s.setHistoryOpen);
	const setDesignOpen = useIdeUi((s) => s.setDesignOpen);
	const designOpen = useIdeUi((s) => s.designOpen);
	const theme = useIdeUi((s) => s.theme);
	const density = useIdeUi((s) => s.density);
	const debug = useIdeUi((s) => s.debug);
	const setDebug = useIdeUi((s) => s.setDebug);
	const files = useWorkspace((s) => s.fileList);
	const openFile = useWorkspace((s) => s.openFile);
	const activePath = useWorkspace((s) => s.activePath);
	const loadDemo = useWorkspace((s) => s.loadDemo);
	const reindex = useWorkspace((s) => s.reindex);
	const checkpoints = useWorkspace((s) => s.checkpoints);
	const [query, setQuery] = (0, import_react.useState)("");
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		if (!open) setQuery("");
	}, [open]);
	const paths = (0, import_react.useMemo)(() => files.filter((p) => fuzzyMatch(query, p)), [files, query]);
	const fileList = files;
	const goto = parseGoto(query);
	const gotoPath = goto ? resolveGotoPath(fileList, goto.path, activePath) : null;
	if (!open) return null;
	function close() {
		setCommandOpen(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] max-md:items-stretch max-md:px-0 max-md:pt-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close command palette",
			className: "absolute inset-0 bg-bg/70",
			onClick: close
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e, {
			className: "relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)] max-md:max-w-none max-md:rounded-none max-md:border-0",
			shouldFilter: false,
			loop: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 border-b border-border px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Input, {
					value: query,
					onValueChange: setQuery,
					placeholder: "Go to file or run a command",
					className: "h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle md:h-12"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.List, {
				className: "aperture-scroll max-h-80 overflow-y-auto p-2 max-md:max-h-[min(70dvh,28rem)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Empty, {
						className: "px-3 py-6 text-center text-sm text-muted",
						children: "No matches"
					}),
					goto && gotoPath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Group, {
						heading: "Go to",
						className: "px-1 pb-2 text-[11px] text-subtle",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
							value: `goto:${gotoPath}:${goto.line}`,
							onSelect: () => {
								openFile(gotoPath);
								useIdeUi.getState().setReveal({
									path: gotoPath,
									line: goto.line
								});
								setMobilePane("editor");
								close();
							},
							className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg max-md:min-h-11",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								gotoPath,
								":",
								goto.line
							] })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Group, {
						heading: "Files",
						className: "px-1 pb-2 text-[11px] text-subtle",
						children: paths.slice(0, 12).map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
							value: path,
							onSelect: () => {
								openFile(path);
								setMobilePane("editor");
								close();
							},
							className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg max-md:min-h-11",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, { className: "size-3.5 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[13px]",
								children: path
							})]
						}, path))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Group, {
						heading: "Workspace",
						className: "px-1 text-[11px] text-subtle",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									useIdeUi.getState().requestFind();
									setMobilePane("editor");
									close();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5 text-subtle" }), "Find in file"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									setDesignOpen(!designOpen);
									setMobilePane("editor");
									close();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3.5 text-subtle" }), designOpen ? "Close Preview" : "Preview"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									useIdeUi.getState().setTheme(theme === "claude" ? "cursor" : "claude");
									close();
								},
								className: "cmdk-item flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "size-3.5 text-subtle" }), theme === "claude" ? "Theme: Cursor" : "Theme: Claude"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									useIdeUi.getState().setDensity(density === "compact" ? "comfortable" : "compact");
									close();
								},
								className: "cmdk-item flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "size-3.5 text-subtle" }),
									"Density: ",
									density === "compact" ? "Comfortable" : "Compact"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									pickFolder();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5 text-subtle" }), "Open folder"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									pickZip();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileArchive, { className: "size-3.5 text-subtle" }), "Open zip"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									setGithubOpen(true);
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Github, { className: "size-3.5 text-subtle" }), "Open GitHub repo"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									downloadCurrentWorkspace().then((r) => toast.success(`Downloaded ${r.name} · ${r.count} files`)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not download"));
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5 text-subtle" }), "Download zip"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									setHistoryOpen(true);
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-3.5 text-subtle" }), "File history"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									const ck = useWorkspace.getState().undoLast();
									if (ck) toast.success(`Undid “${ck.label}”`);
									else toast.error("Nothing to undo");
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5 text-subtle" }), checkpoints.length > 0 ? `Undo last run · ${checkpoints[checkpoints.length - 1].label}` : "Undo last Composer run"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									navigate({
										to: "/settings",
										search: { tab: "limits" }
									});
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5 text-subtle" }), "Session cap"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									reindex();
									close();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-subtle" }), "Rebuild index"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									const next = !useIdeUi.getState().debug;
									setDebug(next);
									toast.message(next ? "Debug is on" : "Debug is off", { description: next ? "The next Agent turn stores the redacted prompt and response on that message." : "Later turns will not attach a debug block." });
									close();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bug, { className: "size-3.5 text-subtle" }), debug ? "Turn debug off" : "Turn debug on"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									abortAgent();
									loadDemo();
									close();
								},
								className: "cmdk-item flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5 text-subtle" }), "Reset harbor-api demo"]
							})
						]
					})
				]
			})]
		})]
	});
}
function InlineEdit() {
	const open = useIdeUi((s) => s.inlineOpen);
	const setInlineOpen = useIdeUi((s) => s.setInlineOpen);
	const selection = useWorkspace((s) => s.selection);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const { user, isPending } = useCurrentUserState();
	const { account } = useAccount();
	const [draft, setDraft] = (0, import_react.useState)("");
	const quote = quoteRun(account);
	if (!open) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-40 flex items-start justify-center px-4 pt-[18vh] md:justify-end md:pr-[min(28vw,420px)] md:pt-24",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close inline edit",
			className: "absolute inset-0 bg-bg/50",
			onClick: () => setInlineOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-float)]",
			onSubmit: async (e) => {
				e.preventDefault();
				if (!draft.trim() || !user) return;
				setInlineOpen(false);
				const instruction = draft;
				setDraft("");
				await submitAgent(instruction, "inline", account?.modelSource ?? "hosted");
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-center gap-2 px-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-accent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[13px] font-medium",
						children: "Inline edit"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-[11px] text-subtle",
						children: selection ? `${selection.path}:${selection.fromLine}` : "current line"
					})
				]
			}), !isPending && !user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-1 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Sign in to edit with the agent."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					search: { next: "/app" },
					className: cn(buttonVariants({ size: "sm" }), "mt-3"),
					children: "Sign in"
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				autoFocus: true,
				value: draft,
				onChange: (e) => setDraft(e.target.value),
				placeholder: "Describe the change for the selected code",
				className: "min-h-24",
				onKeyDown: (e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						e.currentTarget.form?.requestSubmit();
					}
					if (e.key === "Escape") setInlineOpen(false);
				}
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex items-center justify-end gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mr-auto truncate text-[11px] text-subtle",
						children: quote.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => setInlineOpen(false),
						children: "Cancel"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						disabled: !draft.trim() || agentRunning || !user || quote.blocked,
						children: "Generate"
					})
				]
			})] })]
		})]
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-10 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-fg placeholder:text-subtle", "transition-[box-shadow,border-color] duration-150 ease-out", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", className),
		...props
	});
}
function NewFileDialog() {
	const open = useIdeUi((s) => s.newFileOpen);
	const setOpen = useIdeUi((s) => s.setNewFileOpen);
	const createFile = useWorkspace((s) => s.createFile);
	const [path, setPath] = (0, import_react.useState)("src/");
	if (!open) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close",
			className: "absolute inset-0 bg-bg/70",
			onClick: () => setOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-4",
			onSubmit: (e) => {
				e.preventDefault();
				const clean = path.trim();
				if (!clean) return;
				createFile(clean, "");
				setOpen(false);
				setPath("src/");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-medium",
					children: "New file"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Path is relative to the workspace root."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					autoFocus: true,
					value: path,
					onChange: (e) => setPath(e.target.value),
					className: "mt-4 font-mono",
					placeholder: "src/lib/new.ts"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex justify-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => setOpen(false),
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						children: "Create"
					})]
				})
			]
		})]
	});
}
function HelpDialog() {
	const open = useIdeUi((s) => s.helpOpen);
	const setOpen = useIdeUi((s) => s.setHelpOpen);
	const mod = modSymbol();
	if (!open) return null;
	const steps = [
		{
			n: "1",
			title: "Open a file",
			body: "Single-click previews it (italic tab). Double-click keeps it. Pin from the tab. Open a folder, zip, or GitHub from Open."
		},
		{
			n: "2",
			title: "Ask Composer",
			body: "Manual mode: Composer plans and waits — you click Build it, then Apply. Toggle Crew so Claude and GPT can split a confirmed build. Design Mode strips page scripts; click an element, add a note, send it here."
		},
		{
			n: "3",
			title: "Apply the diffs",
			body: "Green and red draw in the file. Apply, reject, or undo the run."
		}
	];
	const rows = [
		[`${mod}P`, "Go to file"],
		[`${mod}I`, "Focus Composer"],
		[`${mod}K`, "Inline edit on the selection"],
		[`${mod}Enter`, "Apply the change in this file"],
		["F8", "Next review hunk · Shift previous · Alt next file"],
		["Enter / Backspace", "Keep this hunk · drop this hunk"],
		["/review /fix /explain", "Slash commands in Composer"],
		["Tab", "Accept ghost text (Pro)"],
		[`${mod}→`, "Accept the next ghost word"],
		[`${mod}Space`, "Workspace symbols"],
		[`${mod}S`, "Download a zip"],
		[`${mod}/`, "This guide"]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close",
			className: "absolute inset-0 bg-bg/70",
			onClick: () => setOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-medium",
					children: "How this editor works"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-4 space-y-3",
					children: steps.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-6 shrink-0 place-items-center rounded-md border border-border font-mono text-xs text-subtle",
							children: step.n
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: step.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-muted",
							children: step.body
						})] })]
					}, step.n))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-sm leading-relaxed text-muted",
					children: "Highlight code, then Explain or Fix. Ask never writes. Composer always waits for Build it — unless you click Build now."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-5 space-y-2 border-t border-border pt-4",
					children: rows.map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-4 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
							className: "rounded-md border border-border bg-bg px-2 py-1 font-mono text-xs text-fg",
							children: key
						})]
					}, key))
				})
			]
		})]
	});
}
function ago(ts) {
	const sec = Math.max(0, Math.round((Date.now() - ts) / 1e3));
	if (sec < 45) return "just now";
	if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
	if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
	return new Date(ts).toLocaleString();
}
function HistoryDialog() {
	const open = useIdeUi((s) => s.historyOpen);
	const setOpen = useIdeUi((s) => s.setHistoryOpen);
	const checkpoints = useWorkspace((s) => s.checkpoints);
	const messages = useWorkspace((s) => s.messages);
	const files = useWorkspace((s) => s.files);
	const name = useWorkspace((s) => s.name);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const undoCheckpoint = useWorkspace((s) => s.undoCheckpoint);
	if (!open) return null;
	const rows = [...checkpoints].reverse();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close",
			className: "absolute inset-0 bg-bg/70",
			onClick: () => setOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "mt-0.5 size-4 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-medium",
					children: "File history"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm leading-relaxed text-muted",
					children: "Apply snapshots the files first. Restore any of the last 8 runs, or download an HTML diff."
				})] })]
			}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 rounded-xl border border-border bg-bg px-3 py-4 text-sm text-muted",
				children: "No snapshots yet. Stage a diff and Apply — the previous text is kept here, not overwritten in place."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "aperture-scroll mt-5 min-h-0 space-y-2 overflow-y-auto",
				children: rows.map((ck) => {
					const n = Object.keys(ck.before).length;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-xl border border-border bg-bg px-3 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-medium text-fg",
									children: ck.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 text-xs text-subtle",
									children: [
										ago(ck.createdAt),
										" · ",
										n,
										" ",
										n === 1 ? "file" : "files"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex shrink-0 gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => {
										downloadDiffReport({
											title: ck.label,
											workspace: name,
											files: filesFromCheckpoint(ck, messages, files)
										});
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDiff, { className: "size-3.5" }), "Report"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "outline",
									disabled: agentRunning,
									onClick: () => {
										const restored = undoCheckpoint(ck.id);
										if (!restored) {
											toast.error("Could not restore");
											return;
										}
										toast.success(`Restored “${restored.label}”`);
										setOpen(false);
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5" }), "Restore"]
								})]
							})]
						})
					}, ck.id);
				})
			})]
		})]
	});
}
var importGithubRepo = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("a6dccb63260437501493951a47994e9dc8b7950c9e8ffbc0e2a79f328c3dc1e2"));
function applyImport(result) {
	const count = Object.keys(result.files).length;
	if (count === 0) {
		toast.error("No text files found. Binaries and node_modules are skipped.");
		return;
	}
	abortAgent();
	useWorkspace.getState().loadProject(result.name, result.files);
	const extra = [result.skipped ? `${result.skipped} skipped` : null, result.truncated ? "hit the size cap" : null].filter(Boolean).join(" · ");
	toast.success(`Opened ${result.name} · ${count} files${extra ? ` · ${extra}` : ""}`);
}
function OpenProjectHost() {
	const folderRef = (0, import_react.useRef)(null);
	const zipRef = (0, import_react.useRef)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const githubOpen = useIdeUi((s) => s.githubOpen);
	const setGithubOpen = useIdeUi((s) => s.setGithubOpen);
	(0, import_react.useEffect)(() => {
		const input = folderRef.current;
		if (input) input.setAttribute("webkitdirectory", "");
	}, []);
	(0, import_react.useEffect)(() => {
		return registerImportHandlers({
			pickFolder: () => folderRef.current?.click(),
			pickZip: () => zipRef.current?.click()
		});
	}, []);
	async function onFileList(list, name) {
		if (list.length === 0) return;
		setBusy(true);
		try {
			applyImport(await importLocalFiles(list, name));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not open files");
		} finally {
			setBusy(false);
		}
	}
	(0, import_react.useEffect)(() => {
		function onDragOver(e) {
			if (!e.dataTransfer?.types.includes("Files")) return;
			e.preventDefault();
			const overComposer = e.target instanceof Element && Boolean(e.target.closest("[data-drop='composer']"));
			setDragging(!overComposer);
		}
		function onDragLeave(e) {
			if (e.relatedTarget === null) setDragging(false);
		}
		function onDrop(e) {
			if (!e.dataTransfer) return;
			if (e.target instanceof Element && e.target.closest("[data-drop='composer']")) return;
			e.preventDefault();
			setDragging(false);
			(async () => {
				setBusy(true);
				try {
					await onFileList(await filesFromDataTransfer(e.dataTransfer));
				} catch (error) {
					toast.error(error instanceof Error ? error.message : "Drop failed");
				} finally {
					setBusy(false);
				}
			})();
		}
		window.addEventListener("dragover", onDragOver);
		window.addEventListener("dragleave", onDragLeave);
		window.addEventListener("drop", onDrop);
		return () => {
			window.removeEventListener("dragover", onDragOver);
			window.removeEventListener("dragleave", onDragLeave);
			window.removeEventListener("drop", onDrop);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			ref: folderRef,
			type: "file",
			multiple: true,
			className: "hidden",
			suppressHydrationWarning: true,
			onChange: (e) => {
				const files = e.target.files ? Array.from(e.target.files) : [];
				e.target.value = "";
				onFileList(files);
			}
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			ref: zipRef,
			type: "file",
			accept: ".zip,application/zip",
			className: "hidden",
			suppressHydrationWarning: true,
			onChange: (e) => {
				const files = e.target.files ? Array.from(e.target.files) : [];
				e.target.value = "";
				onFileList(files);
			}
		}),
		githubOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GithubDialog, {
			onClose: () => setGithubOpen(false),
			busy,
			setBusy
		}),
		(dragging || busy) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none fixed inset-0 z-40 grid place-items-center bg-list-drop/80",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-surface px-6 py-5 text-center shadow-[var(--shadow-float)]",
				children: [
					busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mx-auto size-5 animate-spin text-muted" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "mx-auto size-5 text-accent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm font-medium",
						children: busy ? "Indexing…" : "Drop a folder, files, or .zip"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[12px] text-muted",
						children: "node_modules and binaries are skipped"
					})
				]
			})
		})
	] });
}
function GithubDialog({ onClose, busy, setBusy }) {
	const { user, isPending } = useCurrentUserState();
	const [url, setUrl] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	async function submit() {
		if (!user) return;
		setError(null);
		setBusy(true);
		try {
			const result = await importGithubRepo({ data: { url } });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			applyImport(result);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close",
			className: "absolute inset-0 bg-bg/70",
			onClick: onClose
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-4",
			onSubmit: (e) => {
				e.preventDefault();
				submit();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Github, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-base font-medium",
						children: "Open a GitHub repo"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Public repos only. Private code: drop a folder or zip."
				}),
				!isPending && !user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Sign in so imports count against your account, not a shared quota."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						search: { next: "/app" },
						className: cn(buttonVariants({ size: "sm" }), "mt-3"),
						children: "Sign in"
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						autoFocus: true,
						value: url,
						onChange: (e) => setUrl(e.target.value),
						placeholder: "facebook/react or https://github.com/owner/repo",
						className: "mt-4 font-mono text-[13px]"
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-danger",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "sm",
							onClick: onClose,
							type: "button",
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: busy || !url.trim(),
							children: busy ? "Opening…" : "Open repo"
						})]
					})
				] })
			]
		})]
	});
}
function useKeyboardInset() {
	const [inset, setInset] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const sync = () => {
			const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
			setInset((prev) => prev === next ? prev : next);
		};
		sync();
		vv.addEventListener("resize", sync);
		vv.addEventListener("scroll", sync);
		return () => {
			vv.removeEventListener("resize", sync);
			vv.removeEventListener("scroll", sync);
		};
	}, []);
	return inset;
}
function useIsDesktop() {
	return (0, import_react.useSyncExternalStore)((onChange) => {
		const mq = window.matchMedia("(min-width: 768px)");
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, () => window.matchMedia("(min-width: 768px)").matches, () => true);
}
function MobileAccount() {
	const user = useCurrentUser();
	const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
	const [open, setOpen] = (0, import_react.useState)(false);
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const rootRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onPointer(e) {
			if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
		}
		window.addEventListener("mousedown", onPointer);
		return () => window.removeEventListener("mousedown", onPointer);
	}, [open]);
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/login",
		search: { next: "/app" },
		className: cn(buttonVariants({
			variant: "ghost",
			size: "sm"
		}), "h-8 px-2.5 text-xs"),
		children: "Sign in"
	});
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Account",
			"aria-expanded": open,
			className: "rounded-full",
			onClick: () => setOpen((v) => !v),
			children: user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "size-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid size-8 place-items-center rounded-full bg-elevated text-xs font-medium",
				children: label.charAt(0)
			})
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "truncate px-3 py-2 text-sm font-medium text-fg",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/settings",
					search: { tab: "models" },
					className: "flex h-11 items-center gap-2 px-3 text-sm text-fg hover:bg-bg",
					onClick: () => setOpen(false),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4 text-subtle" }), "Settings"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex h-11 w-full items-center gap-2 px-3 text-left text-sm text-fg hover:bg-bg",
					onClick: () => {
						setOpen(false);
						setHelpOpen(true);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, { className: "size-4 text-subtle" }), "How this works"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled: signingOut,
					className: "flex h-11 w-full items-center gap-2 px-3 text-left text-sm text-fg hover:bg-bg disabled:opacity-50",
					onClick: () => {
						setSigningOut(true);
						signOut().catch(() => setSigningOut(false));
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4 text-subtle" }), signingOut ? "Signing out…" : "Sign out"]
				})
			]
		})]
	});
}
function TitleBar() {
	const name = useWorkspace((s) => s.name);
	const path = useWorkspace((s) => s.activePath);
	const chunks = useWorkspace((s) => s.chunks.length);
	const indexing = useWorkspace((s) => s.indexing);
	const running = useWorkspace((s) => s.agentRunning);
	const staged = useWorkspace((s) => listPendingEdits(s.messages).length);
	const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
	const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
	const [mod, setMod] = (0, import_react.useState)("Ctrl");
	(0, import_react.useEffect)(() => setMod(modSymbol()), []);
	const title = path ? `${name} / ${path}` : name;
	const status = running ? "Composer running" : staged > 0 ? `staged · ${staged} ${staged === 1 ? "file" : "files"}` : indexing ? "Indexing…" : `indexed · ${chunks} chunks`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ide-title",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "text-fg",
				"aria-label": "Aperture home",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApertureMark, { className: "size-3.5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden min-w-0 truncate font-mono text-[11px] text-subtle md:block",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewToggle, { className: "md:hidden" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hidden items-center gap-2 md:flex",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("hidden shrink-0 font-mono text-[11px] sm:inline", staged > 0 ? "text-ok" : "text-subtle"),
							children: status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setCommandOpen(true),
							className: "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-subtle hover:bg-elevated hover:text-fg",
							"aria-label": "Go to file",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3" }),
								"Go to file",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
									className: "font-mono text-[10px] text-subtle",
									children: mod === "⌘" ? "⌘P" : "Ctrl+P"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings",
							search: { tab: "models" },
							"aria-label": "Model settings",
							className: "grid size-7 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							className: "size-7",
							"aria-label": "How this editor works",
							onClick: () => setHelpOpen(true),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthSlot, { compact: true })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "md:hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileAccount, {})
				})]
			})
		]
	});
}
function IdeShell() {
	const sidebarOpen = useIdeUi((s) => s.sidebarOpen);
	const chatOpen = useIdeUi((s) => s.chatOpen);
	const mobilePane = useIdeUi((s) => s.mobilePane);
	const toggleSidebar = useIdeUi((s) => s.toggleSidebar);
	const toggleChat = useIdeUi((s) => s.toggleChat);
	const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
	const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
	const setInlineOpen = useIdeUi((s) => s.setInlineOpen);
	const setMobilePane = useIdeUi((s) => s.setMobilePane);
	const composerRef = (0, import_react.useRef)(null);
	const [aiAvailable, setAiAvailable] = (0, import_react.useState)(null);
	const [layoutReady, setLayoutReady] = (0, import_react.useState)(false);
	const desktopMq = useIsDesktop();
	const keyboardInset = useKeyboardInset();
	const { user, account } = useAccount();
	const desktop = layoutReady && desktopMq;
	const captureCount = useIdeUi((s) => s.captures.length);
	const composerUnread = useIdeUi((s) => s.composerUnread);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const composerAlert = useWorkspace((s) => s.messages.some((m) => m.awaitingBuild)) || captureCount > 0 || agentRunning || composerUnread;
	const runningRef = (0, import_react.useRef)(false);
	(0, import_react.useLayoutEffect)(() => {
		setLayoutReady(true);
		hydrateAppearance();
	}, []);
	(0, import_react.useEffect)(() => {
		const was = runningRef.current;
		runningRef.current = agentRunning;
		if (was && !agentRunning) {
			const ui = useIdeUi.getState();
			if (ui.mobilePane !== "agent" || !ui.chatOpen) ui.setComposerUnread(true);
		}
	}, [agentRunning]);
	(0, import_react.useEffect)(() => {
		getAiStatus().then((s) => setAiAvailable(s.available)).catch(() => setAiAvailable(false));
	}, []);
	(0, import_react.useEffect)(() => {
		try {
			if (window.localStorage.getItem("aperture-debug") === "1") useIdeUi.setState({ debug: true });
		} catch {}
	}, []);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if (e.key === "Escape") {
				const ui = useIdeUi.getState();
				if (ui.githubOpen) {
					ui.setGithubOpen(false);
					return;
				}
				if (ui.historyOpen) {
					ui.setHistoryOpen(false);
					return;
				}
				if (ui.designOpen) {
					ui.setDesignOpen(false);
					return;
				}
				ui.setCommandOpen(false);
				ui.setInlineOpen(false);
				ui.setHelpOpen(false);
				ui.setNewFileOpen(false);
				return;
			}
			if (e.key === "F8") {
				const open = useIdeUi.getState();
				if (open.commandOpen || open.helpOpen || open.githubOpen || open.historyOpen) return;
				e.preventDefault();
				jumpReview(e.shiftKey ? -1 : 1, e.altKey);
				return;
			}
			if (!isModEvent(e)) return;
			const key = e.key.toLowerCase();
			if (key === "p") {
				e.preventDefault();
				setCommandOpen(true);
			} else if (key === "k") {
				e.preventDefault();
				setInlineOpen(true);
			} else if (key === "i") {
				e.preventDefault();
				useIdeUi.setState({
					chatOpen: true,
					mobilePane: "agent"
				});
				requestAnimationFrame(() => composerRef.current?.focus());
			} else if (key === "b") {
				e.preventDefault();
				toggleSidebar();
			} else if (key === "l") {
				e.preventDefault();
				toggleChat();
			} else if (key === "/") {
				e.preventDefault();
				setHelpOpen(true);
			} else if (key === "s") {
				e.preventDefault();
				downloadCurrentWorkspace().then((r) => toast.success(`Downloaded ${r.name} · ${r.count} files`)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not download"));
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		setCommandOpen,
		setHelpOpen,
		setInlineOpen,
		toggleChat,
		toggleSidebar
	]);
	const aiLabel = !user ? "Sign in" : account ? modelCaption(account) : aiAvailable === false ? "AI offline" : "grok-4.5";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ide-shell",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ide-workspace",
						"data-pane": mobilePane,
						"data-files": sidebarOpen ? "on" : "off",
						"data-agent": chatOpen ? "on" : "off",
						style: !desktop && keyboardInset ? { paddingBottom: keyboardInset } : void 0,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(qt, {
							orientation: "horizontal",
							className: "h-full min-h-0 min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
									id: "files",
									defaultSize: "16%",
									minSize: "12%",
									maxSize: "28%",
									className: "min-h-0 overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileTree, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(nn, {
									id: "sep-files",
									className: "w-px bg-border hover:bg-accent/40"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
									id: "editor",
									minSize: "32%",
									className: "min-h-0 overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorColumn, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(nn, {
									id: "sep-agent",
									className: "w-px bg-border hover:bg-accent/40"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
									id: "agent",
									defaultSize: "26%",
									minSize: "22%",
									maxSize: "40%",
									className: "min-h-0 overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentPanel, { composerRef })
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							className: "ide-dock grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]",
							children: [
								[
									"files",
									FolderTree,
									"Files"
								],
								[
									"editor",
									CodeXml,
									"Code"
								],
								[
									"agent",
									Sparkles,
									"Composer"
								]
							].map(([id, Icon, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setMobilePane(id),
								className: cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[12px]", mobilePane === id ? "text-fg" : "text-subtle"),
								children: [
									mobilePane === id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-0 h-0.5 w-10 rounded-full bg-accent" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "relative",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5" }), id === "agent" && composerAlert && mobilePane !== "agent" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute -right-1 -top-0.5 size-1.5 rounded-full bg-accent" })]
									}),
									label
								]
							}, id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBar, { aiLabel })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenProjectHost, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandPalette, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineEdit, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewFileDialog, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelpDialog, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryDialog, {})
		]
	});
}
var Route$6 = createFileRoute("/app")({
	component: AppEditor,
	codeSplitGroupings: []
});
function AppEditor() {
	const hydrate = useWorkspace((s) => s.hydrate);
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IdeShell, {});
}
var $$splitComponentImporter$2 = () => import("./login-nFSs0-aZ.mjs");
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
var $$splitComponentImporter$1 = () => import("./pricing-yBkyqyHQ.mjs");
var Route$4 = createFileRoute("/pricing")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./settings-BBsvOzF9.mjs");
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
	const { MAX_AGENT_BODY, rateLimit, sanitizeAgentInput } = await import("./agent-guard.server-BUMQqc-J.mjs");
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
		const { planById } = await import("./plans-CTIRB29R.mjs").then((n) => n.o);
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
				const { runAcpSession } = await import("./session.server-CQCViHN9.mjs");
				await runAcpSession(input, {
					userId,
					emit,
					signal: request.signal
				});
			} else {
				const { resolveModel, recordAgentRun, canAffordRuns } = await import("./api-CT8K4ti-.mjs").then((n) => n.t);
				const resolved = await resolveModel(userId, input.source);
				if (!resolved.ok) {
					emit({
						type: "error",
						error: resolved.error
					});
					return;
				}
				const { runComposerStreaming } = await import("./fanout.server-Dhf9pPOp.mjs");
				const { result, bills } = await runComposerStreaming(input, {
					provider: resolved.provider,
					apiKey: resolved.apiKey,
					hosted: resolved.hosted,
					cents: resolved.cents
				}, emit, request.signal, (n) => canAffordRuns(userId, resolved.source, n), async (source) => {
					const extra = await resolveModel(userId, source ?? resolved.source);
					if (!extra.ok) throw new Error(extra.error);
					return {
						provider: extra.provider,
						apiKey: extra.apiKey,
						hosted: extra.hosted,
						cents: extra.cents
					};
				});
				if (result.ok) for (const bill of bills) await recordAgentRun(userId, bill.hosted, bill.cents);
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
	const { rateLimit } = await import("./agent-guard.server-BUMQqc-J.mjs");
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
	const { tabCacheGet, tabCacheKey, tabCacheSet, completeTab } = await import("./tab.server-DPILrodV.mjs");
	const cacheKey = tabCacheKey(path, prefix, suffix);
	const cached = tabCacheGet(cacheKey);
	if (cached !== null) return Response.json({ text: cached });
	const { resolveTabModel, recordTabUse } = await import("./api-CT8K4ti-.mjs").then((n) => n.t);
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
export { deleteAgent as a, useAccount as c, Input as i, Route$3 as n, listAgents as o, Route$5 as r, saveAgent as s, router_exports as t };
