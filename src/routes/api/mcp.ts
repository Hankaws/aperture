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

/** A refusal before the body is read: another site's page, or a protocol version we do not speak. */
async function screen(request: Request): Promise<Response | null> {
  const { PROTOCOL_VERSIONS } = await import("@/lib/mcp-server/protocol");
  // A browser page on another site has no business here (DNS rebinding, stray fetches).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Forbidden origin" }, 403);
  const asked = request.headers.get("mcp-protocol-version");
  if (asked && !(PROTOCOL_VERSIONS as readonly string[]).includes(asked)) {
    return json({ error: `Unsupported MCP protocol version ${asked.slice(0, 40)}` }, 400);
  }
  return null;
}

/** The account behind the request's agent token, or null. */
async function signedIn(request: Request): Promise<string | null> {
  const { bearerToken } = await import("@/lib/mcp-server/tokens");
  const { userForAgentToken } = await import("@/lib/mcp-server/tokens.server");
  const token = bearerToken(request.headers.get("authorization"));
  return token ? await userForAgentToken(token) : null;
}

/**
 * Aperture's MCP server. Agents sign in with a token from Settings → Agents,
 * never a browser session: cookies are ignored here, so another site cannot
 * make a signed-in visitor's browser call it. initialize, ping and tools/list
 * answer without a token (the same static answer for everyone); a body with
 * any other method, tools/call above all, gets a 401 without one.
 */
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { overLimit } = await import("@/lib/security/rate-limit");
        const refused = await screen(request);
        if (refused) return refused;

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

        const { serve } = await import("@/lib/mcp-server/protocol");
        const { checkChange } = await import("@/lib/mcp-server/check.server");
        const served = await serve(
          body,
          () => signedIn(request),
          (userId) => ({
            version,
            check: checkChange,
            // Counted per tools/call, so initialize and tools/list do not use it up.
            // No tools/call runs without an account; refuse rather than count nothing.
            busy: () =>
              userId ? overLimit("agentChecks", userId) : "This call needs an agent token.",
          }),
        );
        if (served.status === 202) return new Response(null, { status: 202 });
        return json(
          served.body,
          served.status,
          served.status === 401 ? { "WWW-Authenticate": 'Bearer realm="aperture"' } : {},
        );
      },
      GET: notAllowed,
      DELETE: notAllowed,
    },
  },
});
