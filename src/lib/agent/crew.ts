import type { ModelSource, ProviderId } from "../billing/plans.ts";
import { PROVIDERS } from "../billing/plans.ts";
import { BUILTIN_ACP } from "../acp/kinds.ts";
import { MAX_FANOUT, fanoutWorkers, pathsInStep, type FanoutWorker } from "./fanout.ts";
import type { PlanEntry } from "../workspace/types.ts";

export type WorkerRole = "build" | "review";

export type CrewSeat = {
  id: string;
  kind: "model" | "acp";
  label: string;
  source?: ModelSource;
  agentId?: string;
  ready: boolean;
  hint: string;
};

export type WorkerSpec = {
  files: string[];
  steps: PlanEntry[];
  source?: ModelSource;
  agentId?: string | null;
  label: string;
  role?: WorkerRole;
};

export type SeatAccount = {
  keys: Record<ProviderId, { set: boolean }>;
  acp: boolean;
  custom?: { base: string | null; model: string | null } | null;
};

export function availableSeats(account: SeatAccount | null | undefined): CrewSeat[] {
  const seats: CrewSeat[] = [
    { id: "hosted", kind: "model", label: "Grok", source: "hosted", ready: true, hint: "Your Grok key" },
  ];
  for (const provider of PROVIDERS) {
    if (provider.id === "grok") continue;
    const ready = Boolean(account?.keys[provider.id]?.set);
    seats.push({
      id: provider.id,
      kind: "model",
      label: provider.short,
      source: provider.id,
      ready,
      hint: ready ? "Your key" : "Add key in Settings",
    });
  }
  const grokReady = Boolean(account?.keys.grok?.set);
  if (grokReady) {
    seats.push({
      id: "grok",
      kind: "model",
      label: "Grok key",
      source: "grok",
      ready: true,
      hint: "Your key",
    });
  }
  const customReady = Boolean(account?.custom?.base && account.custom.model);
  seats.push({
    id: "custom",
    kind: "model",
    label: "Custom",
    source: "custom",
    ready: customReady,
    hint: customReady ? (account?.custom?.model ?? "Your endpoint") : "Set endpoint in Settings",
  });
  for (const agent of BUILTIN_ACP) {
    seats.push({
      id: agent.id,
      kind: "acp",
      label: agent.name,
      agentId: agent.id,
      ready: Boolean(account?.acp),
      hint: account?.acp ? "ACP · same diffs" : "ACP is on Pro",
    });
  }
  return seats;
}

export function selectedSeats(seats: CrewSeat[], ids: string[]): CrewSeat[] {
  const set = new Set(ids.length ? ids : ["hosted"]);
  const picked = seats.filter((s) => set.has(s.id) && s.ready);
  return picked.length ? picked : seats.filter((s) => s.id === "hosted");
}

export function modelSeats(seats: CrewSeat[]): CrewSeat[] {
  return seats.filter((s) => s.kind === "model" && s.ready);
}

export function parseWorkerRole(value: unknown): WorkerRole {
  return value === "review" ? "review" : "build";
}

export function workerLabel(seat: CrewSeat, files: string[], role: WorkerRole = "build"): string {
  const names = files.map((f) => f.split("/").pop()).join(", ");
  return `${seat.label} · ${role === "review" ? "Review" : "Build"} · ${names}`;
}

function seatKey(seat: CrewSeat): string {
  return seat.source ?? seat.agentId ?? seat.id;
}

function workerKey(worker: WorkerSpec): string {
  return worker.source ?? worker.agentId ?? "";
}

function specFrom(seat: CrewSeat, group: FanoutWorker, plan: PlanEntry[], role: WorkerRole): WorkerSpec {
  const steps = group.steps.length ? group.steps : plan;
  return {
    files: group.files,
    steps,
    source: seat.source,
    agentId: null,
    role,
    label: workerLabel(seat, group.files, role),
  };
}

function filesFromPlan(plan: PlanEntry[], knownFiles: string[]): string[] {
  const found = new Set<string>();
  for (const step of plan) {
    for (const path of pathsInStep(step.content, knownFiles)) found.add(path);
  }
  return found.size ? [...found] : knownFiles.slice(0, 4);
}

