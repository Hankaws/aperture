import type { PlanEntry, ProposedEdit, ToolTrace } from "../workspace/types.ts";

export const MAX_FANOUT = 3;

export type FanoutWorker = {
  files: string[];
  steps: PlanEntry[];
};

export type FanoutResult =
  | { ok: true; text: string; traces: ToolTrace[]; edits: ProposedEdit[]; plan?: PlanEntry[]; awaitingBuild?: boolean }
  | { ok: false; error: string };

const PATH_LIKE =
  /(?:[\w.-]+\/)+[\w.-]+\.[\w]+|\b[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|md|json|css|html|vue|go|rs)\b/g;

function resolvePath(token: string, known: string[]): string | null {
  const t = token.replace(/^\.\//, "").replace(/\\/g, "/");
  const exact = known.filter((p) => p === t || p.endsWith(`/${t}`));
  if (exact.length === 1) return exact[0]!;
  return null;
}

export function pathsInStep(content: string, known: string[]): string[] {
  const found = new Set<string>();
  const matches = content.match(PATH_LIKE) ?? [];
  for (const raw of matches) {
    const path = resolvePath(raw, known);
    if (path) found.add(path);
  }
  return [...found];
}

function find(parent: Map<string, string>, x: string): string {
  const p = parent.get(x) ?? x;
  if (p !== x) {
    const root = find(parent, p);
    parent.set(x, root);
    return root;
  }
  return p;
}

function union(parent: Map<string, string>, a: string, b: string) {
  const pa = find(parent, a);
  const pb = find(parent, b);
  if (pa !== pb) parent.set(pa, pb);
}

/** Independent file groups from a plan. Empty = do not fan out (overlap, unscoped, or one file). */
export function fanoutWorkers(plan: PlanEntry[], knownFiles: string[]): FanoutWorker[] {
  if (plan.length === 0 || knownFiles.length === 0) return [];
  const stepFiles = plan.map((step) => pathsInStep(step.content, knownFiles));
  if (stepFiles.some((files) => files.length === 0)) return [];

  const parent = new Map<string, string>();
  for (const files of stepFiles) {
    for (const file of files) parent.set(file, parent.get(file) ?? file);
    for (let i = 1; i < files.length; i += 1) union(parent, files[0]!, files[i]!);
  }

  const groups = new Map<string, Set<string>>();
  for (const file of parent.keys()) {
    const root = find(parent, file);
    const set = groups.get(root) ?? new Set<string>();
    set.add(file);
    groups.set(root, set);
  }
  if (groups.size < 2) return [];

  let workers: FanoutWorker[] = [...groups.values()].map((files) => ({
    files: [...files].sort(),
    steps: plan.filter((_, i) => stepFiles[i]!.some((f) => files.has(f))),
  }));
  workers.sort((a, b) => b.files.length - a.files.length);
  while (workers.length > MAX_FANOUT) {
    const small = workers.pop()!;
    const last = workers[workers.length - 1]!;
    workers[workers.length - 1] = {
      files: [...new Set([...last.files, ...small.files])].sort(),
      steps: [...last.steps, ...small.steps],
    };
  }
  return workers;
}

/** How many billed turns Build it will actually consume. */
export function billedWorkers(
  plan: PlanEntry[] | undefined,
  knownFiles: string[],
  canPay: (n: number) => boolean,
): number {
  const groups = fanoutWorkers(plan ?? [], knownFiles);
  if (groups.length < 2) return 1;
  return canPay(groups.length) ? groups.length : 1;
}

export function scopedBuildInput<T extends { instruction?: string; phase?: string; approvedPlan?: PlanEntry[] }>(
  base: T,
  worker: FanoutWorker,
): T {
  const owned = worker.files.join(", ");
  const steps = worker.steps.map((entry, i) => `${i + 1}. ${entry.content}`).join("\n");
  return {
    ...base,
    phase: "build",
    approvedPlan: worker.steps,
    instruction: `Build it.\n\nYou own only these files: ${owned}. Do not propose_edit any other path. Read other files if you need context.\n\nYour steps:\n${steps}`,
  };
}

export function mergeFanoutResults(
  results: FanoutResult[],
  workers: FanoutWorker[],
  approved: PlanEntry[],
): FanoutResult {
  const traces: ToolTrace[] = [];
  const edits: ProposedEdit[] = [];
  const texts: string[] = [];
  let anyOk = false;

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]!;
    const worker = workers[i]!;
    const allow = new Set(worker.files);
    const tag = worker.files[0] ?? `file ${i + 1}`;
    if (!result.ok) {
      traces.push({
        id: `w${i}_err`,
        name: tag,
        args: {},
        resultPreview: result.error,
        ms: 0,
      });
      continue;
    }
    anyOk = true;
    if (result.text.trim()) texts.push(result.text.trim());
    traces.push(
      ...result.traces.map((trace) => ({
        ...trace,
        id: `w${i}_${trace.id}`,
        name: `${tag} · ${trace.name}`,
      })),
    );
    for (const edit of result.edits) {
      if (!allow.has(edit.path)) continue;
      edits.push({ ...edit, id: `w${i}_${edit.id}` });
    }
  }

  if (!anyOk) {
    const first = results.find((r) => !r.ok);
    return first && !first.ok ? first : { ok: false, error: "Build failed." };
  }

  const completed = new Set<string>();
  for (const result of results) {
    if (!result.ok) continue;
    for (const step of result.plan ?? []) {
      if (step.status === "completed") completed.add(step.id);
    }
  }
  const plan = approved.map((step) => (completed.has(step.id) ? { ...step, status: "completed" as const } : step));

  return {
    ok: true,
    text: texts.join("\n\n") || "Done.",
    traces,
    edits,
    plan,
    awaitingBuild: false,
  };
}
