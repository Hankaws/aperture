import type { AgentInput } from "@/lib/agent/types";

type GlobalJobs = typeof globalThis & {
  __apertureJobs?: Map<string, AbortController>;
};

function controllers(): Map<string, AbortController> {
  const g = globalThis as GlobalJobs;
  g.__apertureJobs ??= new Map();
  return g.__apertureJobs;
}

export function abortJob(id: string) {
  const ctrl = controllers().get(id);
  ctrl?.abort();
  controllers().delete(id);
}

export async function runJob(id: string, userId: string, raw: AgentInput, agentId: string | null) {
  const input: AgentInput = { ...raw, phase: raw.phase ?? "skip" };
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const ctrl = new AbortController();
  controllers().set(id, ctrl);

  await sql`
    update user_jobs set status = 'running' where id = ${id} and user_id = ${userId}
  `;

  try {
    if (agentId) {
      const { runAcpSession } = await import("@/lib/acp/session.server");
      const result = await runAcpSession(
        { ...input, agentId },
        { userId, emit: () => undefined, signal: ctrl.signal },
      );
      if (ctrl.signal.aborted) return;
      if (!result.ok) {
        await sql`
          update user_jobs
          set status = 'failed', error = ${result.error}, finished_at = now()
          where id = ${id} and user_id = ${userId} and status = 'running'
        `;
        return;
      }
      const edits = JSON.stringify(result.edits);
      await sql`
        update user_jobs
        set status = 'done', result_text = ${result.text}, result_edits = ${edits}, finished_at = now()
        where id = ${id} and user_id = ${userId} and status = 'running'
      `;
      return;
    }

    const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
    const resolved = await resolveModel(userId, input.source);
    if (!resolved.ok) {
      await sql`
        update user_jobs
        set status = 'failed', error = ${resolved.error}, finished_at = now()
        where id = ${id} and user_id = ${userId}
      `;
      return;
    }
    const { runAgentLoop } = await import("@/lib/agent/loop.server");
    const result = await runAgentLoop(input, {
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      base: resolved.base,
      model: resolved.model,
      userId,
    });
    if (ctrl.signal.aborted) return;
    if (!result.ok) {
      await sql`
        update user_jobs
        set status = 'failed', error = ${result.error}, finished_at = now()
        where id = ${id} and user_id = ${userId} and status = 'running'
      `;
      return;
    }
    await recordAgentRun(userId, resolved.hosted, resolved.cents);
    const edits = JSON.stringify(result.edits);
    await sql`
      update user_jobs
      set status = 'done', result_text = ${result.text}, result_edits = ${edits}, finished_at = now()
      where id = ${id} and user_id = ${userId} and status = 'running'
    `;
  } catch (error) {
    if (ctrl.signal.aborted) return;
    const message = error instanceof Error ? error.message : "Job failed";
    await sql`
      update user_jobs
      set status = 'failed', error = ${message}, finished_at = now()
      where id = ${id} and user_id = ${userId} and status = 'running'
    `;
  } finally {
    controllers().delete(id);
  }
}
