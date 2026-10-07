#!/usr/bin/env node
/**
 *   aperture-agent-check [--base origin/main] [--no-tests] [--test-script test]
 *                        [--timeout-minutes 10] [--fail-on red|never] [--cwd .]
 */
import { main } from "./main.ts";

process.exitCode = main(process.argv.slice(2), process.env);
