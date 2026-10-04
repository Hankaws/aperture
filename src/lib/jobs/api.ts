import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { builtinById, isBuiltinAgentId } from "@/lib/acp/kinds";
import { planById } from "@/lib/billing/plans";
import type { JobRecord } from "./types";
import { agentInput, idInput } from "@/lib/security/inputs";

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

type JobRow = {
  id: string;
  kind: string;
  agent_id: string | null;
  instruction: string;
  status: string;
  result_text: string | null;
  result_edits: string | null;
  error: string | null;
  created_at: unknown;
  finished_at: unknown;
  agent_name?: string | null;
};

function toRecord(row: JobRow, agentName: string | null = null): JobRecord {
  let edits: JobRecord["edits"] = null;
  if (row.result_edits) {
    try {
      edits = JSON.parse(row.result_edits) as NonNullable<JobRecord["edits"]>;
    } catch {
      edits = null;
    }
  }
  const builtin = row.agent_id ? builtinById(row.agent_id) : null;
  return {
    id: row.id,
    kind: row.kind === "acp" ? "acp" : "composer",
    agentId: row.agent_id,
    agentName: agentName ?? row.agent_name ?? builtin?.name ?? null,
    instruction: row.instruction,
    status: (["queued", "running", "done", "failed", "stopped"] as const).includes(row.status as JobRecord["status"])
      ? (row.status as JobRecord["status"])
      : "failed",
    text: row.result_text,
    edits,
    error: row.error,
    createdAt: asIso(row.created_at),
    finishedAt: row.finished_at ? asIso(row.finished_at) : null,
  };
}

async function loadJobs(userId: string): Promise<JobRecord[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<JobRow>`
    select j.id, j.kind, j.agent_id, j.instruction, j.status, j.result_text, j.result_edits,
           j.error, j.created_at, j.finished_at, a.name as agent_name
    from user_jobs j
    left join user_agents a on a.id = j.agent_id
    where j.user_id = ${userId}
    order by j.created_at desc
    limit 30
  `;
  return rows.map((row) => toRecord(row, row.agent_name ?? null));
}

async function planOf(userId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const { spendOwnerId } = await import("@/lib/auth/visitor");
  const rows = await sql<{ plan: string }>`select plan from user_settings where user_id = ${spendOwnerId(userId)}`;
  return planById(rows[0]?.plan ?? "hobby");
}

export const listJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<JobRecord[]> => loadJobs(context.userId));

export const startJob = createServerFn({ method: "POST" })
  .validator(agentInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<JobRecord> => {
    const plan = await planOf(context.userId);
    if (plan.backgroundJobs <= 0) {
      throw new Error("Background jobs are on Pro. Composer in the panel still runs on Hobby.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const live = await sql<{ n: number }>`
      select count(*)::int as n from user_jobs
      where user_id = ${context.userId} and status in ('queued', 'running')
    `;
    const n = Number(live[0]?.n ?? 0);
    if (n >= plan.backgroundJobs) {
      throw new Error(`Queue full (${plan.backgroundJobs} of ${plan.backgroundJobs} background ${plan.backgroundJobs === 1 ? "job" : "jobs"} on ${plan.name}).`);
    }

    const { sanitizeAgentInput } = await import("@/lib/security/agent-guard.server");
    const clean = sanitizeAgentInput(data);
    if ("error" in clean) throw new Error(clean.error);

    let agentName: string | null = null;
    const agentId = typeof data.agentId === "string" && data.agentId ? data.agentId : null;
    if (agentId) {
      if (!plan.acp) throw new Error("External agents are on Pro.");
      if (isBuiltinAgentId(agentId)) {
        agentName = builtinById(agentId)?.name ?? "ACP";
      } else {
        const agents = await sql<{ name: string }>`
          select name from user_agents where id = ${agentId} and user_id = ${context.userId}
        `;
        if (!agents[0]) throw new Error("That agent is not on this account.");
        agentName = agents[0].name;
      }
    }

    const id = `job_${crypto.randomUUID()}`;
    await sql`
      insert into user_jobs (id, user_id, kind, agent_id, instruction, status)
      values (${id}, ${context.userId}, ${agentId ? "acp" : "composer"}, ${agentId}, ${clean.instruction}, 'queued')
    `;

    const { runJob } = await import("./runner.server");
    void runJob(id, context.userId, { ...clean, agentId }, agentId);

    return {
      id,
      kind: agentId ? "acp" : "composer",
      agentId,
      agentName,
      instruction: clean.instruction,
      status: "queued",
      text: null,
      edits: null,
      error: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
  });

export const cancelJob = createServerFn({ method: "POST" })
  .validator(idInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }): Promise<JobRecord[]> => {
    const { abortJob } = await import("./runner.server");
    abortJob(id);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update user_jobs
      set status = 'stopped', error = 'Stopped.', finished_at = now()
      where id = ${id} and user_id = ${context.userId} and status in ('queued', 'running')
    `;
    return loadJobs(context.userId);
  });
