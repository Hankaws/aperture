import { createFileRoute } from "@tanstack/react-router";
import type { PrivateChatEvent } from "@/lib/bot/private-chat-stream";

/** A turn's request is its turns: 60 at most, each clipped, so well under this. */
const MAX_BODY = 1_500_000;

/**
 * One turn of Aperture Bot's private chat, its answer streamed as the model
 * writes it, as server-sent events (`PrivateChatEvent`): the text as it
 * comes, then the whole reply and the lines it offers to remember. Who may
 * call it, and what it spends, are the `privateChat` server function's.
 */
export const Route = createFileRoute("/api/private-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        try {
          assertSameSiteRequest();
        } catch {
          return new Response("Forbidden", { status: 403 });
        }
        const { requireUserId, UnauthorizedError } = await import("@/lib/auth/verify.server");
        const header = request.headers.get("authorization");
        let userId: string;
        try {
          userId = await requireUserId(header?.startsWith("Bearer ") ? header.slice(7) : undefined);
        } catch (error) {
          if (!(error instanceof UnauthorizedError)) throw error;
          return Response.json({ error: "Sign in to talk to the bot." }, { status: 401 });
        }
        const raw = await request.text();
        if (raw.length > MAX_BODY)
          return Response.json({ error: "That conversation is too long." }, { status: 413 });
        const { privateChatInput } = await import("@/lib/security/inputs");
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const input = privateChatInput.safeParse(body);
        if (!input.success) return Response.json({ error: "Invalid request" }, { status: 400 });

        const { runPrivateChat } = await import("@/lib/bot/private-chat.server");
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const emit = (event: PrivateChatEvent) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                // The reader went away.
              }
            };
            try {
              const out = await runPrivateChat(userId, input.data.turns, {
                onText: (text) => emit({ type: "text", text }),
                signal: request.signal,
                botName: input.data.botName,
              });
              if (!request.signal.aborted)
                emit(
                  out.ok
                    ? { type: "done", reply: out.reply, memories: out.memories }
                    : { type: "error", error: out.error },
                );
            } catch (error) {
              if (!request.signal.aborted)
                emit({
                  type: "error",
                  error: error instanceof Error ? error.message : "The model could not answer.",
                });
            } finally {
              try {
                controller.close();
              } catch {
                // Already closed.
              }
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
