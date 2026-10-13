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

/** One real repository, counted the way the editor and Agent Check count. */
export type LargeRepo = {
  name: string;
  url: string;
  commit: string;
  /** The commit's date, YYYY-MM-DD. */
  commitDate: string;
  /** When the count was taken, YYYY-MM-DD. */
  measured: string;
  /** Files Agent Check would read: JS, TS, JSON, HTML, CSS, under its per-file cap. */
  relevantFiles: number;
  relevantBytes: number;
  /** TypeScript files the compiler would take. */
  tsFiles: number;
  tsBytes: number;
};

/** What each checker does with a repository of this size. */
export function largeRepoVerdict(repo: LargeRepo): {
  editorRefuses: boolean;
  agentReads: boolean;
  agentTypechecks: boolean;
} {
  return {
    editorRefuses: repo.tsFiles > SCALE.editorFiles || repo.tsBytes > SCALE.editorBytes,
    agentReads: repo.relevantFiles <= SCALE.agentFiles && repo.relevantBytes <= SCALE.agentBytes,
    agentTypechecks: repo.tsFiles <= SCALE.agentTscFiles && repo.tsBytes <= SCALE.agentTscBytes,
  };
}