export function proposeWorkers(plan: PlanEntry[], knownFiles: string[], seats: CrewSeat[]): WorkerSpec[] {
  const pool = modelSeats(seats);
  if (pool.length === 0 || plan.length === 0) return [];
  const groups = fanoutWorkers(plan, knownFiles);
  const builders: WorkerSpec[] =
    groups.length >= 2
      ? groups.slice(0, MAX_FANOUT).map((group, i) => specFrom(pool[i % pool.length]!, group, plan, "build"))
      : pool.length >= 2
        ? [specFrom(pool[0]!, { files: filesFromPlan(plan, knownFiles), steps: plan }, plan, "build")]
        : [];
  if (builders.length === 0) return [];
  if (pool.length >= 2 && builders.length < MAX_FANOUT) {
    const reviewSeat = pool.find((s) => s.source !== builders[0]?.source) ?? pool[1]!;
    const files = [...new Set(builders.flatMap((w) => w.files))];
    builders.push(specFrom(reviewSeat, { files, steps: [] }, plan, "review"));
  }
  return builders.slice(0, MAX_FANOUT);
}

export function proposeReviewer(paths: string[], seats: CrewSeat[], exclude?: ModelSource | null): WorkerSpec[] {
  if (paths.length === 0) return [];
  const pool = modelSeats(seats);
  const seat = pool.find((s) => s.source && s.source !== exclude) ?? pool[0];
  if (!seat) return [];
  return [specFrom(seat, { files: paths, steps: [] }, [], "review")];
}

export function addWorker(
  existing: WorkerSpec[],
  seats: CrewSeat[],
  knownFiles: string[],
  plan: PlanEntry[],
): WorkerSpec[] {
  if (existing.length >= MAX_FANOUT) return existing;
  const pool = modelSeats(seats);
  if (pool.length === 0) return existing;
  const owned = new Set(existing.filter((w) => (w.role ?? "build") === "build").flatMap((w) => w.files));
  let files = knownFiles.filter((f) => !owned.has(f)).slice(0, 3);
  let next = existing;
  if (files.length === 0) {
    const big = [...existing]
      .filter((w) => (w.role ?? "build") === "build")
      .sort((a, b) => b.files.length - a.files.length)[0];
    if (!big || big.files.length < 2) return existing;
    const split = Math.ceil(big.files.length / 2);
    files = big.files.slice(split);
    const keep = big.files.slice(0, split);
    const keepSeat = pool.find((s) => (s.source ?? "") === (big.source ?? "")) ?? pool[0]!;
    next = existing.map((w) => (w === big ? { ...w, files: keep, label: workerLabel(keepSeat, keep, "build") } : w));
  }
  const used = new Set(next.map(workerKey));
  const seat = pool.find((s) => !used.has(seatKey(s))) ?? pool[next.length % pool.length]!;
  return [...next, specFrom(seat, { files, steps: plan }, plan, "build")];
}

export function dropWorker(existing: WorkerSpec[], index: number): WorkerSpec[] {
  return existing.filter((_, i) => i !== index);
}

export function toggleWorkerRole(existing: WorkerSpec[], index: number, seats: CrewSeat[]): WorkerSpec[] {
  return existing.map((worker, i) => {
    if (i !== index) return worker;
    const role: WorkerRole = worker.role === "review" ? "build" : "review";
    const seat =
      seats.find((s) => s.source === worker.source) ??
      ({ id: worker.source ?? "hosted", kind: "model", label: worker.label.split(" · ")[0] ?? "Grok", ready: true, hint: "", source: worker.source } as CrewSeat);
    return { ...worker, role, label: workerLabel(seat, worker.files, role) };
  });
}

export function canConfirm(workers: WorkerSpec[]): boolean {
  if (workers.length === 0 || workers.some((w) => w.files.length === 0 || w.agentId)) return false;
  const builds = workers.filter((w) => (w.role ?? "build") === "build");
  const reviews = workers.filter((w) => w.role === "review");
  return builds.length >= 2 || reviews.length >= 1;
}
