/**
 * Aperture's MCP server: JSON-RPC over plain HTTP POST (the MCP "Streamable
 * HTTP" transport, answering with JSON and keeping no session), with one
 * tool, `check_change`.
 *
 * Pure: the route (`src/routes/api/mcp.ts`) signs the caller in and passes the
 * checker and the rate limit in, so tests drive this directly.
 */
import type { CheckRow } from "../workspace/checks.ts";

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

/** What `check_change` accepts, in total: the same bounds as an imported workspace. */
export const CHECK_LIMITS = {
  files: 160,
  fileChars: 200_000,
  totalChars: 2_500_000,
  pathChars: 240,
} as const;

export type CheckInput = {
  files: Record<string, string>;
  changes: Record<string, string>;
  summary: string;
};

export type ServerContext = {
  version: string;
  /** Runs the checks. */
  check: (input: CheckInput) => Promise<CheckRow[]>;
  /** A message when the caller is over its limit for checks, else null. Called once per tools/call. */
  busy: () => string | null;
};

type Id = string | number | null;
export type RpcResponse =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string } };

const INSTRUCTIONS =
  "Aperture checks a code change before it is applied: it parses the changed files, resolves their imports, " +
  "and type-checks the project with the TypeScript compiler, telling errors this change brings in from ones " +
  "that were already there. It also flags a change that skips, removes or cuts short the tests. It does not " +
  "run code: run the project's tests yourself. Call check_change with the project's files and the new text of " +
  "every file you changed, fix what a red check says, and call it again until nothing is red.";

const STRINGS = { type: "object", additionalProperties: { type: "string" } } as const;

export const CHECK_TOOL = {
  name: "check_change",
  title: "Check a change before applying it",
  description:
    "Checks a change to a JavaScript or TypeScript project the way the Aperture editor checks every staged " +
    "change: Parses, Imports resolve, Types (the real TypeScript compiler, new errors only) and whether the " +
    "change tampers with the tests. Nothing is executed and nothing is kept. Answers with each check's " +
    "result; a red check names the file, line and error. Tests and the page preview are not run.",
  inputSchema: {
    type: "object",
    properties: {
      files: {
        ...STRINGS,
        description:
          "The project as it is before the change: path → file text, paths relative to the project root. " +
          "Include package.json and tsconfig.json, and every file the change imports or is imported by; the " +
          `whole project is best. At most ${CHECK_LIMITS.files} files and ${CHECK_LIMITS.totalChars.toLocaleString("en-US")} characters with changes.`,
      },
      changes: {
        ...STRINGS,
        description:
          "The change: path → the file's complete new text. New files too. Deleting a file is not supported.",
      },
      summary: { type: "string", description: "Optional: what the change is meant to do." },
    },
    required: ["files", "changes"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["red", "clear"] },
      checks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            status: { type: "string", enum: ["pass", "fail", "warn", "skip"] },
            detail: { type: "string" },
            path: { type: "string" },
          },
          required: ["id", "label", "status", "detail"],
        },
      },
      notRun: { type: "array", items: { type: "string" } },
    },
    required: ["verdict", "checks", "notRun"],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const;

const NOT_RUN = ["tests: run the project's tests yourself", "page preview"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= CHECK_LIMITS.pathChars &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    !path.split("/").some((part) => part === ".." || part === "." || part === "")
  );
}

function stringMap(value: unknown, name: string): Record<string, string> | string {
  if (!isRecord(value)) return `${name} must be an object of path → file text.`;
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(value)) {
    if (!safePath(path))
      return `${name} has a path Aperture cannot use: ${JSON.stringify(path.slice(0, 80))}. Use paths relative to the project root.`;
    if (typeof text !== "string") return `${name}["${path}"] must be the file's text.`;
    if (text.length > CHECK_LIMITS.fileChars)
      return `${path} is over ${CHECK_LIMITS.fileChars.toLocaleString("en-US")} characters.`;
    out[path] = text;
  }
  return out;
}

