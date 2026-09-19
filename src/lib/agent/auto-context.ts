/** Windsurf-style: last viewed files and open tabs ride along without @. */
export function autoContextPaths(input: {
  activePath: string | null;
  openTabs: string[];
  recentPaths: string[];
  mentioned?: string[];
  extra?: string[];
}): string[] {
  const skip = new Set(input.mentioned ?? []);
  const out: string[] = [];
  const add = (path: string | null | undefined) => {
    if (!path || skip.has(path) || out.includes(path)) return;
    out.push(path);
  };
  add(input.activePath);
  for (const path of input.recentPaths.slice(0, 3)) add(path);
  for (const path of input.openTabs) add(path);
  for (const path of input.extra ?? []) add(path);
  return out.slice(0, 6);
}

export function formatAutoContext(paths: string[], files: Record<string, string>, clip = 2400): string {
  const blocks = paths
    .filter((path) => files[path] !== undefined)
    .map((path) => `### ${path}\n${files[path]!.slice(0, clip)}`);
  if (blocks.length === 0) return "";
  return `Auto-context (open tabs and recently viewed):\n${blocks.join("\n\n")}`;
}
