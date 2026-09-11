import { o as __toESM } from "../_runtime.mjs";
import { n as BUILTIN_ACP } from "./kinds-CCf1JBpH.mjs";
import { i as safeRelPath, t as isSecretPath } from "./redact-Ckw8E-v4.mjs";
import { n as PROVIDERS } from "./plans-DGQaVOnT.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware--02wTOzZ.mjs";
import { i as quoteRun } from "./cost-ClHSqIUc.mjs";
import { n as createSsrRpc, o as setModelSource } from "./api-B6IoZzRV.mjs";
import { a as isModEvent, i as fuzzyMatch, n as cn, o as modSymbol, r as extOf, t as basename } from "./utils-DTfuEt1f.mjs";
import { n as assembleImport, r as filesFromZipBuffer } from "./project-files-B6R06HJh.mjs";
import { t as parseUnifiedDiff } from "./patch-BCE3WVGP.mjs";
import { d as languageFromPath, f as lineDiff, i as diffStats, l as hunksFromDiff, n as activeMention, o as filterMentions, p as mentionItems, s as findRules, t as DEFAULT_RULES, u as indexFiles } from "./mentions-oewKtHXt.mjs";
import { r as getBearerToken } from "./client-BXBOTlUB.mjs";
import { a as buttonVariants, n as AuthSlot, o as useCurrentUserState, r as Button, t as ApertureMark } from "./auth-slot-DaGNui3N.mjs";
import { n as useAccount, t as modelCaption } from "./use-account-6kRdJ016.mjs";
import { n as listAgents } from "./api-B8dbh4HJ.mjs";
import { t as Input } from "./input-DFmVyX9g.mjs";
import { A as FileDiff, B as Bug, C as Github, D as FileText, E as FolderOpen, F as Clock, I as Circle, L as CircleDot, M as FileArchive, N as Download, O as FileSearch, P as CodeXml, R as ChevronRight, T as FolderTree, V as ArrowUp, _ as MessageSquare, c as Sparkles, d as Search, f as ScrollText, g as PanelLeft, h as Play, i as Undo2, j as FileCode, k as FileJson, m as Plus, n as Wrench, o as Trash2, p as RotateCcw, r as WandSparkles, s as Square, t as X, u as Settings, v as LoaderCircle, w as Folder, x as Keyboard, y as ListTodo, z as Check } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as nn, r as qt, t as Qt } from "../_libs/react-resizable-panels.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { t as require_lib } from "../_libs/jszip+[...].mjs";
import { $ as GutterMarker, A as indentOnInput, B as tags, C as foldGutter, I as syntaxHighlighting, Q as EditorView, St as Prec, Tt as StateField, X as Decoration, at as gutter, bt as EditorState, ct as keymap, et as ViewPlugin, g as bracketMatching, i as closeBracketsKeymap, l as HighlightStyle, lt as lineNumbers, mt as Annotation, n as autocompletion, nt as drawSelection, o as completionKeymap, ot as highlightActiveLine, r as closeBrackets, st as highlightActiveLineGutter, tt as WidgetType, vt as Compartment, wt as StateEffect, y as defaultHighlightStyle } from "../_libs/@codemirror/autocomplete+[...].mjs";
import { i as indentWithTab, n as history, r as historyKeymap, t as defaultKeymap } from "../_libs/codemirror__commands.mjs";
import { n as searchKeymap, t as highlightSelectionMatches } from "../_libs/codemirror__search.mjs";
import { t as css } from "../_libs/@codemirror/lang-css+[...].mjs";
import { r as javascript, t as html } from "../_libs/@codemirror/lang-html+[...].mjs";
import { t as json } from "../_libs/@codemirror/lang-json+[...].mjs";
import { t as markdown } from "../_libs/@codemirror/lang-markdown+[...].mjs";
import { t as python } from "../_libs/@codemirror/lang-python+[...].mjs";
import { t as _e } from "../_libs/cmdk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-CMqgEat6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_lib = /* @__PURE__ */ __toESM(require_lib());
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
var STORAGE_KEY = "aperture-workspace-v1";
function persist(state) {
	if (typeof window === "undefined") return;
	const base = {
		name: state.name,
		files: state.files,
		openTabs: state.openTabs,
		activePath: state.activePath,
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
		const files = {
			...get().files,
			[edit.path]: edit.newText
		};
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
			openTabs,
			activePath: edit.path,
			chunks: buildIndex(files),
			messages
		});
	}
	function restoreCheckpoint(id) {
		const ck = get().checkpoints.find((c) => c.id === id);
		if (!ck) return null;
		const files = restoreFiles(get().files, ck.before);
		const tabs = syncTabs(files, get().openTabs, get().activePath);
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
			chunks: buildIndex(files),
			messages
		});
		schedulePersist();
		return ck;
	}
	return {
		ready: true,
		name: DEMO_WORKSPACE_NAME,
		files: { ...DEMO_FILES },
		openTabs: ["README.md", "src/store.ts"],
		activePath: "README.md",
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
					const nextFiles = (parsed.files && Object.keys(parsed.files).length > 0 ? parsed.files : null) ?? get().files;
					if (nextFiles && Object.keys(nextFiles).length > 0) {
						const nextTabs = parsed.openTabs?.length ? parsed.openTabs.filter((p) => nextFiles[p] !== void 0) : [Object.keys(nextFiles)[0]];
						const nextActive = parsed.activePath && nextFiles[parsed.activePath] !== void 0 ? parsed.activePath : nextTabs[0];
						set({
							name: parsed.name || "harbor-api",
							files: nextFiles,
							openTabs: nextTabs,
							activePath: nextActive,
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
			set({
				name: DEMO_WORKSPACE_NAME,
				files: { ...DEMO_FILES },
				openTabs: ["README.md", "src/store.ts"],
				activePath: "README.md",
				chunks: buildIndex(DEMO_FILES),
				messages: [],
				checkpoints: [],
				selection: null,
				agentRunning: false,
				runningMode: null
			});
			schedulePersist();
		},
		loadProject: (name, nextFiles) => {
			const paths = Object.keys(nextFiles).sort();
			if (paths.length === 0) return;
			const preferred = paths.find((p) => /^(readme\.md|readme)$/i.test(p.split("/").pop() ?? "")) ?? paths.find((p) => p === ".aperture.md") ?? paths[0];
			set({
				indexing: true,
				name,
				files: nextFiles,
				openTabs: [preferred],
				activePath: preferred,
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
			const { files, openTabs, activePath } = get();
			if (files[path] === void 0) return;
			if (activePath === path && openTabs.includes(path)) return;
			set({
				openTabs: openTabs.includes(path) ? openTabs : [...openTabs, path],
				activePath: path
			});
			schedulePersist();
		},
		closeTab: (path) => {
			const tabs = get().openTabs.filter((p) => p !== path);
			set({
				openTabs: tabs,
				activePath: get().activePath === path ? tabs[tabs.length - 1] ?? null : get().activePath
			});
			schedulePersist();
		},
		setActive: (path) => {
			set({ activePath: path });
			schedulePersist();
		},
		writeFile: (path, content) => {
			if (isSecretPath(path)) return;
			if (get().files[path] === content) return;
			set({ files: {
				...get().files,
				[path]: content
			} });
			schedulePersist();
			scheduleReindex();
		},
		createFile: (path, content = "") => {
			const clean = safeRelPath(path);
			if (!clean || isSecretPath(clean)) return;
			const files = {
				...get().files,
				[clean]: content
			};
			set({
				files,
				openTabs: get().openTabs.includes(clean) ? get().openTabs : [...get().openTabs, clean],
				activePath: clean,
				chunks: buildIndex(files)
			});
			schedulePersist();
		},
		deleteFile: (path) => {
			const files = { ...get().files };
			delete files[path];
			const openTabs = get().openTabs.filter((p) => p !== path);
			set({
				files,
				openTabs,
				activePath: get().activePath === path ? openTabs[openTabs.length - 1] ?? null : get().activePath,
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
			const message = get().messages.find((m) => m.edits?.some((e) => e.id === edit.id));
			if (message) ensureCheckpointForMessage(message.id);
			applyOne(edit);
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
			const pendingByMessage = get().messages.filter((m) => m.edits?.some((e) => e.status === "pending"));
			for (const message of pendingByMessage) ensureCheckpointForMessage(message.id);
			const pending = get().messages.flatMap((m) => m.edits ?? []).filter((e) => e.status === "pending");
			for (const edit of pending) applyOne(edit);
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
function hasCodeRange(selection) {
	if (!selection || selection.empty) return false;
	return selection.text.trim().length > 0;
}
var useIdeUi = create((set) => ({
	sidebarOpen: true,
	chatOpen: true,
	commandOpen: false,
	helpOpen: false,
	newFileOpen: false,
	githubOpen: false,
	inlineOpen: false,
	mobilePane: "editor",
	toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
	toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
	setChatOpen: (open) => set({ chatOpen: open }),
	setCommandOpen: (open) => set({ commandOpen: open }),
	setHelpOpen: (open) => set({ helpOpen: open }),
	setNewFileOpen: (open) => set({ newFileOpen: open }),
	setGithubOpen: (open) => set({ githubOpen: open }),
	setInlineOpen: (open) => set({ inlineOpen: open }),
	setMobilePane: (pane) => set({ mobilePane: pane })
}));
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
	const openFile = useWorkspace((s) => s.openFile);
	const deleteFile = useWorkspace((s) => s.deleteFile);
	const [open, setOpen] = (0, import_react.useState)(depth < 1);
	const isFolder = Boolean(node.children);
	const active = activePath === node.path;
	const Icon = isFolder ? open ? FolderOpen : Folder : fileIcon(node.path);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("group flex h-8 items-center gap-1 rounded-md pr-1 text-[13px]", active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/70 hover:text-fg"),
		style: { paddingLeft: 8 + depth * 12 },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "flex min-w-0 flex-1 items-center gap-1.5 text-left",
			onClick: () => {
				if (isFolder) setOpen((v) => !v);
				else openFile(node.path);
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
				})
			]
		}), !isFolder && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": `Delete ${node.name}`,
			className: "flex size-7 items-center justify-center rounded-md text-subtle hover:text-danger md:opacity-0 md:group-hover:opacity-100",
			onClick: () => deleteFile(node.path),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
		})]
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
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "ghost",
			size: "icon-sm",
			"aria-label": "Open project",
			"aria-expanded": open,
			onClick: () => setOpen((v) => !v),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-4" })
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]",
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
				className: "flex h-10 w-full items-center gap-2 px-3 text-left text-[13px] text-fg hover:bg-bg",
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
	const files = useWorkspace((s) => s.files);
	const name = useWorkspace((s) => s.name);
	const chunks = useWorkspace((s) => s.chunks);
	const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
	const pending = (0, import_react.useMemo)(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);
	const setNewFileOpen = useIdeUi((s) => s.setNewFileOpen);
	const tree = (0, import_react.useMemo)(() => buildTree(Object.keys(files)), [files]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col bg-surface",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-10 items-center justify-between gap-1 border-b border-border px-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "min-w-0 truncate px-1 text-sm font-medium tracking-tight",
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenMenu, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-sm",
						"aria-label": "New file",
						onClick: () => setNewFileOpen(true),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "aperture-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3",
				children: tree.map((node) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeItem, {
					node,
					depth: 0,
					pending
				}, node.path))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-border px-3 py-2 text-[11px] text-subtle",
				children: [
					Object.keys(files).length,
					" files · ",
					chunks.length,
					" chunks"
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
function TabBar() {
	const openTabs = useWorkspace((s) => s.openTabs);
	const activePath = useWorkspace((s) => s.activePath);
	const setActive = useWorkspace((s) => s.setActive);
	const closeTab = useWorkspace((s) => s.closeTab);
	const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
	const pending = (0, import_react.useMemo)(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);
	if (openTabs.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 border-b border-border bg-surface" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-10 items-stretch overflow-x-auto border-b border-border bg-surface",
		children: openTabs.map((path) => {
			const active = path === activePath;
			const Icon = tabIcon(path);
			const staged = pending.has(path);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("group relative flex min-w-0 shrink-0 items-center gap-1 border-r border-border px-2", active ? "bg-bg text-fg" : "text-muted hover:bg-elevated/50 hover:text-fg"),
				children: [
					active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-x-0 bottom-0 h-px bg-accent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex max-w-48 items-center gap-1.5 truncate px-1 py-2 text-sm",
						onClick: () => setActive(path),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-3.5 shrink-0 text-subtle",
								strokeWidth: 1.6
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: basename(path)
							}),
							staged && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "size-1.5 shrink-0 rounded-full bg-ok",
								"aria-label": "Staged diff"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": `Close ${basename(path)}`,
						className: cn("flex size-6 items-center justify-center rounded-md hover:bg-elevated", active ? "opacity-100" : "opacity-0 group-hover:opacity-100"),
						onClick: () => closeTab(path),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
					})
				]
			}, path);
		})
	});
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
		span.textContent = this.text;
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
	color: "#52525b",
	fontStyle: "italic",
	pointerEvents: "none",
	opacity: "0.85"
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
			}, 380);
		}
		async request() {
			const filePath = path();
			if (!filePath) return;
			const state = this.view.state;
			const pos = state.selection.main.head;
			if (!state.selection.main.empty) return;
			const line = state.doc.lineAt(pos);
			if (pos - line.from < 6) return;
			if (line.text.trim().length < 4) return;
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
	const accept = keymap.of([{
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
	}, {
		key: "Escape",
		run: (view) => {
			if (!view.state.field(ghostField)) return false;
			view.dispatch({ effects: setGhost.of(null) });
			return true;
		}
	}]);
	return [
		ghostField,
		plugin,
		ghostTheme,
		Prec.high(accept)
	];
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
		Prec.high(keymap.of([{
			key: "Mod-Enter",
			run: () => {
				handlers.apply(edit);
				return true;
			}
		}, {
			key: "Mod-Backspace",
			run: () => {
				handlers.reject(edit.id);
				return true;
			}
		}]))
	];
}
/** Cursor-like syntax colors — more hue than chrome, still cool/neutral. */
var SYNTAX = {
	bg: "#0c0c0e",
	fg: "#e8e9ed",
	caret: "#f4f4f5",
	gutter: "#0c0c0e",
	gutterFg: "#5c5f69",
	activeLine: "#16161b",
	selection: "#1f4a3c",
	match: "#2d5c4c",
	keyword: "#8bb4e3",
	string: "#8fd4b2",
	fn: "#dcc191",
	type: "#9ec0c8",
	comment: "#6d7080",
	number: "#c9b8a0",
	property: "#c5c9d1",
	operator: "#8e929c",
	tag: "#8bb4e3",
	invalid: "#f87171"
};
var theme = EditorView.theme({
	"&": {
		backgroundColor: SYNTAX.bg,
		color: SYNTAX.fg,
		height: "100%",
		fontSize: "13.5px"
	},
	".cm-scroller": {
		overflow: "auto",
		fontFamily: "\"IBM Plex Mono\", ui-monospace, Menlo, Consolas, monospace",
		lineHeight: "1.7"
	},
	".cm-content": {
		caretColor: SYNTAX.caret,
		padding: "12px 0"
	},
	".cm-gutters": {
		backgroundColor: SYNTAX.gutter,
		color: SYNTAX.gutterFg,
		border: "none",
		borderRight: "1px solid #18181b"
	},
	".cm-lineNumbers .cm-gutterElement": {
		minWidth: "2.6rem",
		padding: "0 10px 0 8px"
	},
	".cm-activeLine": { backgroundColor: SYNTAX.activeLine },
	".cm-activeLineGutter": {
		backgroundColor: SYNTAX.activeLine,
		color: "#a1a1aa"
	},
	".cm-cursor": {
		borderLeftColor: SYNTAX.caret,
		borderLeftWidth: "2px"
	},
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "color-mix(in oklab, var(--color-ok) 34%, transparent)" },
	".cm-selectionMatch": { backgroundColor: SYNTAX.match },
	"&.cm-focused .cm-matchingBracket": {
		backgroundColor: SYNTAX.match,
		outline: "1px solid #8bb4e3"
	},
	".cm-foldPlaceholder": {
		background: "#18181b",
		border: "none",
		color: "#a1a1aa"
	},
	".cm-tooltip": {
		backgroundColor: "#18181b",
		border: "1px solid #27272a",
		color: SYNTAX.fg
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
var syncAnn = Annotation.define();
function CodePane() {
	const parentRef = (0, import_react.useRef)(null);
	const viewRef = (0, import_react.useRef)(null);
	const lastValue = (0, import_react.useRef)("");
	const pathRef = (0, import_react.useRef)(null);
	const writeFileRef = (0, import_react.useRef)(useWorkspace.getState().writeFile);
	const setSelectionRef = (0, import_react.useRef)(useWorkspace.getState().setSelection);
	const applyRef = (0, import_react.useRef)(useWorkspace.getState().applyEdit);
	const rejectRef = (0, import_react.useRef)(useWorkspace.getState().rejectEdit);
	const langConf = (0, import_react.useRef)(new Compartment()).current;
	const listenerConf = (0, import_react.useRef)(new Compartment()).current;
	const ghostConf = (0, import_react.useRef)(new Compartment()).current;
	const diffConf = (0, import_react.useRef)(new Compartment()).current;
	const scrolledFor = (0, import_react.useRef)(null);
	const jumpedFor = (0, import_react.useRef)(null);
	const activePath = useWorkspace((s) => s.activePath);
	const value = useWorkspace((s) => s.activePath ? s.files[s.activePath] ?? "" : "");
	const pendingEdit = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
	const writeFile = useWorkspace((s) => s.writeFile);
	const setSelection = useWorkspace((s) => s.setSelection);
	const applyEdit = useWorkspace((s) => s.applyEdit);
	const rejectEdit = useWorkspace((s) => s.rejectEdit);
	const { account } = useAccount();
	const tabOn = Boolean(account?.tab) && !pendingEdit;
	writeFileRef.current = writeFile;
	setSelectionRef.current = setSelection;
	applyRef.current = applyEdit;
	rejectRef.current = rejectEdit;
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
					autocompletion(),
					highlightSelectionMatches(),
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
					EditorView.lineWrapping
				]
			})
		});
		viewRef.current = view;
		lastValue.current = value;
		pathRef.current = activePath;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: ghostConf.reconfigure(tabOn ? ghostText(() => pathRef.current) : []),
			annotations: syncAnn.of(true)
		});
	}, [tabOn]);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view || !activePath) return;
		pathRef.current = activePath;
		const effects = [langConf.reconfigure(languageExtension(activePath))];
		if (value !== lastValue.current) {
			lastValue.current = value;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: value
				},
				effects,
				annotations: syncAnn.of(true)
			});
			return;
		}
		view.dispatch({
			effects,
			annotations: syncAnn.of(true)
		});
	}, [activePath, value]);
	(0, import_react.useEffect)(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: diffConf.reconfigure(pendingDiff(pendingEdit, {
				apply: (edit) => applyRef.current(edit),
				reject: (id) => rejectRef.current(id)
			})),
			annotations: syncAnn.of(true)
		});
	}, [pendingEdit]);
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
		if (!pendingEdit) {
			jumpedFor.current = null;
			return;
		}
		if (jumpedFor.current === pendingEdit.id) return;
		jumpedFor.current = pendingEdit.id;
		useIdeUi.getState().setMobilePane("editor");
	}, [pendingEdit]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-full min-h-0 bg-bg",
		children: [!activePath && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, {
				className: "size-8 text-subtle",
				strokeWidth: 1.4
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium text-fg",
				children: "Open a file to start"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xs text-sm text-pretty text-muted",
				children: "Pick one from the left, or ask Agent on the right to change the project."
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: parentRef,
			className: activePath ? "h-full min-h-0" : "hidden"
		})]
	});
}
function DiffBar({ edit }) {
	const applyEdit = useWorkspace((s) => s.applyEdit);
	const rejectEdit = useWorkspace((s) => s.rejectEdit);
	const live = useWorkspace((s) => s.files[edit.path]) === edit.oldText;
	const stats = diffStats(edit.oldText, edit.newText);
	const mod = modSymbol();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-9 shrink-0 items-center gap-2 border-b border-border bg-elevated px-3 py-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "min-w-0 flex-1 truncate text-xs text-muted",
				children: live ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: edit.description || "Staged edit"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-subtle",
					children: " · in the file"
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "File changed since this was staged. Apply overwrites it." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "hidden font-mono text-[11px] tabular-nums text-ok sm:inline",
				children: ["+", stats.added]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "hidden font-mono text-[11px] tabular-nums text-danger sm:inline",
				children: ["−", stats.removed]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "ghost",
				size: "sm",
				className: "h-7 px-2",
				onClick: () => rejectEdit(edit.id),
				"aria-label": "Reject edit",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), "Reject"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				className: "h-7 px-2.5",
				onClick: () => applyEdit(edit),
				title: `${mod}+Enter`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "Apply"]
			})
		]
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
	const state = useWorkspace.getState();
	return {
		mode,
		instruction,
		history: state.messages.filter((m) => m.content.trim().length > 0).slice(-8).map((m) => ({
			role: m.role,
			content: m.content
		})),
		files: Object.entries(state.files).map(([path, content]) => ({
			path,
			content
		})),
		activePath: state.activePath,
		selection: state.selection,
		source: source ?? void 0,
		agentId: agentId ?? null,
		phase: extra?.phase,
		approvedPlan: extra?.approvedPlan
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
	const input = agentPayload(phase === "build" && opts?.approvedPlan?.length ? `${trimmed}\n\nApproved plan:\n${opts.approvedPlan.map((e, i) => `${i + 1}. ${e.content}`).join("\n")}` : trimmed, mode, source, opts?.agentId, {
		phase,
		approvedPlan: opts?.approvedPlan
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
				status: void 0
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
				ws.patchMessage(asstId, {
					content: text,
					traces,
					edits,
					plan,
					status: void 0,
					awaitingBuild: Boolean(event.awaitingBuild)
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
			toast.error("Sign in to run Agent.");
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
function EditorColumn() {
	const pending = useWorkspace((s) => pendingEditFor(s.messages, s.activePath));
	const running = useWorkspace((s) => s.agentRunning);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabBar, {}),
			pending && !running && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffBar, { edit: pending }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodePane, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenerateOverlay, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectionActions, {})
				]
			})
		]
	});
}
function tabLabel(account) {
	if (!account?.tab) return "Tab · Pro";
	if (account.modelSource !== "hosted" && account.keys[account.modelSource]?.set) return "Tab · your key";
	return `Tab ${account.tabRemaining}/${account.tabCap}`;
}
function StatusBar({ aiLabel, account }) {
	const activePath = useWorkspace((s) => s.activePath);
	const chunks = useWorkspace((s) => s.chunks);
	const indexing = useWorkspace((s) => s.indexing);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const files = useWorkspace((s) => s.files);
	const selection = useWorkspace((s) => s.selection);
	const staged = useWorkspace((s) => listPendingEdits(s.messages).length);
	const lang = activePath ? languageFromPath(activePath) : "";
	const mod = modSymbol();
	const line = selection && selection.path === activePath ? selection.fromLine : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-8 items-center justify-between gap-3 border-t border-border bg-surface px-3 text-xs text-subtle",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: indexing || agentRunning ? "shimmer-text" : "",
					children: agentRunning ? "Agent running" : indexing ? "Indexing…" : "Ready"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular-nums",
					children: [
						Object.keys(files).length,
						" files · ",
						chunks.length,
						" chunks"
					]
				}),
				staged > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-ok",
					children: [
						staged,
						" staged ",
						staged === 1 ? "diff" : "diffs"
					]
				}),
				activePath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden truncate sm:inline",
					children: activePath
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hidden items-center gap-3 sm:flex",
			children: [
				line != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular-nums",
					children: ["Ln ", line]
				}),
				lang && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "uppercase",
					children: lang
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: aiLabel }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tabLabel(account) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					mod,
					"I agent · ",
					mod,
					"K edit · ",
					mod,
					"P files"
				] })
			]
		})]
	});
}
function DiffCard({ edit }) {
	const applyEdit = useWorkspace((s) => s.applyEdit);
	const rejectEdit = useWorkspace((s) => s.rejectEdit);
	const openFile = useWorkspace((s) => s.openFile);
	const shown = lineDiff(edit.oldText, edit.newText).filter((l, i, arr) => {
		if (l.type !== "eq") return true;
		const prev = arr[i - 1]?.type;
		const next = arr[i + 1]?.type;
		return prev !== "eq" || next !== "eq" || prev === void 0 || next === void 0;
	}).slice(0, 80);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-lg border border-border bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 border-b border-border px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex min-w-0 items-center gap-2 text-left",
					onClick: () => {
						openFile(edit.path);
						useIdeUi.getState().setMobilePane("editor");
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDiff, { className: "size-3.5 shrink-0 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate font-mono text-[12px] text-fg",
						children: edit.path
					})]
				}), edit.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-sm",
						"aria-label": "Reject edit",
						onClick: () => rejectEdit(edit.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						className: "h-7 px-2.5",
						onClick: () => applyEdit(edit),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "Apply"]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("text-[11px]", edit.status === "applied" ? "text-ok" : "text-subtle"),
					children: edit.status
				})]
			}),
			edit.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "border-b border-border px-3 py-1.5 text-[12px] text-muted",
				children: edit.description
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "aperture-scroll max-h-56 overflow-auto font-mono text-[11px] leading-5",
				children: shown.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("px-3 whitespace-pre-wrap", line.type === "add" && "bg-ok/10 text-ok", line.type === "del" && "bg-danger/10 text-danger", line.type === "eq" && "text-subtle"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "inline-block w-4",
						children: line.type === "add" ? "+" : line.type === "del" ? "−" : " "
					}), line.text || " "]
				}, `${i}-${line.type}`))
			})
		]
	});
}
function PlanCard({ entries, awaitingBuild = false }) {
	if (entries.length === 0) return null;
	const done = entries.filter((e) => e.status === "completed").length;
	const live = entries.some((e) => e.status === "in_progress");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2 overflow-hidden rounded-lg border border-border bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2 border-b border-border px-3 py-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium text-subtle",
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
function MentionPopover({ items, active, onPick }) {
	if (items.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mb-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-elevated py-1",
		children: items.map((item, index) => {
			const Icon = item.kind === "folder" ? Folder : FileCode;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onMouseDown: (e) => {
					e.preventDefault();
					onPick(item);
				},
				className: cn("flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]", index === active ? "bg-border text-fg" : "text-muted hover:bg-bg hover:text-fg"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5 shrink-0" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate font-mono",
						children: item.path
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto text-[10px] tracking-wide text-subtle uppercase",
						children: item.kind
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
			className: cn("truncate text-[11px]", quote.blocked ? "text-warn" : "text-subtle"),
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
	const messages = useWorkspace((s) => s.messages);
	const agentRunning = useWorkspace((s) => s.agentRunning);
	const files = useWorkspace((s) => s.files);
	const name = useWorkspace((s) => s.name);
	const clearChat = useWorkspace((s) => s.clearChat);
	const applyAllPending = useWorkspace((s) => s.applyAllPending);
	const undoLast = useWorkspace((s) => s.undoLast);
	const checkpoints = useWorkspace((s) => s.checkpoints);
	const { user, isPending } = useCurrentUserState();
	const { account, setAccount, refresh } = useAccount();
	const [draft, setDraft] = (0, import_react.useState)("");
	const [mode, setMode] = (0, import_react.useState)("composer");
	const [caret, setCaret] = (0, import_react.useState)(0);
	const [mentionHi, setMentionHi] = (0, import_react.useState)(0);
	const [dismissMention, setDismissMention] = (0, import_react.useState)(false);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	const [agents, setAgents] = (0, import_react.useState)([]);
	const [target, setTarget] = (0, import_react.useState)({
		kind: "model",
		source: "hosted"
	});
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
	const catalog = (0, import_react.useMemo)(() => mentionItems(files), [files]);
	const mention = dismissMention ? null : activeMention(draft, caret);
	const mentionHits = mention ? filterMentions(catalog, mention.query) : [];
	const rules = findRules(files);
	const signedOut = mounted && !isPending && !user;
	const suggestions = name === "harbor-api" ? DEMO_SUGGESTIONS : GENERIC_SUGGESTIONS;
	const pending = messages.flatMap((m) => m.edits ?? []).filter((e) => e.status === "pending");
	const source = target.kind === "model" ? target.source : account?.modelSource ?? "hosted";
	const quote = quoteRun(account, source);
	const blocked = target.kind === "model" && quote.blocked;
	const acpBlocked = target.kind === "acp" && target.remote === false && quote.blocked;
	(0, import_react.useEffect)(() => {
		setMentionHi(0);
	}, [mention?.query, mention?.start]);
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
		const trimmed = text.trim();
		if (!trimmed || agentRunning) return;
		if (!user) return;
		if (target.kind === "acp" && !account?.acp) {
			toast.error("ACP sessions are on Pro.");
			return;
		}
		if ((blocked || acpBlocked) && !background) return;
		setDraft("");
		setDismissMention(false);
		if (background) {
			await queueBackground(trimmed);
			return;
		}
		const resolvedPhase = mode === "composer" ? phase ?? "plan" : void 0;
		await submitAgent(trimmed, mode === "inline" ? "composer" : mode, source, {
			agentId: target.kind === "acp" ? target.id : null,
			agentLabel: target.kind === "acp" ? target.name : "Aperture",
			phase: resolvedPhase
		});
		refresh();
	}
	async function buildPlan(message) {
		if (agentRunning || !user || !message.plan?.length) return;
		useWorkspace.getState().patchMessage(message.id, { awaitingBuild: false });
		await submitAgent("Build it.", "composer", source, {
			agentId: target.kind === "acp" ? target.id : null,
			agentLabel: message.agentLabel || (target.kind === "acp" ? target.name : "Aperture"),
			phase: "build",
			approvedPlan: message.plan
		});
		refresh();
	}
	function onKeyDown(e) {
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
		else ws.createFile(".aperture.md", DEFAULT_RULES);
		useIdeUi.getState().setMobilePane("editor");
	}
	const sendBlocked = !draft.trim() || isPending || !user || blocked || acpBlocked;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col bg-surface",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-10 items-center gap-1 border-b border-border px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex rounded-md border border-border p-0.5",
						children: [[
							"composer",
							"Agent",
							Sparkles
						], [
							"chat",
							"Ask",
							MessageSquare
						]].map(([id, label, Icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setMode(id),
							className: cn("inline-flex h-7 items-center gap-1 rounded px-2 text-xs", mode === id ? "bg-elevated text-fg" : "text-subtle hover:text-fg"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }), label]
						}, id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hidden px-2 text-xs text-subtle sm:inline",
						children: mode === "composer" ? "Plans, then waits" : "Answers only"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							"aria-label": rules ? `Open ${rules.path}` : "Create project rules",
							onClick: openRules,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollText, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							"aria-label": "Clear chat",
							onClick: clearChat,
							disabled: messages.length === 0,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "aperture-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3",
				children: messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					suggestions,
					signedOut,
					rulesPath: rules?.path ?? null,
					onSuggest: (s) => {
						setDraft(s);
						if (user && !blocked && !acpBlocked) send(s);
					}
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-4",
					children: messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageBlock, {
						message,
						running: agentRunning,
						quoteLabel: quote.label,
						onBuild: () => void buildPlan(message)
					}, message.id))
				})
			}),
			pending.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 border-t border-border px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[12px] text-muted",
					children: [
						pending.length,
						" staged ",
						pending.length === 1 ? "diff" : "diffs"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					onClick: () => applyAllPending(),
					children: "Apply all"
				})]
			}),
			pending.length === 0 && checkpoints.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 border-t border-border px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "min-w-0 truncate text-[12px] text-muted",
					children: ["Last run: ", checkpoints[checkpoints.length - 1].label]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => {
						const ck = undoLast();
						if (ck) toast.success(`Undid “${ck.label}”`);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5" }), "Undo last"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-border px-3 pt-2 pb-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-1.5 text-xs text-subtle",
					children: "I can explain, fix, or scan the open file."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssistChips, {})]
			}),
			account && jobsOn && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsTray, {
				jobs,
				cap: Math.max(1, account.backgroundJobs),
				liveCount,
				acp: account.acp,
				onJobs: setJobs
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t border-border p-3",
				children: signedOut ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Sign in to run Agent. Opening a folder or zip does not need an account."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						search: { next: "/app" },
						className: cn(buttonVariants({ size: "sm" })),
						children: "Sign in"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => pickFolder(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5" }), "Open folder"]
					})]
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: (e) => {
						e.preventDefault();
						send(draft);
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionPopover, {
							items: mentionHits,
							active: mentionHi,
							onPick: insertMention
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("composer-rim rounded-xl p-px", agentRunning && "is-live"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								ref: composerRef,
								value: draft,
								onChange: (e) => {
									setDraft(e.target.value);
									setDismissMention(false);
									syncCaret(e.target);
								},
								onKeyUp: (e) => syncCaret(e.currentTarget),
								onClick: (e) => syncCaret(e.currentTarget),
								onKeyDown,
								placeholder: mode === "chat" ? "Ask about the repo. Nothing is written." : "Describe the change. Agent plans first — you click Build it. @ attaches a file.",
								rows: 3,
								className: "min-h-20 w-full resize-none rounded-[11px] border-0 bg-bg px-3 py-2.5 text-sm leading-relaxed text-fg placeholder:text-subtle focus-visible:outline-none"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostMeter, {
								quote,
								acpLabel: target.kind === "acp" ? target.name : null,
								acpRemote: target.kind === "acp" && target.remote
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [account && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelPicker, {
									account,
									target,
									onTarget: setTarget,
									onAccount: setAccount,
									agents
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ml-auto flex items-center gap-1",
									children: [
										mode === "composer" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "sm",
											variant: "ghost",
											disabled: sendBlocked,
											onClick: () => void send(draft, false, "skip"),
											children: "Build now"
										}),
										account && account.backgroundJobs > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "icon-sm",
											variant: "ghost",
											"aria-label": "Send in background",
											disabled: sendBlocked,
											onClick: () => void send(draft, true),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5" })
										}),
										agentRunning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "icon-sm",
											"aria-label": "Stop",
											onClick: () => abortAgent(),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3.5 fill-current" })
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "submit",
											size: "icon-sm",
											disabled: sendBlocked,
											"aria-label": "Plan",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
										})
									]
								})]
							})]
						})
					]
				})
			})
		]
	});
}
function EmptyState({ suggestions, signedOut, rulesPath, onSuggest }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-base font-medium tracking-tight",
				children: "What should Agent do?"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm leading-relaxed text-pretty text-muted",
				children: "Agent writes a plan and waits. You click Build it. Ask only answers — it never edits."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-5 space-y-3",
				children: [
					{
						n: "1",
						title: "Open a project",
						body: "Folder, zip, or GitHub from the file tree."
					},
					{
						n: "2",
						title: "Ask in English",
						body: "Agent researches and posts a plan. You decide whether to build."
					},
					{
						n: "3",
						title: "Build it, then apply",
						body: "Agent stages diffs. Apply per file, or undo the run."
					}
				].map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-6 shrink-0 place-items-center rounded-md border border-border font-mono text-xs text-subtle",
						children: step.n
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: step.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs leading-relaxed text-muted",
						children: step.body
					})] })]
				}, step.n))
			}),
			rulesPath ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-xs text-subtle",
				children: ["Rules: ", rulesPath]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-subtle",
				children: "No rules yet — the scroll icon creates .aperture.md."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-2",
				children: suggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onSuggest(s),
					className: "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-left text-sm text-muted transition-colors hover:border-accent/40 hover:text-fg",
					children: s
				}) }, s))
			}),
			signedOut && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-subtle",
				children: "Suggestions run after you sign in."
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
function MessageBlock({ message, running, quoteLabel, onBuild }) {
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
	const empty = !message.content.trim();
	const live = running && empty && plan.length === 0;
	const waiting = Boolean(message.awaitingBuild && plan.length > 0);
	const analyzing = live && runningMode === "chat";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs font-medium text-subtle",
			children: message.agentLabel || "Agent"
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
				onClick: onBuild,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" }), "Build it"]
			})]
		}),
		edits.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 space-y-2",
			children: [edits.map((edit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffCard, { edit }, edit.id)), edits.some((e) => e.status === "applied") && message.checkpointId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				className: "w-full",
				onClick: () => {
					const ck = useWorkspace.getState().undoCheckpoint(message.checkpointId);
					if (ck) toast.success(`Undid “${ck.label}”`);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5" }), "Undo this run"]
			})]
		})
	] });
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
function CommandPalette() {
	const open = useIdeUi((s) => s.commandOpen);
	const setCommandOpen = useIdeUi((s) => s.setCommandOpen);
	const setMobilePane = useIdeUi((s) => s.setMobilePane);
	const setGithubOpen = useIdeUi((s) => s.setGithubOpen);
	const files = useWorkspace((s) => s.files);
	const openFile = useWorkspace((s) => s.openFile);
	const loadDemo = useWorkspace((s) => s.loadDemo);
	const reindex = useWorkspace((s) => s.reindex);
	const checkpoints = useWorkspace((s) => s.checkpoints);
	const [query, setQuery] = (0, import_react.useState)("");
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		if (!open) setQuery("");
	}, [open]);
	const paths = (0, import_react.useMemo)(() => Object.keys(files).filter((p) => fuzzyMatch(query, p)), [files, query]);
	if (!open) return null;
	function close() {
		setCommandOpen(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Close command palette",
			className: "absolute inset-0 bg-bg/70",
			onClick: close
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e, {
			className: "relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]",
			shouldFilter: false,
			loop: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 border-b border-border px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Input, {
					value: query,
					onValueChange: setQuery,
					placeholder: "Go to file or run a command",
					className: "h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.List, {
				className: "aperture-scroll max-h-80 overflow-y-auto p-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Empty, {
						className: "px-3 py-6 text-center text-sm text-muted",
						children: "No matches"
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
							className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
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
									close();
									pickFolder();
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "size-3.5 text-subtle" }), "Open folder"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									pickZip();
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileArchive, { className: "size-3.5 text-subtle" }), "Open zip"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									setGithubOpen(true);
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Github, { className: "size-3.5 text-subtle" }), "Open GitHub repo"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									downloadCurrentWorkspace().then((r) => toast.success(`Downloaded ${r.name} · ${r.count} files`)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not download"));
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5 text-subtle" }), "Download zip"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									close();
									const ck = useWorkspace.getState().undoLast();
									if (ck) toast.success(`Undid “${ck.label}”`);
									else toast.error("Nothing to undo");
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
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
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5 text-subtle" }), "Session cap"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									reindex();
									close();
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-subtle" }), "Rebuild index"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_e.Item, {
								onSelect: () => {
									abortAgent();
									loadDemo();
									close();
								},
								className: "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated",
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
	const rows = [
		[`${mod}P`, "Go to file"],
		[`${mod}S`, "Download project zip"],
		[`${mod}K`, "Inline edit on the selection"],
		[`${mod}I`, "Focus Agent"],
		[`${mod}Enter`, "Apply staged diff in the editor"],
		["Tab", "Accept ghost-text (Pro)"],
		[`${mod}B`, "Toggle file tree"],
		[`${mod}L`, "Toggle agent panel"],
		[`${mod}/`, "This cheat sheet"]
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
					children: "Shortcuts"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 space-y-2",
					children: rows.map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-4 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
							className: "rounded-md border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg",
							children: key
						})]
					}, key))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-5 space-y-2 border-t border-border pt-4",
					children: [
						"Drop a folder, files, or .zip onto the editor to replace the workspace.",
						"Download a zip from Open, the command palette, or ⌘S / Ctrl+S. .env never goes in.",
						"Staged diffs draw in the open file. Apply there (Ctrl+Enter) or in chat. Undo this run restores the files from before that send.",
						"Highlight code, then Explain this or Fix this. Same chips sit above Composer.",
						"Open GitHub from the file tree — public repos, signed in.",
						"Type @ in Composer to attach a file or folder.",
						"Agent plans first, then waits. Click Build it to allow edits. Build now (next to send) skips the gate for a one-file fix. Ask never writes.",
						"Session cap is on by default. Raise it under Settings → Limits.",
						"Tab ghost-text is on Pro (fast model, daily hosted cap). Background jobs: 1 on Pro, 3 on Team."
					].map((note) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-[13px] leading-relaxed text-muted",
						children: note
					}, note))
				})
			]
		})]
	});
}
var importGithubRepo = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("a6dccb63260437501493951a47994e9dc8b7950c9e8ffbc0e2a79f328c3dc1e2"));
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
			setDragging(true);
		}
		function onDragLeave(e) {
			if (e.relatedTarget === null) setDragging(false);
		}
		function onDrop(e) {
			if (!e.dataTransfer) return;
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
			className: "pointer-events-none fixed inset-0 z-40 grid place-items-center bg-bg/70",
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
function useIsDesktop() {
	return (0, import_react.useSyncExternalStore)((onChange) => {
		const mq = window.matchMedia("(min-width: 768px)");
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, () => window.matchMedia("(min-width: 768px)").matches, () => true);
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
	const desktop = useIsDesktop();
	const { user, account } = useAccount();
	const projectName = useWorkspace((s) => s.name);
	const activePath = useWorkspace((s) => s.activePath);
	(0, import_react.useEffect)(() => {
		getAiStatus().then((s) => setAiAvailable(s.available)).catch(() => setAiAvailable(false));
	}, []);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if (e.key === "Escape") {
				const ui = useIdeUi.getState();
				if (ui.githubOpen) {
					ui.setGithubOpen(false);
					return;
				}
				ui.setCommandOpen(false);
				ui.setInlineOpen(false);
				ui.setHelpOpen(false);
				ui.setNewFileOpen(false);
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
		className: "flex h-dvh min-h-0 flex-col bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex h-11 items-center gap-2 border-b border-border px-2 sm:px-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						className: "flex items-center gap-2 text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApertureMark, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-medium tracking-tight",
							children: "Aperture"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden max-w-40 truncate text-xs text-subtle sm:inline",
						children: projectName
					}),
					activePath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden min-w-0 truncate font-mono text-xs text-muted lg:inline",
						children: activePath
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex min-w-0 items-center gap-1",
						children: [
							desktop && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon-sm",
								"aria-label": "Toggle file tree",
								onClick: toggleSidebar,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeft, { className: "size-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: chatOpen ? "subtle" : "ghost",
								size: "sm",
								"aria-label": "Toggle agent",
								onClick: () => {
									toggleChat();
									requestAnimationFrame(() => composerRef.current?.focus());
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Agent"]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/settings",
								search: { tab: "models" },
								"aria-label": "Model settings",
								className: "grid size-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon-sm",
								"aria-label": "Keyboard shortcuts",
								onClick: () => setHelpOpen(true),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthSlot, { compact: true })
						]
					})
				]
			}),
			desktop ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex min-h-0 flex-1",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(qt, {
					orientation: "horizontal",
					className: "h-full w-full",
					children: [
						sidebarOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
							id: "files",
							defaultSize: "18%",
							minSize: "14%",
							maxSize: "30%",
							className: "min-h-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileTree, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(nn, { className: "w-px bg-border hover:bg-accent/40" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
							id: "editor",
							minSize: "32%",
							className: "min-h-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorColumn, {})
						}),
						chatOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(nn, { className: "w-px bg-border hover:bg-accent/40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qt, {
							id: "agent",
							defaultSize: "30%",
							minSize: "24%",
							maxSize: "46%",
							className: "min-h-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentPanel, { composerRef })
						})] })
					]
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative min-h-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-0 overflow-hidden",
						children: [
							mobilePane === "files" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileTree, {}),
							mobilePane === "editor" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorColumn, {}),
							mobilePane === "agent" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentPanel, { composerRef })
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "grid grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]",
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
							"Agent"
						]
					].map(([id, Icon, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setMobilePane(id),
						className: cn("flex h-12 flex-col items-center justify-center gap-0.5 text-[11px]", mobilePane === id ? "text-fg" : "text-subtle"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), label]
					}, id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBar, {
				aiLabel,
				account
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenProjectHost, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandPalette, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InlineEdit, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewFileDialog, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelpDialog, {})
		]
	});
}
function AppEditor() {
	const hydrate = useWorkspace((s) => s.hydrate);
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IdeShell, {});
}
//#endregion
export { AppEditor as component };
