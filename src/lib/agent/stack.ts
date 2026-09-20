import { collectComponents, collectCssTokens } from "./ui-graph.ts";
import { findRules } from "../workspace/rules.ts";

export const STACK_START = "<!-- aperture:stack -->";
export const STACK_END = "<!-- /aperture:stack -->";

export type StackMemory = {
  name: string;
  runtime: string[];
  deps: string[];
  layout: string[];
  scripts: string[];
  components: string[];
  tokens: string[];
};

function parsePkg(files: Record<string, string>): {
  name?: string;
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} | null {
  const raw = files["package.json"];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReturnType<typeof parsePkg>;
  } catch {
    return null;
  }
}

export function extractStack(files: Record<string, string>, name?: string): StackMemory {
  const pkg = parsePkg(files);
  const paths = Object.keys(files);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const depNames = Object.keys(deps);
  const runtime: string[] = [];
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const blob = Object.values(files).join("\n");
  if (depNames.includes("react") || has(/\.tsx$/)) runtime.push("React");
  if (files["tsconfig.json"] || has(/\.tsx?$/)) runtime.push("TypeScript");
  if (has(/\.py$/)) runtime.push("Python");
  if (depNames.includes("next")) runtime.push("Next.js");
  if (blob.includes("node:http") || blob.includes("createServer(")) runtime.push("Node HTTP");
  if (has(/\.html?$/)) runtime.push("HTML");
  if (has(/\.css$/)) runtime.push("CSS");
  if (pkg?.type === "module") runtime.push("ESM");

  const dirs = [
    ...new Set(
      paths
        .map((p) => p.split("/")[0])
        .filter((top) => paths.some((p) => p.startsWith(`${top}/`)))
        .map((d) => `${d}/`),
    ),
  ].sort();
  const entries = [
    "src/index.ts",
    "src/index.tsx",
    "src/main.ts",
    "src/main.tsx",
    "src/router.ts",
    "src/store.ts",
    "index.html",
    "preview.html",
    "preview.css",
  ].filter((p) => files[p] !== undefined);

  return {
    name: (name || pkg?.name || "").trim(),
    runtime: [...new Set(runtime)].slice(0, 8),
    deps: depNames.filter((d) => !d.startsWith("@types/")).slice(0, 12),
    layout: [...dirs.slice(0, 8), ...entries.slice(0, 6)],
    scripts: Object.keys(pkg?.scripts ?? {}).slice(0, 8),
    components: collectComponents(files)
      .slice(0, 12)
      .map((c) => `${c.name} @ ${c.path}`),
    tokens: collectCssTokens(files).slice(0, 16),
  };
}

export function formatStackBody(stack: StackMemory): string {
  return [
    stack.name ? `- Project: ${stack.name}` : "",
    stack.runtime.length ? `- Runtime: ${stack.runtime.join(", ")}` : "",
    `- Deps: ${stack.deps.length ? stack.deps.join(", ") : "none"}`,
    stack.layout.length ? `- Layout: ${stack.layout.join(", ")}` : "",
    stack.scripts.length ? `- Scripts: ${stack.scripts.join(", ")}` : "",
    stack.components.length ? `- Components: ${stack.components.join("; ")}` : "",
    stack.tokens.length ? `- Tokens: ${stack.tokens.join(", ")}` : "",
    "- Reuse this stack. Do not invent a palette or add dependencies.",
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mergeStackSection(text: string, body: string): string {
  const block = `${STACK_START}\n${body.trim()}\n${STACK_END}`;
  if (text.includes(STACK_START) && text.includes(STACK_END)) {
    return text.replace(new RegExp(`${escapeRe(STACK_START)}[\\s\\S]*?${escapeRe(STACK_END)}`), block);
  }
  if (/^##\s+Stack\s*$/m.test(text)) {
    return text.replace(/^##\s+Stack\s*\n[\s\S]*?(?=\n##\s|\s*$)/m, `## Stack\n${block}\n`);
  }
  return `${text.trimEnd()}\n\n## Stack\n${block}\n`;
}

export function applyStackMemory(
  files: Record<string, string>,
  name?: string,
): Record<string, string> {
  const found = findRules(files);
  if (!found) return files;
  const next = mergeStackSection(found.text, formatStackBody(extractStack(files, name)));
  if (next === found.text) return files;
  return { ...files, [found.path]: next };
}

export function formatStackContext(files: Record<string, string>, name?: string): string {
  return `Stack memory (reuse; do not invent a palette or extra deps):\n${formatStackBody(extractStack(files, name))}`;
}
