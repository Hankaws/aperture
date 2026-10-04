/**
 * Which files a change's type check reads: the changed TypeScript files and
 * the files that import them. Shared by the editor (tsc.ts) and the benchmark.
 */
import { collectImports, resolveSpecifier } from "./module-graph.ts";
import { isTsPath } from "./tsc-core.ts";

/** A change to a widely used file still checks only this many of the files that import it. */
const MAX_IMPORTERS = 40;

/** The changed TypeScript files and the files that import them: what a change can break. */
export function pathsToCheck(after: Record<string, string>, changed: string[]): string[] {
  const targets = new Set(changed.filter((path) => isTsPath(path) && after[path] !== undefined));
  const importers: string[] = [];
  for (const [path, text] of Object.entries(after)) {
    if (targets.has(path) || !isTsPath(path) || importers.length >= MAX_IMPORTERS) continue;
    const imports = collectImports(path, text);
    if (imports.some((ref) => {
      const hit = resolveSpecifier(path, ref.spec, after);
      return hit.kind === "file" && targets.has(hit.path);
    })) {
      importers.push(path);
    }
  }
  return [...targets, ...importers];
}

