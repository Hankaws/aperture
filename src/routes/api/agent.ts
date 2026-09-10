import { createFileRoute } from "@tanstack/react-router";
import type { AgentStreamEvent } from "@/lib/agent/events";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        const { requireUserId, UnauthorizedError } = await import("@/lib/auth/verify.server");
        try {
          assertSameSiteRequest();
        } catch {
          return new Response("Forbidden", { status: 403 });
        }

        let userId: string;
        try {
          const header = request.headers.get("authorization");
          const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
          userId = await requireUserId(bearer);
        } catch (error) {
          if (error instanceof UnauthorizedError || (error instanceof Error && error.message === "Unauthorized")) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          throw error;
        }

        const { MAX_AGENT_BODY, rateLimit, sanitizeAgentInput } = await import("@/lib/security/agent-guard.server");
        if (!rateLimit(userId)) {
          return Response.json({ error: "Too many Composer sends. Wait a few seconds." }, { status: 429 });
        }

        const raw = await request.text();
        if (raw.length > MAX_AGENT_BODY) {
          return Response.json({ error: "Request is too large." }, { status: 413 });
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const input = sanitizeAgentInput(parsed);
        if ("error" in input) {
          return Response.json({ error: input.error }, { status: 400 });
        }

        if (input.agentId) {
          const { planById } = await import("@/lib/billing/plans");
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          const settings = await sql<{ plan: string }>`select plan from user_settings where user_id = ${userId}`;
          if (!planById(settings[0]?.plan ?? "hobby").acp) {
            return Response.json(
              { error: "External agents are on Pro. Upgrade to run Claude Code, Codex, or OpenCode in this panel." },
              { status: 403 },
            );
          }
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const emit = (event: AgentStreamEvent) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };
            try {
              if (input.agentId) {
                const { runAcpSession } = await import("@/lib/acp/session.server");
                await runAcpSession(input, { userId, emit, signal: request.signal });
              } else {
                const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
                const resolved = await resolveModel(userId, input.source);
                if (!resolved.ok) {
                  emit({ type: "error", error: resolved.error });
                  return;
                }
                const { runAgentLoopStreaming } = await import("@/lib/agent/loop.server");
                const result = await runAgentLoopStreaming(
                  input,
                  { provider: resolved.provider, apiKey: resolved.apiKey },
                  emit,
                  request.signal,
                );
                if (result.ok) {
                  await recordAgentRun(userId, resolved.hosted, resolved.cents);
                }
              }
            } catch (error) {
              if (!request.signal.aborted) {
                const message = error instanceof Error ? error.message : "Agent failed";
                emit({ type: "error", error: message });
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
