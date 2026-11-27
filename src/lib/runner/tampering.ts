/**
 * Edits that make the tests pass without the code being right: deleting or
 * skipping tests, focusing a few with `.only`, exiting before they finish, or
 * rewriting the test script. Read from the staged change itself, so it holds
 * for the agent's own sandbox run (a real Node, where `process.exit(0)` does
 * end the run green) as well as the run in the browser tab.
 *
 * Counted per file, before against after, so a test file that already skipped
 * something is not blamed for it. Tests that leave one file and reappear, by
 * name, in another file of the same change were moved, not removed. A skip
 * that names its condition and its reason (`test.skip(isCloudflare, "no
 * workers yet")`) is a decision written down: worth a look, not tampering.
 * Pure: tests import it directly.
 */

type Edit = { path: string; newText: string };

const TEST_FILE = /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/i;
const TEST_SETUP =
  /(^|\/)(vitest|jest)\.(config|setup)\.[cm]?[jt]s$|(^|\/)setup(Tests?)?\.[cm]?[jt]s$/i;

/** A declared test, skipped or not: `test(`, `it.each(…)(`, `t.test(`, `xit(`. */
const DECLARED = /\b(?:it|test)\s*(?:\.\s*\w+\s*)*\(|\bx(?:it|test)\s*\(/g;
const SKIPPED =
  /\b(?:it|test|describe|suite)\s*\.\s*(?:skip|todo)\b|\bx(?:it|test|describe)\s*\(|\b(?:skip|todo)\s*:\s*true|\b(?:t|ctx|context)\s*\.\s*skip\s*\(/g;
/** `test.skip(condition, "reason")`: skipped only where the condition holds, and says why. */
const CONDITIONAL_SKIP =
  /\b(?:it|test|describe)\s*\.\s*skip\s*\(\s*(?!['"`])[^,()]*(?:\([^()]*\)[^,()]*)*,\s*['"`]/g;
/** The title a test is declared with, when it is a plain string. */
const TITLED = /\b(?:it|test)\s*(?:\.\s*\w+\s*)*\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const FOCUSED =
  /\b(?:it|test|describe|suite)\s*\.\s*only\b|\bf(?:it|describe)\s*\(|\bonly\s*:\s*true/g;
const EXITS = /\bprocess\s*\.\s*(?:exit\s*\(|exitCode\s*=|kill\s*\(\s*process\s*\.\s*pid)/g;
/** An exit that can only fail the run (`process.exit(1)`, `process.exitCode = 1`): never a way to pass. */
const FAILING_EXIT = /\bprocess\s*\.\s*(?:exit\s*\(\s*[1-9]\d*\s*\)|exitCode\s*=\s*[1-9]\d*\b)/g;
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

/** Strings emptied, quotes kept: `"test.skip("` written as data (a fixture, a message) is not a skip. */
function bare(text: string): string {
  return text.replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, "$1$1");
}

function count(re: RegExp, text: string): number {
  return (bare(code(text)).match(re) ?? []).length;
}

/** Each test's title, as often as it is declared. */
function titles(text: string): string[] {
  return [...code(text).matchAll(TITLED)].map((m) => m[2]!);
}

/** Skips that are not conditional with a reason. */
function bareSkips(text: string): number {
  return count(SKIPPED, text) - count(CONDITIONAL_SKIP, text);
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

/** A test file, folder or glob in a script, unquoted: a quoted glob, `test/`, `a.spec.js`. */
function isPathArg(token: string): boolean {
  return !token.startsWith("-") && (/[/*]/.test(token) || /\.(?:[cm]?[jt]sx?)$/.test(token));
}

function scriptTokens(script: string): string[] {
  return (script.match(/'[^']*'|"[^"]*"|\S+/g) ?? []).map((token) =>
    token.replace(/^['"]|['"]$/g, ""),
  );
}

/**
 * Whether `now` only adds test paths to a script that already named its own
 * paths: more tests run, none fewer. A script that ran everything and gains
 * a path ran everything before and only that path after, so it narrows.
 */
export function widensTestScript(was: string, now: string): boolean {
  if (!now.startsWith(was) || now === was) return false;
  if (!scriptTokens(was).some(isPathArg)) return false;
  const added = scriptTokens(now.slice(was.length));
  return added.length > 0 && added.every(isPathArg);
}

/** Shell that can turn a failing step into a pass, or end the run early. */
const MASKS =
  /\|\||;|(^|[^&])&(?!&)|(^|[^|])\|(?!\|)|\bexit\b|\btrue\b|passWithNoTests|--bail\s*=?\s*0|\bskip\b/;

/**
 * Whether `now` only adds steps to a `a && b && c` script: every step it had
 * is still there, in order and unchanged, and each new step is a plain
 * command. With `&&` a step that fails still fails the whole run, so more
 * steps run more checks, never fewer.
 */
export function addsTestSteps(was: string, now: string): boolean {
  if (now === was || MASKS.test(was.replace(/&&/g, " ")) || MASKS.test(now.replace(/&&/g, " ")))
    return false;
  const steps = (script: string) => script.split("&&").map((step) => step.trim());
  const old = steps(was);
  const next = steps(now);
  if (next.some((step) => step === "")) return false;
  let at = 0;
  for (const step of next) if (at < old.length && step === old[at]) at += 1;
  return at === old.length && next.length > old.length;
}

/**
 * Test files the change moves: each one it removes, paired with a test file it
 * creates, the same name first. The pair is judged as one edit, so a move is
 * not read as deleting the tests.
 */
function movedTests(files: Record<string, string>, edits: Edit[]): Map<string, string> {
  const created = edits
    .filter((e) => files[e.path] === undefined && e.newText !== "" && isTestPath(e.path))
    .map((e) => e.path);
  const moves = new Map<string, string>();
  const name = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  for (const { path, newText } of edits) {
    if (newText !== "" || !files[path] || !isTestPath(path) || !created.length) continue;
    const at = Math.max(
      0,
      created.findIndex((other) => name(other) === name(path)),
    );
    moves.set(path, created.splice(at, 1)[0]!);
  }
  return moves;
}

/** What the change does to the tests: what holds it (`red`) and what is worth a look (`look`). One clause each. */
export function testChanges(
  files: Record<string, string>,
  edits: Edit[],
): { red: string[]; look: string[] } {
  const red: string[] = [];
  const look: string[] = [];
  const entryPoints = executables(files);
  const moves = movedTests(files, edits);
  const movedTo = new Set(moves.values());
  // Titles each test file gains, to match against the ones another file loses.
  const gained = new Map<string, number>();
  for (const edit of edits) {
    if (!isTestPath(edit.path)) continue;
    const had = new Map<string, number>();
    for (const t of titles(files[edit.path] ?? "")) had.set(t, (had.get(t) ?? 0) + 1);
    for (const t of titles(edit.newText)) {
      const n = had.get(t) ?? 0;
      if (n > 0) had.set(t, n - 1);
      else gained.set(t, (gained.get(t) ?? 0) + 1);
    }
  }
  /** How many of `lost` reappear in another file of the change; those are used up. */
  const reappear = (lost: string[]) => {
    let found = 0;
    for (const t of lost) {
      const n = gained.get(t) ?? 0;
      if (n > 0) {
        gained.set(t, n - 1);
        found += 1;
      }
    }
    return found;
  };
  const lostTitles = (was: string, now: string) => {
    const left = new Map<string, number>();
    for (const t of titles(now)) left.set(t, (left.get(t) ?? 0) + 1);
    return titles(was).filter((t) => {
      const n = left.get(t) ?? 0;
      if (n > 0) left.set(t, n - 1);
      return n === 0;
    });
  };
  for (const edit of edits) {
    if (movedTo.has(edit.path)) continue;
    // A test file moved is judged at its new path, against the text it had.
    const to = moves.get(edit.path);
    const path = to ?? edit.path;
    const newText = to ? edits.find((e) => e.path === to)!.newText : edit.newText;
    const before = files[edit.path] ?? "";
    if (path === "package.json" || path.endsWith("/package.json")) {
      const was = testScript(before);
      const now = testScript(newText);
      // Added steps run more checks, never fewer, but each is code the run now depends on: worth a look.
      if (was !== null && now !== null && addsTestSteps(was, now))
        look.push(
          `adds ${plural(now.split("&&").length - was.split("&&").length, "step")} to the test script in ${path}`,
        );
      else if (was !== null && now !== was && !(now !== null && widensTestScript(was, now)))
        red.push(`changes the test script in ${path} from "${was}" to "${now ?? "nothing"}"`);
      continue;
    }
    if (!isTestPath(path)) {
      // A file with a `#!` line is a program run on its own (a CLI, a Claude Code hook), not a module tests import.
      const executable =
        entryPoints.has(path) || /(^|\/)bin\//.test(path) || newText.startsWith("#!");
      if (
        SCRIPT.test(path) &&
        !executable &&
        count(CLEAN_EXIT, newText) > count(CLEAN_EXIT, before)
      )
        red.push(`calls process.exit(0) in ${path}, which ends a test run early as a pass`);
      continue;
    }
    if (newText === "" && before !== "") {
      const tests = count(DECLARED, before) - reappear(titles(before));
      if (tests > 0 || count(DECLARED, before) === 0)
        red.push(`deletes ${path}${tests ? ` and its ${plural(tests, "test")}` : ""}`);
      continue;
    }
    const fewer = count(DECLARED, before) - count(DECLARED, newText);
    const removed = fewer > 0 ? fewer - Math.min(fewer, reappear(lostTitles(before, newText))) : 0;
    if (removed > 0) red.push(`removes ${plural(removed, "test")} from ${path}`);
    const skipped = bareSkips(newText) - bareSkips(before);
    if (skipped > 0) red.push(`skips ${plural(skipped, "test")} in ${path}`);
    const conditional = count(CONDITIONAL_SKIP, newText) - count(CONDITIONAL_SKIP, before);
    if (conditional > 0)
      look.push(
        `skips ${conditional === 1 ? "a test" : `${conditional} tests`} in ${path} under a condition, and says why`,
      );
    if (count(FOCUSED, newText) > count(FOCUSED, before))
      red.push(`marks tests .only in ${path}, so the rest do not run`);
    const exits = (text: string) => count(EXITS, text) - count(FAILING_EXIT, text);
    if (exits(newText) > exits(before)) red.push(`calls process.exit in ${path}`);
  }
  return { red, look };
}

/** What the change does to the tests that holds it, one clause each ("skips 1 test in tests/a.test.ts"); empty when nothing. */
export function testTampering(files: Record<string, string>, edits: Edit[]): string[] {
  return testChanges(files, edits).red;
}
