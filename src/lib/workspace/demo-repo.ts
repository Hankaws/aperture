export const DEMO_WORKSPACE_NAME = "harbor-api";

export const DEMO_FILES: Record<string, string> = {
  ".aperture.md": `# Project rules

- This is harbor-api, a tiny in-memory task HTTP API.
- Prefer the smallest unique search/replace. Do not rewrite files unless asked.
- Match the existing style. Cite path:line when you explain.
- Known bugs to fix if asked: listTasks off-by-one, getTask 200+null, missing title length check.
- Do not add dependencies unless the user asks.
`,

  ".aperture/hooks.json": `{
  "hooks": [
    {
      "name": "Store contract",
      "run": "check:store",
      "files": ["src/**"],
      "on": ["save", "stage"]
    }
  ]
}
`,

  ".aperture/rules/store.md": `---
files: src/store.ts
description: The task store
---
- The store is the only module that changes tasks. Routes call it; they never edit a task themselves.
- No HTTP here: no status codes, no HttpError. Return null for a task that does not exist and let the route answer 404.
`,

  ".aperture/rules/tests.md": `---
files: tests/**
description: How the tests are written
---
- Vitest, imported from "vitest". One behaviour per it(), named for what it checks.
- Test through the store and the routes, never their internals.
`,

  "scripts/check-store.ts": `// The store's contract, run on save and on every staged change (.aperture/hooks.json).
import { countTasks, listTasks } from "../src/store.ts";

const total = countTasks();
const pageSize = 2;
const seen = new Set<string>();
for (let page = 0; page * pageSize < total; page++) {
  const items = listTasks(page, pageSize);
  if (items.length > pageSize) throw new Error(\`listTasks(\${page}, \${pageSize}) returned \${items.length} tasks\`);
  for (const task of items) {
    if (seen.has(task.id)) throw new Error(\`listTasks returned \${task.id} on two pages\`);
    seen.add(task.id);
  }
}
console.log(\`Store contract holds: \${seen.size} of \${total} tasks paged.\`);
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

Each has a failing test in \`tests/\`. \`npm test\` runs them with Vitest.

Ask Composer to fix any of them, or press the inline edit shortcut on a selection.
`,

  "package.json": `{
  "name": "harbor-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node --experimental-strip-types src/index.ts",
    "test": "vitest run",
    "check:store": "node --experimental-strip-types scripts/check-store.ts"
  },
  "devDependencies": {
    "vitest": "^3.2.0"
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

  "tests/store.test.ts": `import { describe, expect, it } from "vitest";
import { createTask, getTask, listTasks } from "../src/store.ts";

describe("store", () => {
  it("starts page 0 at the first task", () => {
    expect(listTasks(0, 2).map((task) => task.id)).toEqual(["tsk_100", "tsk_101"]);
  });

  it("finds a task it just created", () => {
    const created = createTask("Write embeddings");
    expect(created.title).toBe("Write embeddings");
    expect(getTask(created.id)?.id).toBe(created.id);
  });
});
`,

  "tests/tasks.test.ts": `import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/router.ts";

function request(method: string, pathname: string, body: unknown = undefined) {
  return handleRequest({
    method,
    pathname,
    search: new URLSearchParams(),
    body: body === undefined ? "" : JSON.stringify(body),
  });
}

describe("GET /tasks/:id", () => {
  it("returns a task that exists", async () => {
    const res = await request("GET", "/tasks/tsk_100");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "tsk_100" });
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request("GET", "/tasks/tsk_missing");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "not_found" });
  });
});

describe("POST /tasks", () => {
  it("creates a task", async () => {
    const res = await request("POST", "/tasks", { title: "Ship the demo" });
    expect(res.status).toBe(201);
  });

  it("rejects a title longer than 80 characters", async () => {
    const res = await request("POST", "/tasks", { title: "x".repeat(81) });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "invalid_title" });
  });
});
`,
};