/** The tool's arguments, checked, or what is wrong with them. */
export function readCheckInput(
  args: unknown,
): { ok: true; input: CheckInput } | { ok: false; error: string } {
  if (!isRecord(args)) return { ok: false, error: "check_change takes { files, changes }." };
  const files = stringMap(args.files ?? {}, "files");
  if (typeof files === "string") return { ok: false, error: files };
  const changes = stringMap(args.changes, "changes");
  if (typeof changes === "string") return { ok: false, error: changes };
  const changed = Object.keys(changes).filter((path) => changes[path] !== files[path]);
  if (changed.length === 0)
    return {
      ok: false,
      error: "changes has no file that differs from files, so there is nothing to check.",
    };
  const paths = new Set([...Object.keys(files), ...Object.keys(changes)]);
  if (paths.size > CHECK_LIMITS.files)
    return {
      ok: false,
      error: `That is ${paths.size} files; the limit is ${CHECK_LIMITS.files}. Send the files the change touches and the ones they import.`,
    };
  let total = 0;
  for (const text of [...Object.values(files), ...Object.values(changes)]) total += text.length;
  if (total > CHECK_LIMITS.totalChars)
    return {
      ok: false,
      error: `That is ${total.toLocaleString("en-US")} characters; the limit is ${CHECK_LIMITS.totalChars.toLocaleString("en-US")}.`,
    };
  const summary = typeof args.summary === "string" ? args.summary.slice(0, 500) : "";
  return { ok: true, input: { files, changes, summary } };
}

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };

/** The rows an agent gets: the preview never applies here, since nothing is rendered. */
export function reportedRows(rows: CheckRow[]): CheckRow[] {
  return rows.filter((row) => row.id !== "preview" && row.status !== "running");
}

/** The tool's answer: a text an agent reads, and the same as structured content. */
export function checkResult(rows: CheckRow[], changed: number) {
  const shown = reportedRows(rows);
  const red = shown.filter((row) => row.status === "fail");
  const head =
    red.length > 0
      ? `Do not apply this change as it is: ${red.length} check${red.length === 1 ? "" : "s"} red on ${changed} changed file${changed === 1 ? "" : "s"}. Fix what ${red.length === 1 ? "it says" : "they say"} and call check_change again.`
      : `Nothing red on ${changed} changed file${changed === 1 ? "" : "s"}. Tests and the page preview were not run here: run the project's tests before you apply the change.`;
  const lines = [head, ""];
  for (const row of shown) {
    lines.push(`${MARK[row.status] ?? "?"} ${row.label}: ${row.detail}`);
    if (row.status === "fail" && row.evidence)
      lines.push(row.evidence.slice(0, 4_000).replace(/^/gm, "    "));
  }
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: {
      verdict: red.length > 0 ? "red" : "clear",
      checks: shown.map((row) => ({
        id: row.id,
        label: row.label,
        status: row.status,
        detail: row.detail,
        ...(row.path ? { path: row.path } : {}),
      })),
      notRun: NOT_RUN,
    },
    isError: false,
  };
}

function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function reply(id: Id, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: Id, code: number, message: string): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Answers one JSON-RPC message. Null for a notification or a response, which
 * get no answer (the route sends 202).
 */
export async function handleMessage(
  message: unknown,
  ctx: ServerContext,
): Promise<RpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== "2.0")
    return failure(null, -32600, "Not a JSON-RPC 2.0 message.");
  const hasId =
    "id" in message && (typeof message.id === "string" || typeof message.id === "number");
  if (typeof message.method !== "string")
    return hasId ? failure(message.id as Id, -32600, "No method.") : null;
  if (!hasId) return null;
  const id = message.id as Id;
  const params = isRecord(message.params) ? message.params : {};

  switch (message.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (PROTOCOL_VERSIONS as readonly string[]).includes(asked)
        ? asked
        : PROTOCOL_VERSIONS[0];
      return reply(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "aperture", title: "Aperture", version: ctx.version },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: [CHECK_TOOL] });
    case "tools/call": {
      if (params.name !== CHECK_TOOL.name)
        return failure(id, -32602, `Unknown tool: ${String(params.name).slice(0, 80)}`);
      const busy = ctx.busy();
      if (busy) return reply(id, toolError(busy));
      const read = readCheckInput(params.arguments);
      if (!read.ok) return reply(id, toolError(read.error));
      const changed = Object.keys(read.input.changes).filter(
        (path) => read.input.changes[path] !== read.input.files[path],
      ).length;
      try {
        return reply(id, checkResult(await ctx.check(read.input), changed));
      } catch (error) {
        return reply(
          id,
          toolError(
            `The checks did not finish: ${error instanceof Error ? error.message : "unknown error"}`,
          ),
        );
      }
    }
    default:
      return failure(id, -32601, `Method not found: ${message.method.slice(0, 80)}`);
  }
}
