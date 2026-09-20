import { EDITOR } from "../editor/theme.ts";

const UI_HINT =
  /\b(ui|css|html|layout|button|color|theme|preview|design|spacing|font|header|sidebar|panel|style|palette|tab|modal|dialog|chrome)\b/i;

export function isUiTask(instruction: string): boolean {
  return UI_HINT.test(instruction) || /preview\.(html|css)/i.test(instruction);
}

export function collectCssTokens(files: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(css|html?|tsx|jsx)$/i.test(path)) continue;
    for (const match of content.matchAll(/--([a-zA-Z][\w-]*)\s*:/g)) out.add(`--${match[1]}`);
    for (const match of content.matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      out.add(match[0].toLowerCase());
    }
  }
  return [...out].slice(0, 24);
}

export function collectClassNames(files: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const [path, content] of Object.entries(files)) {
    if (/\.css$/i.test(path)) {
      for (const match of content.matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(match[1]!);
    }
    for (const match of content.matchAll(/class(?:Name)?=["'`]([^"'`]+)["'`]/g)) {
      for (const name of match[1]!.split(/\s+/)) {
        if (/^[a-zA-Z][\w-]*$/.test(name)) out.add(name);
      }
    }
  }
  return [...out].slice(0, 40);
}

export function collectComponents(files: Record<string, string>): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = [];
  for (const [path, content] of Object.entries(files)) {
    if (/\.html?$/i.test(path)) {
      out.push({ path, name: path.split("/").pop() ?? path });
      continue;
    }
    if (!/\.(t|j)sx?$/.test(path)) continue;
    for (const match of content.matchAll(
      /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9]+)/g,
    )) {
      out.push({ path, name: match[1]! });
    }
  }
  return out.slice(0, 24);
}

export function nearestUiFiles(
  files: Record<string, string>,
  query: string,
  activePath: string | null,
  n = 3,
): string[] {
  const q = query.toLowerCase();
  const comps = collectComponents(files);
  const dir = activePath ? activePath.split("/").slice(0, -1).join("/") : "";
  const scored = Object.keys(files)
    .filter((path) => /\.(html?|css|tsx|jsx)$/i.test(path))
    .map((path) => {
      let score = 0;
      const base = path.toLowerCase();
      if (path === activePath) score += 5;
      if (dir && path.startsWith(`${dir}/`)) score += 2;
      if (/\.html?$/i.test(path)) score += 2;
      if (/\.css$/i.test(path)) score += 1;
      const stem = (path.split("/").pop() ?? "").replace(/\.\w+$/, "");
      if (q.includes(stem.toLowerCase())) score += 4;
      for (const comp of comps) {
        if (comp.path === path && q.includes(comp.name.toLowerCase())) score += 5;
      }
      return { path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const out: string[] = [];
  for (const row of scored) {
    if (row.score <= 0 && out.length >= n) continue;
    if (!out.includes(row.path)) out.push(row.path);
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

const HOST_TOKENS = [
  `bg ${EDITOR.bg}`,
  `fg ${EDITOR.fg}`,
  `surface ${EDITOR.surface}`,
  `border ${EDITOR.border}`,
  `accent ${EDITOR.accent}`,
  `ok ${EDITOR.ok}`,
  `danger ${EDITOR.danger}`,
  `muted ${EDITOR.muted}`,
];

export function formatUiGraph(
  files: Record<string, string>,
  instruction: string,
  activePath: string | null,
): string {
  if (!isUiTask(instruction)) return "";
  const tokens = collectCssTokens(files);
  const classes = collectClassNames(files);
  const nearest = nearestUiFiles(files, instruction, activePath, 3);
  const comps = collectComponents(files)
    .filter((row) => nearest.includes(row.path))
    .slice(0, 8);
  return [
    "UI context (reuse these; do not invent a palette or new chrome classes):",
    `Host tokens: ${HOST_TOKENS.join(", ")}`,
    "Host chrome: Button TabBar classes bg-bg text-fg border-border bg-elevated text-subtle bg-accent",
    tokens.length ? `Repo tokens: ${tokens.join(", ")}` : "",
    classes.length ? `Repo classes: ${classes.slice(0, 24).join(", ")}` : "",
    comps.length ? `Components: ${comps.map((c) => `${c.name} @ ${c.path}`).join("; ")}` : "",
    nearest.length ? `Nearest UI files: ${nearest.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
