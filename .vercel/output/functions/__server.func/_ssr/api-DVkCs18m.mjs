import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware--02wTOzZ.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-DVkCs18m.js
var getAiStatus_createServerFn_handler = createServerRpc({
	id: "f06e765097cd01ae1f0ecd38bb7749a1bdb7f0e3a10daf23cb1bb01a7a37343a",
	name: "getAiStatus",
	filename: "src/lib/agent/api.ts"
}, (opts) => getAiStatus.__executeServer(opts));
var getAiStatus = createServerFn({ method: "POST" }).handler(getAiStatus_createServerFn_handler, async () => {
	return { available: Boolean(process.env.XAI_API_KEY) };
});
var runAgent_createServerFn_handler = createServerRpc({
	id: "5a883aeda48a7c277fc8d161d1c2939700d59765653c6b0c344daba878a2fb56",
	name: "runAgent",
	filename: "src/lib/agent/api.ts"
}, (opts) => runAgent.__executeServer(opts));
var runAgent = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(runAgent_createServerFn_handler, async ({ data, context }) => {
	const { sanitizeAgentInput } = await import("./agent-guard.server-65Xkw4Dy.mjs");
	const input = sanitizeAgentInput(data);
	if ("error" in input) return {
		ok: false,
		error: input.error
	};
	const { resolveModel, recordAgentRun } = await import("./api-B6IoZzRV.mjs").then((n) => n.t).then((n) => n.t);
	const resolved = await resolveModel(context.userId, input.source);
	if (!resolved.ok) return {
		ok: false,
		error: resolved.error
	};
	const { runAgentLoop } = await import("./loop.server-BgmUmT0P.mjs");
	const result = await runAgentLoop(input, {
		provider: resolved.provider,
		apiKey: resolved.apiKey
	});
	if (result.ok) await recordAgentRun(context.userId, resolved.hosted, resolved.cents);
	return result;
});
//#endregion
export { getAiStatus_createServerFn_handler, runAgent_createServerFn_handler };
