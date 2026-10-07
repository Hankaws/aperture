/**
 * Aperture Agent Check: the editor's checks on a pull request. Reads the
 * change from git, runs Parses, Imports resolve, Types and the project's
 * tests, and reports as GitHub annotations, a run summary and an exit code.
 *
 * As a GitHub Action its settings arrive as INPUT_* variables; on a machine
 * they are flags (see `parseOptions`).
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { BrowserTests, CheckRow } from "../../../src/lib/workspace/checks.ts";
import { staticChangeChecks } from "../../../src/lib/workspace/static-checks.ts";
import { mergeBase, repoPrefix } from "./git.ts";
import { installedFiles } from "./installed.ts";
import { loadProject } from "./project.ts";
import {
  annotationsFor,
  consoleText,
  shownRows,
  summaryMarkdown,
  verdict,
  workflowCommands,
  type Meta,
} from "./report.ts";
import { runTests, runTestsAtBase } from "./tests.ts";

export type Options = {
  cwd: string;
  /** A branch, tag or commit; the check compares against where it meets this checkout. */
  base: string;
  runTests: boolean;
  testScript: string;
  timeoutMs: number;
  failOn: "red" | "never";
};

/** The runner can afford a bigger project than a browser tab. */
const RUNNER_TSC_LIMITS = { files: 3_000, bytes: 30_000_000, where: "on this runner" };

function hereDir(): string {
  if (typeof __dirname === "string") return __dirname;
  return dirname(fileURLToPath(import.meta.url));
}

/** The compiler's library files: beside the bundle in the action, from node_modules otherwise. */
function libReader(): (name: string) => string | undefined {
  const bundled = join(hereDir(), "lib");
  let dir = bundled;
  if (!existsSync(join(bundled, "lib.d.ts"))) {
    const load = typeof require === "function" ? require : createRequire(import.meta.url);
    dir = dirname(load.resolve("typescript/lib/lib.d.ts"));
  }
  const texts = new Map<string, string | undefined>();
  return (name) => {
    if (!texts.has(name)) {
      try {
        texts.set(name, readFileSync(join(dir, name), "utf8"));
      } catch {
        texts.set(name, undefined);
      }
    }
    return texts.get(name);
  };
}

/** The base a GitHub event names: the pull request's base, or the commit before a push. */
export function baseFromEvent(eventPath: string | undefined): string | null {
  if (!eventPath) return null;
  try {
    const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
      pull_request?: { base?: { sha?: string } };
      before?: string;
    };
    if (event.pull_request?.base?.sha) return event.pull_request.base.sha;
    if (event.before && !/^0+$/.test(event.before)) return event.before;
  } catch {
    // An unreadable event file is the same as none.
  }
  return null;
}

function flag(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
}

function input(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[`INPUT_${name.toUpperCase()}`];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

/** Settings from flags first, then action inputs, then the defaults. */
export function parseOptions(argv: string[], env: NodeJS.ProcessEnv): Options {
  const failOn = flag(argv, "fail-on") ?? input(env, "fail-on") ?? "red";
  if (failOn !== "red" && failOn !== "never")
    throw new Error(`fail-on must be "red" or "never", not "${failOn}".`);
  const minutes = Number(flag(argv, "timeout-minutes") ?? input(env, "timeout-minutes") ?? 10);
  const testsInput = input(env, "run-tests");
  return {
    cwd: resolve(
      flag(argv, "cwd") ?? input(env, "working-directory") ?? env.GITHUB_WORKSPACE ?? process.cwd(),
    ),
    base:
      flag(argv, "base") ??
      input(env, "base") ??
      baseFromEvent(env.GITHUB_EVENT_PATH) ??
      "origin/main",
    runTests: !argv.includes("--no-tests") && testsInput !== "false",
    testScript: flag(argv, "test-script") ?? input(env, "test-script") ?? "test",
    timeoutMs: (Number.isFinite(minutes) && minutes > 0 ? minutes : 10) * 60_000,
    failOn,
  };
}

export type Result = {
  rows: CheckRow[];
  meta: Meta;
  verdict: "red" | "clear";
  exitCode: number;
  text: string;
};

function testsFor(options: Options, rev: string): BrowserTests {
  if (!options.runTests) return { state: "unsupported", reason: "turned off (run-tests: false)." };
  const head = runTests(options.cwd, options.testScript, options.timeoutMs);
  if (!head.ran) return { state: "unsupported", reason: head.reason };
  const done = { state: "done" as const, script: options.testScript, where: "on this runner" };
  if (head.passed) return { ...done, passed: true, detail: "" };
  const base = runTestsAtBase(options.cwd, rev, options.testScript, options.timeoutMs);
  const preexisting = base !== null && base.ran && !base.passed;
  return { ...done, passed: false, detail: head.detail, evidence: head.evidence, preexisting };
}

export function check(options: Options): Result {
  const rev = mergeBase(options.base, options.cwd);
  const project = loadProject(options.cwd, rev);
  const meta: Meta = {
    changed: Object.keys(project.changes).length,
    deleted: project.deleted.length,
    notChecked: project.notChecked,
  };
  if (project.tooLarge) {
    const text = `Aperture Agent Check: not checked. ${project.tooLarge}`;
    return { rows: [], meta, verdict: "clear", exitCode: 0, text };
  }
  if (meta.changed === 0 && meta.deleted === 0) {
    const text =
      "Aperture Agent Check: nothing to check. This change touches no JavaScript, TypeScript, JSON, HTML or CSS.";
    return { rows: [], meta, verdict: "clear", exitCode: 0, text };
  }
  const rows = shownRows(
    staticChangeChecks({
      tsc: ts,
      readLib: libReader(),
      cache: new Map(),
      before: project.before,
      changes: project.changes,
      deleted: project.deleted,
      tests: testsFor(options, rev),
      description: "Pull request",
      tscLimits: RUNNER_TSC_LIMITS,
      installed: installedFiles(options.cwd),
    }),
  );
  const result = verdict(rows);
  return {
    rows,
    meta,
    verdict: result,
    exitCode: result === "red" && options.failOn === "red" ? 1 : 0,
    text: consoleText(rows, meta),
  };
}

/** Runs the check and reports it where it runs: a GitHub runner, or a terminal. */
export function main(argv: string[], env: NodeJS.ProcessEnv): number {
  let options: Options;
  let result: Result;
  try {
    options = parseOptions(argv, env);
    result = check(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      env.GITHUB_ACTIONS
        ? `::error title=Aperture Agent Check::${message}`
        : `Aperture Agent Check: ${message}`,
    );
    return 2;
  }
  console.log(result.text);
  if (env.GITHUB_ACTIONS) {
    // GitHub names files from the repository root; a project in a subfolder reports from there.
    const prefix = repoPrefix(options.cwd);
    const annotations = annotationsFor(result.rows).map((a) => ({
      ...a,
      file: `${prefix}${a.file}`,
    }));
    for (const line of workflowCommands(annotations)) console.log(line);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    const summary =
      result.rows.length > 0
        ? summaryMarkdown(result.rows, result.meta)
        : `### Aperture Agent Check\n\n${result.text.replace(/^Aperture Agent Check: /, "")}\n`;
    appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  }
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `verdict=${result.verdict}\n`);
  return result.exitCode;
}
