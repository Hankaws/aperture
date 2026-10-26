import { createFileRoute } from "@tanstack/react-router";
import type { AgentStreamEvent } from "@/lib/agent/events";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        try {
          assertSameSiteRequest();
        } catch {
          return new Response("Forbidden", { status: 403 });
        }

        // Signed in, or signed out on a replay deployment (the public demo), where runs cost nothing.
        const { agentCaller } = await import("@/lib/agent/public-demo.server");
        const caller = await agentCaller(request);
        if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { userId, signedOut } = caller;

        const { MAX_AGENT_BODY, sanitizeAgentInput } = await import("@/lib/security/agent-guard.server");
        const { overLimit } = await import("@/lib/security/rate-limit");
        const busy = overLimit("composer", userId) ?? (signedOut ? overLimit("demo", "signed-out") : null);
        if (busy) return Response.json({ error: busy }, { status: 429 });

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
        // A request may carry only what changed since the saved copy: make it whole first.
        if (parsed && typeof parsed === "object" && "base" in parsed) {
          const { expandAgentFiles } = await import("@/lib/workspace/agent-base");
          const { RESEND_FILES } = await import("@/lib/agent/wire");
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          const whole = await expandAgentFiles(
            (text, params) => sql.query(text, params),
            parsed as Record<string, unknown>,
            signedOut ? null : userId,
          );
          if (!whole.ok) return Response.json({ error: RESEND_FILES, resend: true }, { status: 409 });
          parsed = whole.raw;
        }
        const input = sanitizeAgentInput(parsed);
        if ("error" in input) {
          return Response.json({ error: input.error }, { status: 400 });
        }

        // External agents run on their own accounts: they are for people who signed in.
        if (signedOut && input.agentId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (input.agentId) {
          const { planFor } = await import("@/lib/billing/plan.server");
          const { acpAgentNames } = await import("@/lib/acp/kinds");
          if (!(await planFor(userId)).acp) {
            return Response.json(
              {
                error: `External agents (${acpAgentNames("or")}) are not on this plan.`,
              },
              { status: 403 },
            );
          }
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const emit = (event: AgentStreamEvent) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                // stream already closed
              }
            };
            try {
              if (input.agentId) {
                const { runAcpSession } = await import("@/lib/acp/session.server");
                await runAcpSession(input, { userId, emit, signal: request.signal });
              } else {
                const { resolveModel, recordAgentRun, canAffordRuns } = await import("@/lib/billing/api");
                const resolved = await resolveModel(userId, input.source);
                if (!resolved.ok) {
                  emit({ type: "error", error: resolved.error });
                  return;
                }
                const { runComposerStreaming } = await import("@/lib/agent/fanout.server");
                const { result, bills } = await runComposerStreaming(
                  input,
                  {
                    provider: resolved.provider,
                    apiKey: resolved.apiKey,
                    base: resolved.base,
                    model: resolved.model,
                    hosted: resolved.hosted,
                    cents: resolved.cents,
                    // Without it the agent cannot run the project's checks: runs are per account.
                    userId,
                  },
                  emit,
                  request.signal,
                  (n) => canAffordRuns(userId, resolved.source, n),
                  async (source) => {
                    const extra = await resolveModel(userId, source ?? resolved.source);
                    if (!extra.ok) throw new Error(extra.error);
                    return {
                      provider: extra.provider,
                      apiKey: extra.apiKey,
                      base: extra.base,
                      model: extra.model,
                      hosted: extra.hosted,
                      cents: extra.cents,
                    };
                  },
                );
                if (result.ok && !signedOut) {
                  for (const bill of bills) {
                    await recordAgentRun(userId, bill.hosted, bill.cents);
                  }
                }
              }
            } catch (error) {
              const aborted =
                request.signal.aborted ||
                (error instanceof Error && (error.name === "AbortError" || error.message === "This operation was aborted"));
              if (aborted) return;
              const message = error instanceof Error ? error.message : "Agent failed";
              emit({ type: "error", error: message });
            } finally {
              try {
                controller.close();
              } catch {
                // already closed
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            ...(signedOut?.cookie ? { "Set-Cookie": signedOut.cookie } : {}),
          },
        });
      },
    },
  },
});
