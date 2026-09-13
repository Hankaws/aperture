//#region node_modules/.nitro/vite/services/ssr/assets/runner.server-B2wRfSVy.js
function controllers() {
	const g = globalThis;
	g.__apertureJobs ??= /* @__PURE__ */ new Map();
	return g.__apertureJobs;
}
function abortJob(id) {
	controllers().get(id)?.abort();
	controllers().delete(id);
}
async function runJob(id, userId, raw, agentId) {
	const input = {
		...raw,
		phase: raw.phase ?? "skip"
	};
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const ctrl = new AbortController();
	controllers().set(id, ctrl);
	await sql`
    update user_jobs set status = 'running' where id = ${id} and user_id = ${userId}
  `;
	try {
		if (agentId) {
			const { runAcpSession } = await import("./session.server-DlwMlOw2.mjs");
			const result = await runAcpSession({
				...input,
				agentId
			}, {
				userId,
				emit: () => void 0,
				signal: ctrl.signal
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
			const edits = JSON.stringify(result.edits);
			await sql`
        update user_jobs
        set status = 'done', result_text = ${result.text}, result_edits = ${edits}, finished_at = now()
        where id = ${id} and user_id = ${userId} and status = 'running'
      `;
			return;
		}
		const { resolveModel, recordAgentRun } = await import("./api-CT8K4ti-.mjs").then((n) => n.t);
		const resolved = await resolveModel(userId, input.source);
		if (!resolved.ok) {
			await sql`
        update user_jobs
        set status = 'failed', error = ${resolved.error}, finished_at = now()
        where id = ${id} and user_id = ${userId}
      `;
			return;
		}
		const { runAgentLoop } = await import("./loop.server-I7u3pKN4.mjs");
		const result = await runAgentLoop(input, {
			provider: resolved.provider,
			apiKey: resolved.apiKey
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
		await sql`
      update user_jobs
      set status = 'failed', error = ${error instanceof Error ? error.message : "Job failed"}, finished_at = now()
      where id = ${id} and user_id = ${userId} and status = 'running'
    `;
	} finally {
		controllers().delete(id);
	}
}
//#endregion
export { abortJob, runJob };
