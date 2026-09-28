import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { acpAgentNames, isAcpKind, type AcpKind } from "./kinds";

export type AgentConnection = {
  id: string;
  name: string;
  kind: AcpKind;
  endpoint: string;
  hasToken: boolean;
  createdAt: string;
};

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function cleanEndpoint(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Endpoint must be http or https.");
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") {
    throw new Error("Use a reachable bridge URL, not loopback from this editor.");
  }
  if (url.username || url.password) {
    throw new Error("Put the token in the token field, not in the URL.");
  }
  return url.toString();
}

export const listAgents = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AgentConnection[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      kind: string;
      endpoint: string;
      token_enc: string | null;
      created_at: unknown;
    }>`
      select id, name, kind, endpoint, token_enc, created_at
      from user_agents where user_id = ${context.userId}
      order by created_at desc
    `;
    return rows
      .filter((row) => isAcpKind(row.kind))
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind as AcpKind,
        endpoint: row.endpoint,
        hasToken: Boolean(row.token_enc),
        createdAt: asIso(row.created_at),
      }));
  });

export const saveAgent = createServerFn({ method: "POST" })
  .validator((input: { name: string; kind: AcpKind; endpoint: string; token: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<AgentConnection[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { planById } = await import("@/lib/billing/plans");
    const { spendOwnerId } = await import("@/lib/auth/visitor");
    const settings = await sql<{ plan: string }>`select plan from user_settings where user_id = ${spendOwnerId(context.userId)}`;
    if (!planById(settings[0]?.plan ?? "hobby").acp) {
      throw new Error(
        `External agents are on Pro. Upgrade to plug ${acpAgentNames("or")} into the same diff UI.`,
      );
    }
    if (!isAcpKind(data.kind)) throw new Error("Unknown agent kind.");
    const name = data.name.trim().slice(0, 80);
    if (name.length < 2) throw new Error("Name the agent.");
    const endpoint = cleanEndpoint(data.endpoint);
    const count = await sql<{ n: number }>`
      select count(*)::int as n from user_agents where user_id = ${context.userId}
    `;
    if (Number(count[0]?.n ?? 0) >= 8) {
      throw new Error("Eight agents is the cap. Remove one first.");
    }
    const { encryptSecret } = await import("@/lib/security/secrets.server");
    const token = data.token.trim();
    const tokenEnc = token ? encryptSecret(token.slice(0, 256)) : null;
    const id = `ag_${crypto.randomUUID()}`;
    await sql`
      insert into user_agents (id, user_id, name, kind, endpoint, token_enc)
      values (${id}, ${context.userId}, ${name}, ${data.kind}, ${endpoint}, ${tokenEnc})
    `;
    const rows = await sql<{
      id: string;
      name: string;
      kind: string;
      endpoint: string;
      token_enc: string | null;
      created_at: unknown;
    }>`
      select id, name, kind, endpoint, token_enc, created_at
      from user_agents where user_id = ${context.userId}
      order by created_at desc
    `;
    return rows
      .filter((row) => isAcpKind(row.kind))
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind as AcpKind,
        endpoint: row.endpoint,
        hasToken: Boolean(row.token_enc),
        createdAt: asIso(row.created_at),
      }));
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }): Promise<AgentConnection[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from user_agents where id = ${id} and user_id = ${context.userId}`;
    return listAgents();
  });
