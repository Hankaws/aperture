/**
 * A stored baseline for one base commit, so a flaky or slow base run is not
 * repeated while that commit stays the base. Off unless asked: the default
 * still recomputes the base every time.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TestRun } from "./tests.ts";

export type BaselineMode = "recompute" | "cache";

export function baselineFile(dir: string, rev: string, script: string): string {
  const name = createHash("sha256").update(`${rev}\0${script}`).digest("hex").slice(0, 24);
  return join(dir, `${name}.json`);
}

export function readBaseline(dir: string, rev: string, script: string): TestRun | null {
  try {
    const raw = JSON.parse(readFileSync(baselineFile(dir, rev, script), "utf8")) as {
      rev?: string;
      script?: string;
      run?: TestRun;
    };
    if (raw.rev !== rev || raw.script !== script || !raw.run || typeof raw.run.ran !== "boolean") return null;
    return raw.run;
  } catch {
    return null;
  }
}

export function writeBaseline(dir: string, rev: string, script: string, run: TestRun): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(baselineFile(dir, rev, script), JSON.stringify({ rev, script, run }));
}

/**
 * The base run to compare against. `cache` reuses a result stored for this
 * base commit and script, and writes one when it had to run.
 */
export function baseFromCacheOrRun(
  mode: BaselineMode,
  dir: string,
  rev: string,
  script: string,
  run: () => TestRun | null,
): { run: TestRun | null; cached: boolean } {
  if (mode === "cache") {
    const hit = readBaseline(dir, rev, script);
    if (hit) return { run: hit, cached: true };
  }
  const fresh = run();
  if (mode === "cache" && fresh) writeBaseline(dir, rev, script, fresh);
  return { run: fresh, cached: false };
}
