import { a as builtinById, c as isBuiltinAgentId } from "./kinds-CCf1JBpH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session.server-CQCViHN9.js
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
		const { resolveModel, recordAgentRun, canAffordRuns } = await import("./api-CT8K4ti-.mjs").then((n) => n.t);
		const resolved = await resolveModel(opts.userId, input.source);
		if (!resolved.ok) return {
			ok: false,
			error: resolved.error
		};
		const { runComposerStreaming } = await import("./fanout.server-Dhf9pPOp.mjs");
		const { result, bills } = await runComposerStreaming(input, {
			provider: resolved.provider,
			apiKey: resolved.apiKey,
			hosted: resolved.hosted,
			cents: resolved.cents
		}, opts.emit, opts.signal, (n) => canAffordRuns(opts.userId, resolved.source, n));
		if (result.ok) for (const bill of bills) await recordAgentRun(opts.userId, bill.hosted, bill.cents);
		return {
			...result,
			hosted: resolved.hosted,
			cents: resolved.cents
		};
	}
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	const agent = (await (await getSql())`
    select endpoint, token_enc, name from user_agents where id = ${agentId} and user_id = ${opts.userId}
  `)[0];
	if (!agent) return {
		ok: false,
		error: "Agent not found."
	};
	const { decryptSecret } = await import("./secrets.server-DFD2PEJ-.mjs");
	const token = decryptSecret(agent.token_enc);
	const { runRemoteAcp } = await import("./http-CLv2z8Jt.mjs");
	return runRemoteAcp(agent.endpoint, token, agent.name, input, opts.emit, opts.signal);
}
//#endregion
export { runAcpSession };
