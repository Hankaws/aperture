/**
 * Two runs of the same script, one with the staged edits and one without,
 * compared test by test: which failures the edits brought in, and which
 * failing tests they fixed.
 *
 * Comparing only the first failure line gets a multi-failure project wrong:
 * fix one of three failing tests and the first failure line changes, so
 * the two still-failing tests look like the change's fault.
 */

export type RunSummary = { passed: boolean; detail: string; failures?: string[] };

export type RunComparison = {
  /** Every failure with the edits was already there without them. */
  preexisting: boolean;
  /** Tests that failed without the edits and pass with them, by name. */
  fixed: string[];
};

/** "tests/a.test.ts › suite › name" → "suite › name": the file is noise in a sentence. */
export function testLabel(key: string): string {
  const parts = key.split(" › ");
  return parts.length > 1 ? parts.slice(1).join(" › ") : key;
}

export function compareRuns(withEdits: RunSummary, without: RunSummary): RunComparison {
  if (withEdits.passed || without.passed) return { preexisting: false, fixed: [] };
  const after = withEdits.failures ?? [];
  const before = without.failures ?? [];
  if (after.length && before.length) {
    return {
      preexisting: after.every((name) => before.includes(name)),
      fixed: before.filter((name) => !after.includes(name)).map(testLabel),
    };
  }
  // No test names (a plain script that threw): the error itself is all there is to compare.
  return { preexisting: withEdits.detail === without.detail, fixed: [] };
}
