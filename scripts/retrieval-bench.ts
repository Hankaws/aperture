/**
 * Retrieval benchmark over this repository.
 *
 *   node --experimental-strip-types scripts/retrieval-bench.ts [--held-out]
 *
 * Measures whether `semantic_search` puts the file that answers a question in
 * front of the agent. The questions were written before either the baseline or
 * any change was measured, and are split in two:
 *
 * - DEV is what ranking changes were tuned against.
 * - HELD_OUT was not looked at while tuning. Its numbers are the honest ones.
 *
 * Bias worth stating: the same person wrote the questions and the ranker, and
 * knows this codebase. Phrasing avoids the target's identifiers where a person
 * asking would not use them, but the split is the real guard against overfit.
 * Re-running after a change is meaningful; comparing against other benchmarks
 * is not.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { indexFiles, semanticSearch } from "../src/lib/indexer/search.ts";

type Case = { q: string; expect: string[] };

const L = "src/lib/";
const C = "src/components/ide/";

export const DEV: Case[] = [
  { q: "where does the editor save the workspace in the browser", expect: [`${L}workspace/store.ts`] },
  { q: "decide whether to run the tests after the agent edits files", expect: [`${L}sandbox/auto-verify.ts`] },
  { q: "which npm scripts may the agent execute", expect: [`${L}sandbox/policy.ts`] },
  { q: "remove api keys and passwords before text reaches the model", expect: [`${L}security/redact.ts`] },
  { q: "two devices changed the project at the same time", expect: [`${L}workspace/sync.ts`, `${L}workspace/sync.api.ts`] },
  { q: "find imports that point at files which don't exist", expect: [`${L}workspace/module-graph.ts`] },
  { q: "pricing plans and what each tier includes", expect: [`${L}billing/plans.ts`] },
  { q: "download a repository archive from github", expect: [`${L}github/api.ts`] },
  { q: "summarize older conversation turns to save context", expect: [`${L}agent/compact.ts`] },
  { q: "restore the files from before the last applied change", expect: [`${L}workspace/checkpoint.ts`, `${L}workspace/store.ts`] },
  { q: "inline autocomplete suggestion shown in grey while typing", expect: [`${L}editor/ghost-text.ts`, `${L}agent/tab.server.ts`] },
  { q: "json-rpc protocol for external coding agents", expect: [`${L}acp/protocol.ts`, `${L}acp/http.ts`, `${L}acp/session.server.ts`] },
  { q: "how many verified runs a user gets per day", expect: [`${L}sandbox/run.server.ts`, `${L}billing/plans.ts`] },
  { q: "split camelCase words when tokenizing for search", expect: [`${L}indexer/embed.ts`] },
  { q: "type @ to reference a file in the prompt", expect: [`${L}workspace/mentions.ts`, `${C}mention-popover.tsx`] },
  { q: "cost in cents of a model request", expect: [`${L}billing/cost.ts`] },
  { q: "cancel a running agent request", expect: [`${L}agent/run.ts`, `${L}jobs/runner.server.ts`] },
  { q: "tell the agent which libraries and colors the project already uses", expect: [`${L}agent/stack.ts`] },
];

export const HELD_OUT: Case[] = [
  { q: "stop someone sending too many requests in a minute", expect: [`${L}security/agent-guard.server.ts`] },
  { q: "check that html tags are balanced before applying", expect: [`${L}workspace/preview-check.ts`] },
  { q: "report syntax errors in typescript before the user applies an edit", expect: [`${L}workspace/syntax-check.ts`] },
  { q: "several agents working on different files of the same plan", expect: [`${L}agent/fanout.ts`, `${L}agent/fanout.server.ts`, `${L}agent/crew.ts`] },
  { q: "apply a find and replace edit to a file's contents", expect: [`${L}agent/apply-edit.ts`] },
  { q: "files automatically attached as context for the agent", expect: [`${L}agent/auto-context.ts`] },
  { q: "sign in with email and password", expect: [`${L}auth/email-password.ts`] },
  { q: "long running agent tasks that finish in the background", expect: [`${L}jobs/runner.server.ts`, `${L}jobs/api.ts`, `${L}jobs/use-jobs.ts`] },
  { q: "call the vercel api to start a sandbox", expect: [`${L}sandbox/vercel.server.ts`] },
  { q: "open a postgres connection or fall back to an embedded database", expect: [`${L}db.ts`] },
  { q: "commands that start with a slash in the chat box", expect: [`${L}agent/slash.ts`, `${C}slash-popover.tsx`] },
  { q: "click on part of the rendered page to leave a note for the agent", expect: [`${L}workspace/design-mode.ts`, `${C}design-pane.tsx`] },
  { q: "export the project as a zip file", expect: [`${L}workspace/download.ts`] },
  { q: "load a folder from the user's computer", expect: [`${L}workspace/from-local.ts`, `${L}workspace/project-files.ts`] },
  { q: "the system prompt that tells the agent how to behave", expect: [`${L}agent/loop.server.ts`] },
  { q: "turn a failing test into a message the agent can act on", expect: [`${L}sandbox/runner.ts`, `${L}sandbox/auto-verify.ts`] },
  { q: "keyboard shortcut to search commands", expect: [`${C}command-palette.tsx`] },
];

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP = /^(node_modules|\.git|\.vercel|\.grok|dist|public|screenshots|attachments|artifacts)$/;

function loadRepo(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir) || ROOT)) {
      if (SKIP.test(entry)) continue;
      const rel = dir ? `${dir}/${entry}` : entry;
      const st = statSync(join(ROOT, rel));
      if (st.isDirectory()) walk(rel);
      // The benchmark itself contains every query verbatim and would rank first
      // for all of them. Tests restate the code's vocabulary and are not what
      // "where does X happen" is asking for.
      else if (
        /\.(tsx?|mjs|js|json|md|sql|css)$/.test(entry) &&
        st.size < 200_000 &&
        !/lock\.json$|routeTree\.gen|\.test\.|retrieval-bench/.test(entry)
      ) {
        files[rel] = readFileSync(join(ROOT, rel), "utf8");
      }
    }
  };
  walk("");
  return files;
}

/** What the agent is actually shown: `semantic_search` returns this many chunks. */
const AGENT_CHUNKS = 8;

