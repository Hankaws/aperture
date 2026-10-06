/**
 * Edits that make the tests pass without the code being right: deleting or
 * skipping tests, focusing a few with `.only`, exiting before they finish, or
 * rewriting the test script. Read from the staged change itself, so it holds
 * for the agent's own sandbox run (a real Node, where `process.exit(0)` does
 * end the run green) as well as the run in the browser tab.
 *
 * Counted per file, before against after, so a test file that already skipped
 * something is not blamed for it. Pure: tests import it directly.
 */

type Edit = { path: string; newText: string };

const TEST_FILE = /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/i;
const TEST_SETUP =
  /(^|\/)(vitest|jest)\.(config|setup)\.[cm]?[jt]s$|(^|\/)setup(Tests?)?\.[cm]?[jt]s$/i;

/** A declared test, skipped or not: `test(`, `it.each(…)(`, `t.test(`, `xit(`. */
const DECLARED = /\b(?:it|test)\s*(?:\.\s*\w+\s*)*\(|\bx(?:it|test)\s*\(/g;
const SKIPPED =
  /\b(?:it|test|describe|suite)\s*\.\s*(?:skip|todo)\b|\bx(?:it|test|describe)\s*\(|\b(?:skip|todo)\s*:\s*true|\b(?:t|ctx|context)\s*\.\s*skip\s*\(/g;
const FOCUSED =
  /\b(?:it|test|describe|suite)\s*\.\s*only\b|\bf(?:it|describe)\s*\(|\bonly\s*:\s*true/g;
const EXITS = /\bprocess\s*\.\s*(?:exit\s*\(|exitCode\s*=|kill\s*\(\s*process\s*\.\s*pid)/g;
/** Outside test files only a clean exit is suspect: it ends a real Node test run early, green. */
const CLEAN_EXIT = /\bprocess\s*\.\s*exit\s*\(\s*0?\s*\)/g;
const SCRIPT = /\.[cm]?[jt]sx?$/i;

export function isTestPath(path: string): boolean {
  return TEST_FILE.test(path) || TEST_SETUP.test(path);
}

/** Comments out, so a commented-out `test(` is not a test. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function count(re: RegExp, text: string): number {
  return (code(text).match(re) ?? []).length;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * A program's own entry points: the files package.json lists under `bin`, and
 * anything in a `bin/` folder. Their exit code is theirs to choose, and tests
 * import modules, not executables, so a clean exit there cuts no run short.
 */
function executables(files: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const [path, text] of Object.entries(files)) {
    if (path !== "package.json" && !path.endsWith("/package.json")) continue;
    const dir = path.slice(0, path.length - "package.json".length);
    try {
      const bin = (JSON.parse(text) as { bin?: unknown }).bin;
      const targets =
        typeof bin === "string" ? [bin] : bin && typeof bin === "object" ? Object.values(bin) : [];
      for (const target of targets)
        if (typeof target === "string") out.add(`${dir}${target.replace(/^\.\//, "")}`);
    } catch {
      // Not JSON yet: nothing to read.
    }
  }
  return out;
}

function testScript(text: string | undefined): string | null {
  try {
    const script = (JSON.parse(text ?? "") as { scripts?: Record<string, unknown> }).scripts?.test;
    return typeof script === "string" ? script : null;
  } catch {
    return null;
  }
}

/** What the change does to the tests, one clause each ("skips 1 test in tests/a.test.ts"); empty when nothing. */
export function testTampering(files: Record<string, string>, edits: Edit[]): string[] {
  const found: string[] = [];
  const entryPoints = executables(files);
  for (const { path, newText } of edits) {
    const before = files[path] ?? "";
    if (path === "package.json" || path.endsWith("/package.json")) {
      const was = testScript(before);
      const now = testScript(newText);
      if (was !== null && now !== was)
        found.push(`changes the test script in ${path} from "${was}" to "${now ?? "nothing"}"`);
      continue;
    }
    if (!isTestPath(path)) {
      const executable = entryPoints.has(path) || /(^|\/)bin\//.test(path);
      if (
        SCRIPT.test(path) &&
        !executable &&
        count(CLEAN_EXIT, newText) > count(CLEAN_EXIT, before)
      )
        found.push(`calls process.exit(0) in ${path}, which ends a test run early as a pass`);
      continue;
    }
    if (newText === "" && before !== "") {
      const tests = count(DECLARED, before);
      found.push(`deletes ${path}${tests ? ` and its ${plural(tests, "test")}` : ""}`);
      continue;
    }
    const removed = count(DECLARED, before) - count(DECLARED, newText);
    if (removed > 0) found.push(`removes ${plural(removed, "test")} from ${path}`);
    const skipped = count(SKIPPED, newText) - count(SKIPPED, before);
    if (skipped > 0) found.push(`skips ${plural(skipped, "test")} in ${path}`);
    if (count(FOCUSED, newText) > count(FOCUSED, before))
      found.push(`marks tests .only in ${path}, so the rest do not run`);
    if (count(EXITS, newText) > count(EXITS, before)) found.push(`calls process.exit in ${path}`);
  }
  return found;
}
