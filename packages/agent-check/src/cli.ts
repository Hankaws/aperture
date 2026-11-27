#!/usr/bin/env node
/**
 *   aperture-agent-check [--base origin/main] [--no-tests] [--test-script test]
 *                        [--timeout-minutes 10] [--fail-on red|never] [--cwd .]
 */
import * as run from "./main.ts";

process.exitCode = run.main(process.argv.slice(2), process.env);
// The pull request comment, when asked for, is still in flight: Node waits for it before the step
// ends. It reports its own outcome and never throws.
void run.pendingComment;