export function score(files: Record<string, string>, cases: Case[]) {
  for (const c of cases) {
    for (const path of c.expect) {
      if (files[path] === undefined) throw new Error(`benchmark target missing: ${path}`);
    }
  }
  const t0 = performance.now();
  const chunks = indexFiles(files);
  const indexMs = performance.now() - t0;
  let r1 = 0, r3 = 0, r5 = 0, visible = 0, mrr = 0, queryMs = 0;
  const misses: string[] = [];
  for (const c of cases) {
    const q0 = performance.now();
    const ranked = semanticSearch(chunks, c.q, 200);
    queryMs += performance.now() - q0;
    const filesRanked = [...new Set(ranked.map((h) => h.chunk.path))];
    const rank = filesRanked.findIndex((p) => c.expect.includes(p));
    if (rank === 0) r1++;
    if (rank >= 0 && rank < 3) r3++;
    if (rank >= 0 && rank < 5) r5++;
    if (rank >= 0) mrr += 1 / (rank + 1);
    const shown = semanticSearch(chunks, c.q, AGENT_CHUNKS).map((h) => h.chunk.path);
    if (shown.some((p) => c.expect.includes(p))) visible++;
    else misses.push(`${c.q}  →  got ${[...new Set(shown)].slice(0, 3).join(", ") || "nothing"}`);
  }
  const n = cases.length;
  return {
    n,
    files: Object.keys(files).length,
    chunks: chunks.length,
    indexMs: Math.round(indexMs),
    queryMs: Math.round(queryMs / n),
    "R@1": r1 / n,
    "R@3": r3 / n,
    "R@5": r5 / n,
    agentVisible: visible / n,
    MRR: mrr / n,
    misses,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = loadRepo();
  const heldOut = process.argv.includes("--held-out");
  const result = score(files, heldOut ? HELD_OUT : DEV);
  const { misses, ...metrics } = result;
  console.log(`${heldOut ? "HELD-OUT" : "DEV"} set`);
  for (const [k, v] of Object.entries(metrics)) {
    console.log(`  ${k.padEnd(13)} ${typeof v === "number" && v <= 1 && !Number.isInteger(v) ? v.toFixed(3) : v}`);
  }
  if (misses.length) console.log(`  not shown to agent:\n    ${misses.join("\n    ")}`);
}
