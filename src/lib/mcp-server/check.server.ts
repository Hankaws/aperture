/**
 * `check_change` on the server: the editor's checks with the TypeScript
 * compiler in this process. Nothing the caller sent is executed, stored or
 * logged.
 *
 * The compiler's library files come through Vite's glob, as in the browser's
 * tsc worker, so they are inside the server bundle: a deployed function has no
 * node_modules to read them from.
 */
import ts from "typescript";
import type { CheckRow } from "@/lib/workspace/checks";
import { staticChangeChecks } from "@/lib/workspace/static-checks";
import { compilerOptions, loadLibFiles, type TscCache } from "@/lib/workspace/tsc-core";
import type { CheckInput } from "./protocol";

const LIB_PREFIX = "/node_modules/typescript/lib/";
const libLoaders = import.meta.glob("/node_modules/typescript/lib/lib.*.d.ts", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const libTexts = new Map<string, string>();
/** Parsed library files only, so it is the same size whoever calls. */
const cache: TscCache = new Map();

const load = (name: string) => libLoaders[`${LIB_PREFIX}${name}`];

/**
 * The compiler holds the process while it runs, and the rate limit is per
 * account, so many accounts at once could queue checks without end. Past this
 * many in flight on one instance, a caller is told to come back.
 */
const MAX_IN_FLIGHT = 2;
let inFlight = 0;

export async function checkChange(input: CheckInput): Promise<CheckRow[]> {
  if (inFlight >= MAX_IN_FLIGHT) {
    throw new Error("Aperture is busy checking other changes. Try again in a few seconds.");
  }
  inFlight += 1;
  try {
    return await runChecks(input);
  } finally {
    inFlight -= 1;
  }
}

async function runChecks(input: CheckInput): Promise<CheckRow[]> {
  const after = { ...input.files, ...input.changes };
  await loadLibFiles(ts, compilerOptions(ts, after), libTexts, load);
  await loadLibFiles(ts, compilerOptions(ts, input.files), libTexts, load);
  return staticChangeChecks({
    tsc: ts,
    readLib: (name) => libTexts.get(name),
    cache,
    before: input.files,
    changes: input.changes,
    tests: {
      state: "unsupported",
      reason: "this server does not run code. Run the project's tests before you apply the change.",
    },
    description: input.summary || "Change from an agent",
  });
}
