import { chunkSource } from "../parser/chunk.ts";

const SKIP = /(^|\/)(node_modules|dist|build|\.git)\//i;
const LOCK = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;

/**
 * One line per file: the symbols in it, not the source.
 * The agent reads this before it opens a file, the way Aider uses a repo map.
 */
export function repoMap(files: Record<string, string>, maxChars = 5000): string {
  const lines: string[] = [];
  let used = 0;
  const paths = Object.keys(files).sort();
  for (const path of paths) {
    if (SKIP.test(`/${path}`) || LOCK.test(path)) continue;
    const source = files[path];
    if (source === undefined || source.length > 200_000) continue;
    const symbols = chunkSource(path, source)
      .filter((chunk) => chunk.kind !== "block" && chunk.kind !== "module")
      .slice(0, 12)
      .map((chunk) => `${chunk.name}:${chunk.startLine}`);
    const line = symbols.length > 0 ? `${path} — ${symbols.join(", ")}` : path;
    if (used + line.length + 1 > maxChars) {
      lines.push("… map truncated");
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}
