import { o as isAcpKind } from "./kinds-CCf1JBpH.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-BW7VTtXx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-COWLm3TA.js
function asIso(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return (/* @__PURE__ */ new Date()).toISOString();
}
function cleanEndpoint(raw) {
	const url = new URL(raw.trim());
	if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Endpoint must be http or https.");
	if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") throw new Error("Use a reachable bridge URL, not loopback from this editor.");
	if (url.username || url.password) throw new Error("Put the token in the token field, not in the URL.");
	return url.toString();
}
var listAgents_createServerFn_handler = createServerRpc({
	id: "a430df19b5efe91a0f9600ce19408af2615612b26ad11b3b036ce38a1a25313d",
	name: "listAgents",
	filename: "src/lib/acp/api.ts"
}, (opts) => listAgents.__executeServer(opts));
var listAgents = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(listAgents_createServerFn_handler, async ({ context }) => {
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	return (await (await getSql())`
      select id, name, kind, endpoint, token_enc, created_at
      from user_agents where user_id = ${context.userId}
      order by created_at desc
    `).filter((row) => isAcpKind(row.kind)).map((row) => ({
		id: row.id,
		name: row.name,
		kind: row.kind,
		endpoint: row.endpoint,
		hasToken: Boolean(row.token_enc),
		createdAt: asIso(row.created_at)
	}));
});
var saveAgent_createServerFn_handler = createServerRpc({
	id: "e6c3bf3bc595548ea8ace93cb611972e3b1a86c99ba1031fb682662ee2b6d328",
	name: "saveAgent",
	filename: "src/lib/acp/api.ts"
}, (opts) => saveAgent.__executeServer(opts));
var saveAgent = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(saveAgent_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const { planById } = await import("./plans-CTIRB29R.mjs").then((n) => n.o).then((n) => n.o);
	if (!planById((await sql`select plan from user_settings where user_id = ${context.userId}`)[0]?.plan ?? "hobby").acp) throw new Error("External agents are on Pro. Upgrade to plug Claude Code, Codex, or OpenCode into the same diff UI.");
	if (!isAcpKind(data.kind)) throw new Error("Unknown agent kind.");
	const name = data.name.trim().slice(0, 80);
	if (name.length < 2) throw new Error("Name the agent.");
	const endpoint = cleanEndpoint(data.endpoint);
	const count = await sql`
      select count(*)::int as n from user_agents where user_id = ${context.userId}
    `;
	if (Number(count[0]?.n ?? 0) >= 8) throw new Error("Eight agents is the cap. Remove one first.");
	const { encryptSecret } = await import("./secrets.server-DFD2PEJ-.mjs");
	const token = data.token.trim();
	const tokenEnc = token ? encryptSecret(token.slice(0, 256)) : null;
	await sql`
      insert into user_agents (id, user_id, name, kind, endpoint, token_enc)
      values (${`ag_${crypto.randomUUID()}`}, ${context.userId}, ${name}, ${data.kind}, ${endpoint}, ${tokenEnc})
    `;
	return (await sql`
      select id, name, kind, endpoint, token_enc, created_at
      from user_agents where user_id = ${context.userId}
      order by created_at desc
    `).filter((row) => isAcpKind(row.kind)).map((row) => ({
		id: row.id,
		name: row.name,
		kind: row.kind,
		endpoint: row.endpoint,
		hasToken: Boolean(row.token_enc),
		createdAt: asIso(row.created_at)
	}));
});
var deleteAgent_createServerFn_handler = createServerRpc({
	id: "929b5a97545f35697cc70309886683070923d23416598b9474e0888b7580102c",
	name: "deleteAgent",
	filename: "src/lib/acp/api.ts"
}, (opts) => deleteAgent.__executeServer(opts));
var deleteAgent = createServerFn({ method: "POST" }).validator((id) => id).middleware([authMiddleware]).handler(deleteAgent_createServerFn_handler, async ({ context, data: id }) => {
	const { getSql } = await import("./db-2laMynzA.mjs").then((n) => n.t).then((n) => n.t);
	await (await getSql())`delete from user_agents where id = ${id} and user_id = ${context.userId}`;
	return listAgents();
});
//#endregion
export { deleteAgent_createServerFn_handler, listAgents_createServerFn_handler, saveAgent_createServerFn_handler };
