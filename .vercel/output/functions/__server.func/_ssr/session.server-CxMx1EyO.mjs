import { a as builtinById, c as isBuiltinAgentId } from "./kinds-CCf1JBpH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session.server-CxMx1EyO.js
async function runAcpSession(input, opts) {
	const agentId = input.agentId ?? "";
	if (!agentId) return {
		ok: false,
		error: "No ACP agent selected."
	};
	if (isBuiltinAgentId(agentId)) {
		const builtin = builtinById(agentId);
		opts.emit({
			type: "status",
			text: `ACP session/new · ${builtin?.name ?? "agent"}`
		});
		const { resolveModel, recordAgentRun } = await import("./api-B6IoZzRV.mjs").then((n) => n.t).then((n) => n.t);
		const resolved = await resolveModel(opts.userId, input.source);
		if (!resolved.ok) return {
			ok: false,
			error: resolved.error
		};
		const { runAgentLoopStreaming } = await import("./loop.server-BgmUmT0P.mjs");
		const result = await runAgentLoopStreaming(input, {
			provider: resolved.provider,
			apiKey: resolved.apiKey
		}, opts.emit, opts.signal);
		if (result.ok) await recordAgentRun(opts.userId, resolved.hosted, resolved.cents);
		return {
			...result,
			hosted: resolved.hosted,
			cents: resolved.cents
		};
	}
	const { getSql } = await import("./db-jfZYM_zr.mjs").then((n) => n.t).then((n) => n.t);
	const agent = (await (await getSql())`
    select endpoint, token_enc, name from user_agents where id = ${agentId} and user_id = ${opts.userId}
  `)[0];
	if (!agent) return {
		ok: false,
		error: "Agent not found."
	};
	const { decryptSecret } = await import("./secrets.server-tdshO19Z.mjs");
	const token = decryptSecret(agent.token_enc);
	const { runRemoteAcp } = await import("./http-CLv2z8Jt.mjs");
	return runRemoteAcp(agent.endpoint, token, agent.name, input, opts.emit, opts.signal);
}
//#endregion
export { runAcpSession };
