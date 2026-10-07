import { createFileRoute } from "@tanstack/react-router";
import { version } from "../../../package.json";

/** A little over the check's own character limit, for the JSON around it. */
const MAX_BODY_CHARS = 3_000_000;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

const notAllowed = () =>
  new Response("Aperture's MCP server answers POST only.", {
    status: 405,
    headers: { Allow: "POST" },
  });

/** The account behind the request's agent token, or the refusal to send. */
async function admit(request: Request): Promise<string | Response> {
  const { PROTOCOL_VERSIONS } = await import("@/lib/mcp-server/protocol");
  const { bearerToken } = await import("@/lib/mcp-server/tokens");
  const { userForAgentToken } = await import("@/lib/mcp-server/tokens.server");
  // A browser page on another site has no business here (DNS rebinding, stray fetches).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Forbidden origin" }, 403);
  const asked = request.headers.get("mcp-protocol-version");
  if (asked && !(PROTOCOL_VERSIONS as readonly string[]).includes(asked)) {
    return json({ error: `Unsupported MCP protocol version ${asked.slice(0, 40)}` }, 400);
  }
  const token = bearerToken(request.headers.get("authorization"));
  const userId = token ? await userForAgentToken(token) : null;
  if (userId) return userId;
  return json(
    {
      error:
        "Make a token in Aperture under Settings → Agents → Connect an agent, and send it as Authorization: Bearer <token>.",
    },
    401,
    { "WWW-Authenticate": 'Bearer realm="aperture"' },
  );
}

/**
 * Aperture's MCP server. Agents sign in with a token from Settings → Agents,
 * never a browser session: cookies are ignored here, so another site cannot
 * make a signed-in visitor's browser call it.
 */
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { overLimit } = await import("@/lib/security/rate-limit");
        const admitted = await admit(request);
        if (admitted instanceof Response) return admitted;
        const userId = admitted;
        // Counted per tools/call, so initialize and tools/list do not use it up.
        const busy = () => overLimit("agentChecks", userId);

        const raw = await request.text();
        if (raw.length > MAX_BODY_CHARS) return json({ error: "Too large" }, 413);
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return json(
            { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
            400,
          );
        }

        const { handleMessage } = await import("@/lib/mcp-server/protocol");
        const { checkChange } = await import("@/lib/mcp-server/check.server");
        const ctx = { version, check: checkChange, busy };
        if (Array.isArray(body)) {
          const replies = (
            await Promise.all(body.slice(0, 20).map((message) => handleMessage(message, ctx)))
          ).filter(Boolean);
          return replies.length > 0 ? json(replies) : new Response(null, { status: 202 });
        }
        const answer = await handleMessage(body, ctx);
        return answer ? json(answer) : new Response(null, { status: 202 });
      },
      GET: notAllowed,
      DELETE: notAllowed,
    },
  },
});
