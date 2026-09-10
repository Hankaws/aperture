export const RULE_CANDIDATES = [
  ".aperture.md",
  "APERTURE.md",
  ".cursorrules",
  "AGENTS.md",
  ".cursor/rules.md",
] as const;

export const DEFAULT_RULES = `# Project rules

- Prefer the smallest unique search/replace. Do not rewrite files unless asked.
- Match the existing style. Cite path:line when you explain.
- Do not add dependencies unless the user asks.
`;

export function findRules(files: Record<string, string>): { path: string; text: string } | null {
  for (const path of RULE_CANDIDATES) {
    const text = files[path]?.trim();
    if (text) return { path, text };
  }
  return null;
}
