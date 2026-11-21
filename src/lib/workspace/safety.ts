/**
 * What a change does that the other checks cannot see: a key written into the
 * code, a check switched off so it stops complaining, a new package to trust,
 * the CI that judges the change edited by the change.
 *
 * Read from the staged change itself, before against after, so a file that
 * already had a `@ts-ignore` or a dependency is not blamed for it. Two levels:
 *
 * - `red`: a key or token in what was added, a `.env` file with values, or a
 *   check turned off (`@ts-nocheck`, `strict` loosened, a lint or typecheck
 *   script that no longer checks). Holds Apply, and goes back to the agent.
 * - `look`: worth a person's eye, not wrong by itself: a new dependency, one
 *   installed from a URL, an install script, an edited CI workflow, a lockfile
 *   that moved with no dependency change, a new `@ts-ignore` or
 *   `eslint-disable`.
 *
 * A key is never repeated in what this says: only its kind and where it is.
 * Pure: tests import it directly.
 */

type Edit = { path: string; newText: string; deleted?: boolean };

export type SafetyFinding = {
  level: "red" | "look";
  path: string;
  /** One line, a person's words: what the change does here. */
  what: string;
  /** 1-based, in the staged text, when there is one line to point at. */
  line?: number;
};

/** Known key formats, by who issues them. Each is specific enough that a match is almost never anything else. */
const KEYS: Array<[string, RegExp]> = [
  [
    "a private key",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
  ],
  ["an AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ["an xAI key", /\bxai-[A-Za-z0-9]{40,}\b/],
  ["an Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{32,}/],
  ["an OpenAI key", /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/],
  ["a Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["a Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  [
    "a Slack webhook",
    /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/,
  ],
  ["a Stripe live key", /\b[rs]k_live_[A-Za-z0-9]{20,}\b/],
];

/** A database address with its password in it. A local one is a development default; anywhere else, worth a look. */
const DB_URL =
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:/@"'`]+:[^\s@/"'`$]{6,}@([^\s/:"'`?]+)/;
const LOCAL_HOST =
  /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|db|postgres|mysql|mongo|redis|host\.docker\.internal)$/i;

/** `apiKey = "…"`, `"secret": "…"`: a name that says secret and a long literal value. Looked at, not held: names lie. */
const NAMED =
  /\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|password|passwd|client[_-]?secret)\b["']?\s*[:=]\s*["'`]([^"'`\s]{16,})["'`]/i;

/** Docs, tests and templates are full of these, on purpose. */
const PLACEHOLDER =
  /example|sample|dummy|fake|placeholder|changeme|your[_-]|xxxx|0000000|\*\*\*|<[^>]*>|\$\{|process\.env|import\.meta\.env/i;

const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/;
const ENV_TEMPLATE = /\.(example|sample|template|dist|defaults)$/i;

const CI_FILE =
  /^(?:\.github\/workflows\/[^/]+\.ya?ml|\.github\/actions\/.+|\.gitlab-ci\.ya?ml|\.circleci\/.+|azure-pipelines\.ya?ml|Jenkinsfile|bitbucket-pipelines\.ya?ml|\.buildkite\/.+)$/;
const LOCKFILE =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;
const TSCONFIG = /(^|\/)[jt]sconfig(\.[\w-]+)?\.json$/;
const PACKAGE = /(^|\/)package\.json$/;

const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"] as const;
/** Scripts that check the code: emptied, they report green on anything. */
const CHECK_SCRIPTS = /^(?:lint|typecheck|type-check|types|check|tsc|verify)(?::.*)?$/;
const NO_OP = /^\s*(?:true|:|exit 0|echo\b.*)?\s*$/;
/** Installed from somewhere other than the registry: anyone who controls that place controls the code. */
const FROM_URL =
  /^(?:https?:|git(?:\+[a-z]+)?:|github:|gitlab:|bitbucket:|file:|link:)|^[\w.-]+\/[\w.-]+(?:#.*)?$/i;

/**
 * The directives as TypeScript and ESLint read them, in a comment that starts
 * a line (or a block comment for ESLint): the words in prose or in a string
 * switch nothing off.
 */
const NOCHECK = /^[ \t]*\/\/[ \t]*@ts-nocheck\b/m;
const IGNORE = /^[ \t]*\/\/[ \t]*@ts-(?:ignore|expect-error)\b/m;
const LINT_OFF =
  /^[ \t]*(?:\/\/|\/\*)[ \t]*eslint-disable(?:-next-line|-line)?\b|\{\/\*[ \t]*eslint-disable/m;

const STRICT_FLAGS = ["strict", "noImplicitAny", "strictNullChecks", "checkJs"] as const;

function json(text: string | undefined): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text ?? "");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** tsconfig allows comments and trailing commas; strip them before JSON.parse. Strings are kept whole. */
function jsonc(text: string | undefined): Record<string, unknown> | null {
  if (text === undefined) return null;
  const stripped = text
    .replace(
      /("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      (_, str: string | undefined) => str ?? "",
    )
    .replace(/,(\s*[}\]])/g, "$1");
  return json(stripped);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The lines `after` has that `before` did not, counted, with their line numbers in `after`. */
function addedLines(before: string, after: string): Array<{ text: string; line: number }> {
  const left = new Map<string, number>();
  for (const line of before.split("\n")) left.set(line, (left.get(line) ?? 0) + 1);
  const out: Array<{ text: string; line: number }> = [];
  after.split("\n").forEach((text, i) => {
    const n = left.get(text) ?? 0;
    if (n > 0) left.set(text, n - 1);
    else out.push({ text, line: i + 1 });
  });
  return out;
}

function count(re: RegExp, text: string): number {
  return (
    text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`)) ?? []
  ).length;
}

function names(list: string[], max = 4): string {
  const shown = list.slice(0, max).join(", ");
  return list.length > max ? `${shown} and ${list.length - max} more` : shown;
}

function keysIn(path: string, before: string, after: string): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  for (const { text, line } of addedLines(before, after)) {
    const known = KEYS.find(([, re]) => {
      const match = re.exec(text);
      return match !== null && !PLACEHOLDER.test(match[0]);
    });
    if (known) {
      out.push({ level: "red", path, line, what: `adds ${known[0]} at line ${line}` });
      continue;
    }
    const db = DB_URL.exec(text);
    if (db && !LOCAL_HOST.test(db[1]!) && !PLACEHOLDER.test(db[0])) {
      out.push({
        level: "look",
        path,
        line,
        what: `writes a database address with its password at line ${line}`,
      });
      continue;
    }
    const named = NAMED.exec(text);
    if (named && !PLACEHOLDER.test(named[1]!) && /[a-z]/i.test(named[1]!) && /\d/.test(named[1]!))
      out.push({
        level: "look",
        path,
        line,
        what: `puts what looks like a secret in the code at line ${line}`,
      });
  }
  return out;
}

function envFile(path: string, before: string | undefined, after: string): SafetyFinding[] {
  if (!ENV_FILE.test(path) || ENV_TEMPLATE.test(path)) return [];
  const valued = (text: string | undefined) =>
    (text ?? "").split("\n").filter((l) => /^\s*(?:export\s+)?[A-Za-z_][\w.]*\s*=\s*\S/.test(l))
      .length;
  if (valued(after) <= valued(before)) return [];
  return [
    {
      level: "red",
      path,
      what: "writes values into a .env file, which belongs out of the repository",
    },
  ];
}

function silenced(path: string, before: string, after: string): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  if (/\.[cm]?[jt]sx?$/i.test(path)) {
    if (count(NOCHECK, after) > count(NOCHECK, before))
      out.push({
        level: "red",
        path,
        what: "turns type checking off for the whole file (@ts-nocheck)",
      });
    const ignores = count(IGNORE, after) - count(IGNORE, before);
    if (ignores > 0)
      out.push({
        level: "look",
        path,
        what: `hides ${ignores === 1 ? "a type error" : `${ignores} type errors`} (@ts-ignore)`,
      });
    const lint = count(LINT_OFF, after) - count(LINT_OFF, before);
    if (lint > 0)
      out.push({
        level: "look",
        path,
        what: `turns lint rules off (eslint-disable${lint > 1 ? `, ${lint} times` : ""})`,
      });
  }
  if (TSCONFIG.test(path)) {
    const was = record(jsonc(before)?.compilerOptions);
    const now = record(jsonc(after)?.compilerOptions);
    const loosened = STRICT_FLAGS.filter((flag) => was[flag] === true && now[flag] !== true);
    if (loosened.length > 0)
      out.push({
        level: "red",
        path,
        what: `loosens type checking (${loosened.join(", ")} no longer on)`,
      });
  }
  return out;
}

function packageChanges(
  path: string,
  before: string | undefined,
  after: string,
): { findings: SafetyFinding[]; deps: boolean } {
  const was = json(before);
  const now = json(after);
  if (!now) return { findings: [], deps: false };
  const findings: SafetyFinding[] = [];
  const added: string[] = [];
  const fromUrl: string[] = [];
  let deps = false;
  for (const field of DEP_FIELDS) {
    const a = record(was?.[field]);
    const b = record(now[field]);
    for (const [name, spec] of Object.entries(b)) {
      if (a[name] !== spec) deps = true;
      if (!(name in a)) added.push(name);
      if (typeof spec === "string" && FROM_URL.test(spec) && a[name] !== spec) fromUrl.push(name);
    }
    if (Object.keys(a).some((name) => !(name in b))) deps = true;
  }
  if (added.length > 0)
    findings.push({
      level: "look",
      path,
      what: `adds ${added.length === 1 ? "a dependency" : `${added.length} dependencies`}: ${names(added)} (check ${added.length === 1 ? "it is" : "they are"} the package${added.length === 1 ? "" : "s"} you meant)`,
    });
  if (fromUrl.length > 0)
    findings.push({
      level: "look",
      path,
      what: `installs ${names(fromUrl)} from a URL or repository, not the registry`,
    });
  const scriptsWas = record(was?.scripts);
  const scriptsNow = record(now.scripts);
  const install = INSTALL_SCRIPTS.filter(
    (s) => typeof scriptsNow[s] === "string" && scriptsNow[s] !== scriptsWas[s],
  );
  if (install.length > 0)
    findings.push({
      level: "look",
      path,
      what: `adds or changes a script that runs on install (${install.join(", ")})`,
    });
  const emptied = Object.keys(scriptsWas).filter(
    (name) =>
      CHECK_SCRIPTS.test(name) &&
      typeof scriptsWas[name] === "string" &&
      !NO_OP.test(scriptsWas[name] as string) &&
      (scriptsNow[name] === undefined ||
        (typeof scriptsNow[name] === "string" && NO_OP.test(scriptsNow[name] as string))),
  );
  if (emptied.length > 0)
    findings.push({
      level: "red",
      path,
      what: `stops the ${names(emptied)} script${emptied.length === 1 ? "" : "s"} from checking anything`,
    });
  return { findings, deps };
}

/** Everything worth saying about a change, red first, in the order of the files. */
export function safetyFindings(files: Record<string, string>, edits: Edit[]): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  let depsMoved = false;
  const lockfiles: string[] = [];
  const ci: string[] = [];
  for (const edit of edits) {
    if (edit.deleted) continue;
    const before = files[edit.path];
    const after = edit.newText;
    if (before === after) continue;
    out.push(...keysIn(edit.path, before ?? "", after));
    out.push(...envFile(edit.path, before, after));
    out.push(...silenced(edit.path, before ?? "", after));
    if (PACKAGE.test(edit.path)) {
      const pkg = packageChanges(edit.path, before, after);
      out.push(...pkg.findings);
      depsMoved ||= pkg.deps;
    }
    if (LOCKFILE.test(edit.path)) lockfiles.push(edit.path);
    if (CI_FILE.test(edit.path)) ci.push(edit.path);
  }
  for (const edit of edits) if (edit.deleted && CI_FILE.test(edit.path)) ci.push(edit.path);
  if (ci.length > 0)
    out.push({
      level: "look",
      path: ci[0]!,
      what: `edits the CI that checks your pull requests (${names(ci)})`,
    });
  if (lockfiles.length > 0 && !depsMoved)
    out.push({
      level: "look",
      path: lockfiles[0]!,
      what: `changes ${names(lockfiles)} with no dependency change in package.json`,
    });
  return [...out.filter((f) => f.level === "red"), ...out.filter((f) => f.level === "look")];
}
