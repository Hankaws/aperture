/**
 * Which files a change's type check reads: the changed TypeScript files and
 * the files that depend on them. Shared by the editor (tsc.ts) and the benchmark.
 */
import { collectImports, resolveSpecifier } from "./module-graph.ts";
import { isTsPath } from "./tsc-core.ts";

/** A change to a widely used file still checks only this many of the files that depend on it. */
const MAX_IMPORTERS = 40;

/**
 * The changed TypeScript files and what depends on them, nearest first: files
 * that import or re-export a changed file, then the files that import those,
 * and so on. A caller can break two steps away, through an `index.ts` that
 * re-exports the changed file or a type inferred from it.
 */
export function pathsToCheck(after: Record<string, string>, changed: string[]): string[] {
  const targets = changed.filter((path) => isTsPath(path) && after[path] !== undefined);
  const reached = new Set(targets);
  // Who imports whom, read once: file → the files it imports.
  const imports = new Map<string, string[]>();
  for (const [path, text] of Object.entries(after)) {
    if (!isTsPath(path)) continue;
    const hits = collectImports(path, text)
      .map((ref) => resolveSpecifier(path, ref.spec, after))
      .flatMap((hit) => (hit.kind === "file" ? [hit.path] : []));
    imports.set(path, hits);
  }
  const importers: string[] = [];
  let frontier = new Set(targets);
  while (frontier.size > 0 && importers.length < MAX_IMPORTERS) {
    const next = new Set<string>();
    for (const [path, hits] of imports) {
      if (reached.has(path) || importers.length >= MAX_IMPORTERS) continue;
      if (hits.some((hit) => frontier.has(hit))) {
        reached.add(path);
        importers.push(path);
        next.add(path);
      }
    }
    frontier = next;
  }
  return [...targets, ...importers];
}
