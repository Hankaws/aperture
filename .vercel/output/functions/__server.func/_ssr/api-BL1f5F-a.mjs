import { a as builtinById, c as isBuiltinAgentId } from "./kinds-CCf1JBpH.mjs";
import { a as planById } from "./plans-CTIRB29R.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-BW7VTtXx.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-BL1f5F-a.js
function asIso(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return (/* @__PURE__ */ new Date()).toISOString();
}
function toRecord(row, agentName = null) {
	let edits = null;
	if (row.result_edits) try {
		edits = JSON.parse(row.result_edits);
	} catch {
		edits = null;
	}
	const builtin = row.agent_id ? builtinById(row.agent_id) : null;
	return {
		id: row.id,
		kind: row.kind === "acp" ? "acp" : "composer",
		agentId: row.agent_id,
		agentName: agentName ?? row.agent_name ?? builtin?.name ?? null,
		instruction: row.instruction,
		status: [
			"queued",
			"running",
			"done",
			"failed",
			"stopped"
		].includes(row.status) ? row.status : "failed",
		text: row.result_text,
		edits,
		error: row.error,
		createdAt: asIso(row.created_at),
		finishedAt: row.finished_at ? asIso(row.finished_at) : null
	};
}
async function loadJobs(userId) {
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	return (await (await getSql())`
    select j.id, j.kind, j.agent_id, j.instruction, j.status, j.result_text, j.result_edits,
           j.error, j.created_at, j.finished_at, a.name as agent_name
    from user_jobs j
    left join user_agents a on a.id = j.agent_id
    where j.user_id = ${userId}
    order by j.created_at desc
    limit 30
  `).map((row) => toRecord(row, row.agent_name ?? null));
}
async function planOf(userId) {
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	const rows = await (await getSql())`select plan from user_settings where user_id = ${userId}`;
	return planById(rows[0]?.plan ?? "hobby");
}
var listJobs_createServerFn_handler = createServerRpc({
	id: "2545e838152aebcc44ecadc566d3d3c7a5086bb0080a371b67dff82079e39e6a",
	name: "listJobs",
	filename: "src/lib/jobs/api.ts"
}, (opts) => listJobs.__executeServer(opts));
var listJobs = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(listJobs_createServerFn_handler, async ({ context }) => loadJobs(context.userId));
var startJob_createServerFn_handler = createServerRpc({
	id: "45eee6b45f13cc2c0aafd492fabcb4c4120d8ed3a7b9f7df7944466fbf99c0d5",
	name: "startJob",
	filename: "src/lib/jobs/api.ts"
}, (opts) => startJob.__executeServer(opts));
var startJob = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(startJob_createServerFn_handler, async ({ context, data }) => {
	const plan = await planOf(context.userId);
	if (plan.backgroundJobs <= 0) throw new Error("Background jobs are on Pro. Composer in the panel still runs on Hobby.");
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const live = await sql`
      select count(*)::int as n from user_jobs
      where user_id = ${context.userId} and status in ('queued', 'running')
    `;
	if (Number(live[0]?.n ?? 0) >= plan.backgroundJobs) throw new Error(`Queue full (${plan.backgroundJobs} of ${plan.backgroundJobs} background ${plan.backgroundJobs === 1 ? "job" : "jobs"} on ${plan.name}).`);
	const { sanitizeAgentInput } = await import("./agent-guard.server-DAZJvnkN.mjs");
	const clean = sanitizeAgentInput(data);
	if ("error" in clean) throw new Error(clean.error);
	let agentName = null;
	const agentId = typeof data.agentId === "string" && data.agentId ? data.agentId : null;
	if (agentId) {
		if (!plan.acp) throw new Error("External agents are on Pro.");
		if (isBuiltinAgentId(agentId)) agentName = builtinById(agentId)?.name ?? "ACP";
		else {
			const agents = await sql`
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
	const { runJob } = await import("./runner.server-_o7FE68r.mjs");
	runJob(id, context.userId, {
		...clean,
		agentId
	}, agentId);
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
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		finishedAt: null
	};
});
var cancelJob_createServerFn_handler = createServerRpc({
	id: "e54b9f52e92fd0ce5c89cc29868ce677b67be7b8d0ad8342d78166a538cfdfe0",
	name: "cancelJob",
	filename: "src/lib/jobs/api.ts"
}, (opts) => cancelJob.__executeServer(opts));
var cancelJob = createServerFn({ method: "POST" }).validator((id) => id).middleware([authMiddleware]).handler(cancelJob_createServerFn_handler, async ({ context, data: id }) => {
	const { abortJob } = await import("./runner.server-_o7FE68r.mjs");
	abortJob(id);
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	await (await getSql())`
      update user_jobs
      set status = 'stopped', error = 'Stopped.', finished_at = now()
      where id = ${id} and user_id = ${context.userId} and status in ('queued', 'running')
    `;
	return loadJobs(context.userId);
});
//#endregion
export { cancelJob_createServerFn_handler, listJobs_createServerFn_handler, startJob_createServerFn_handler };
