/**
 * How big a project the checks take on. The numbers are the limits in the
 * editor and in Agent Check; scale.test.ts fails if those drift.
 */
export const SCALE = {
  editorFiles: 600,
  editorBytes: 4_000_000,
  dependents: 40,
  agentFiles: 5_000,
  agentBytes: 50_000_000,
  agentTscFiles: 3_000,
  agentTscBytes: 30_000_000,
  /** One past the editor's compiler cap. The light check still runs. */
  probeFiles: 601,
} as const;
