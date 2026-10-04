/**
 * Rules for some files only: `.aperture/rules/*.md`. A rule names the files it
 * is for in front matter, and Composer reads it only when a turn touches one
 * of them, so test conventions do not crowd a CSS change.
 *
 *   ---
 *   files: "**\/*.test.ts, **\/*.spec.ts"
 *   ---
 *   Use node:test and assert/strict. One behaviour per test.
 *
 * `globs` (Cursor's key) works too. A rule with no files, or `alwaysApply:
 * true`, is for every turn. A pattern without a slash matches the file name
 * anywhere in the tree, as in .gitignore.
 */
import { globToRegExp } from "../runner/plan.ts";

export const RULES_DIR = ".aperture/rules/";

/** Per rule, and for all the rules in one prompt. Rules are instructions, not documentation. */
export const RULE_LIMIT = { chars: 2000, total: 6000, rules: 24 } as const;

export const RULE_TEMPLATE = `---
files: "**/*.test.ts, **/*.spec.ts"
description: How tests are written here
---
- One behaviour per test, named for what it checks.
- Test through the public function, not its internals.
`;

export type ScopedRule = {
  path: string;
  /** Empty: the rule is for every turn. */
  globs: string[];
  description: string;
  text: string;
};

export function isRulePath(path: string): boolean {
  return (
    path.startsWith(RULES_DIR) &&
    /\.mdc?$/i.test(path) &&
    !path.slice(RULES_DIR.length).includes("/")
  );
}

function unquote(value: string): string {
  return value
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();
}

/** `a, b`, `"a, b"`, `"a", "b"` and `[a, "b"]` all name the same two patterns. */
function splitGlobs(value: string): string[] {
  let inner = value
    .trim()
    .replace(/^\[(.*)\]$/, "$1")
    .trim();
  // One quoted string holding the whole list.
  const whole = /^(["'])([^"']*)\1$/.exec(inner);
  if (whole) inner = whole[2]!;
  return (inner.match(/"[^"]*"|'[^']*'|[^,]+/g) ?? []).map(unquote).filter(Boolean);
}

/** Front matter, then the rule. A file without front matter is a rule for every turn. */
export function parseRule(path: string, raw: string): ScopedRule | null {
  const text = raw.replace(/\r\n/g, "\n");
  const front = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  const body = (front ? text.slice(front[0].length) : text).trim();
  if (!body) return null;
  const globs: string[] = [];
  let description = "";
  let always = false;
  if (front) {
    const lines = front[1]!.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = /^([A-Za-z]+)\s*:\s*(.*)$/.exec(lines[i]!);
      if (!match) continue;
      const key = match[1]!.toLowerCase();
      const value = match[2]!;
      if (key === "files" || key === "globs") {
        if (value.trim()) globs.push(...splitGlobs(value));
        // A YAML list on the lines below.
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1]!)) {
          globs.push(unquote(lines[i + 1]!.replace(/^\s*-\s+/, "")));
          i += 1;
        }
      } else if (key === "description") {
        description = unquote(value);
      } else if (key === "alwaysapply") {
        always = unquote(value) === "true";
      }
    }
  }
  return {
    path,
    globs: always ? [] : [...new Set(globs.filter(Boolean))],
    description,
    text:
      body.length > RULE_LIMIT.chars
        ? `${body.slice(0, RULE_LIMIT.chars)}\n… (rule cut at ${RULE_LIMIT.chars} characters)`
        : body,
  };
}

/** Every rule in `.aperture/rules/`, by file name. */
export function scopedRules(files: Record<string, string>): ScopedRule[] {
  return Object.keys(files)
    .filter(isRulePath)
    .sort()
    .slice(0, RULE_LIMIT.rules)
    .map((path) => parseRule(path, files[path] ?? ""))
    .filter((rule): rule is ScopedRule => rule !== null);
}

const compiled = new Map<string, RegExp>();

export function globMatches(glob: string, path: string): boolean {
  const clean = glob.replace(/^\.?\//, "");
  if (!clean) return false;
  let re = compiled.get(clean);
  if (!re) {
    re = globToRegExp(clean.endsWith("/") ? `${clean}**` : clean);
    compiled.set(clean, re);
  }
  if (re.test(path)) return true;
  // No slash: the name anywhere in the tree, like .gitignore.
  return !clean.includes("/") && re.test(path.split("/").pop() ?? path);
}

/** The first path a rule is for, or null. A rule for every turn matches without a path. */
export function ruleMatch(rule: ScopedRule, paths: string[]): string | null {
  for (const path of paths) {
    if (rule.globs.some((glob) => globMatches(glob, path))) return path;
  }
  return null;
}

/** Rules for every turn, and the rules for any of these files. */
export function rulesForPaths(
  rules: ScopedRule[],
  paths: string[],
): Array<{ rule: ScopedRule; matched: string | null }> {
  const out: Array<{ rule: ScopedRule; matched: string | null }> = [];
  for (const rule of rules) {
    if (rule.globs.length === 0) {
      out.push({ rule, matched: null });
      continue;
    }
    const matched = ruleMatch(rule, paths);
    if (matched) out.push({ rule, matched });
  }
  return out;
}

function ruleBlock(rule: ScopedRule, matched: string | null): string {
  const scope = matched ? `for ${rule.globs.join(", ")}; ${matched} matches` : "for every change";
  return `### ${rule.path} (${scope})\n${rule.text}`;
}

/**
 * Hands rules to the agent once each, within the budget: the rules the turn
 * starts with, then any a file it reads or edits later brings in.
 */
export class RuleLoader {
  readonly rules: ScopedRule[];
  readonly loaded: string[] = [];
  private used = 0;

  constructor(files: Record<string, string>) {
    this.rules = scopedRules(files);
  }

  private take(found: Array<{ rule: ScopedRule; matched: string | null }>): string[] {
    const blocks: string[] = [];
    for (const { rule, matched } of found) {
      if (this.loaded.includes(rule.path)) continue;
      const block = ruleBlock(rule, matched);
      if (this.used + block.length > RULE_LIMIT.total) continue;
      this.used += block.length;
      this.loaded.push(rule.path);
      blocks.push(block);
    }
    return blocks;
  }

  /** For the system prompt: rules for every turn, and those for the files the turn starts on. */
  initial(paths: string[]): string {
    const blocks = this.take(rulesForPaths(this.rules, paths));
    return blocks.length === 0
      ? ""
      : `Project rules for the files in this task. Follow them:\n\n${blocks.join("\n\n")}`;
  }

  /** Appended to a tool result when the agent reaches a file a rule not yet loaded is for. */
  forPath(path: string, after: "read" | "edit"): string {
    const blocks = this.take(
      rulesForPaths(
        this.rules.filter((rule) => rule.globs.length > 0),
        [path],
      ),
    );
    if (blocks.length === 0) return "";
    const lead =
      after === "edit"
        ? `A project rule applies to ${path}. Check the edit you just staged follows it; if not, fix it with propose_edit.`
        : `A project rule applies to ${path}. Follow it in any edit to this file.`;
    return `\n\n${lead}\n\n${blocks.join("\n\n")}`;
  }
}
