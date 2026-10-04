/**
 * Runs the check benchmark and writes its results, which the /benchmark page
 * shows and a unit test keeps current.
 *
 *   npm run bench
 */
import { writeFileSync } from "node:fs";
import { runBenchmark } from "../src/lib/bench/run.ts";

const results = await runBenchmark();
writeFileSync(new URL("../src/lib/bench/results.json", import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
const { summary } = results;
console.log(`Caught ${summary.caught} of ${summary.bad} bad edits (${summary.caughtCatchable} of ${summary.catchable} a check could see).`);
console.log(`False alarms: ${summary.falseAlarms} of ${summary.good} good edits.`);
console.log(`With the light type check instead of tsc: ${summary.lightCaught} of ${summary.bad}.`);
for (const item of results.cases) {
  const verdict = item.caughtBy.length ? `caught by ${item.caughtBy.join(", ")}` : item.kind === "good" ? "clean" : "MISSED";
  const states = Object.entries(item.checks).map(([id, state]) => `${id}:${state}`).join(" ");
  console.log(`  ${item.kind === "good" ? "good     " : item.mistake!.padEnd(9)}  ${item.id.padEnd(30)} ${verdict.padEnd(32)} ${states}`);
}
