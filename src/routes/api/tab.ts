import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tab")({
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

        const { rateLimit } = await import("@/lib/security/agent-guard.server");
        if (!rateLimit(`tab:${userId}`, 20, 60_000)) {
          return Response.json({ text: "" }, { status: 200 });
        }

        const raw = await request.text();
        if (raw.length > 20_000) {
          return Response.json({ error: "Too large" }, { status: 413 });
        }
        let body: { path?: string; prefix?: string; suffix?: string };
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { safeRelPath } = await import("@/lib/security/redact");
        const path = typeof body.path === "string" ? safeRelPath(body.path) : null;
        const prefix = typeof body.prefix === "string" ? body.prefix.slice(-2800) : "";
        const suffix = typeof body.suffix === "string" ? body.suffix.slice(0, 400) : "";
        if (!path || prefix.length < 8) {
          return Response.json({ text: "" });
        }

        const { tabCacheGet, tabCacheKey, tabCacheSet, completeTab } = await import("@/lib/agent/tab.server");
        const cacheKey = tabCacheKey(path, prefix, suffix);
        const cached = tabCacheGet(cacheKey);
        if (cached !== null) {
          return Response.json({ text: cached });
        }

        const { resolveTabModel, recordTabUse } = await import("@/lib/billing/api");
        const resolved = await resolveTabModel(userId);
        if (!resolved.ok) {
          return Response.json({ error: resolved.error, text: "" }, { status: 200 });
        }
        // Replay has nothing recorded for ghost text (resolveTabModel already refuses it).
        if (resolved.provider === "replay") return Response.json({ text: "" });

        try {
          const text = await completeTab(
            { provider: resolved.provider, apiKey: resolved.apiKey },
            { path, prefix, suffix },
            request.signal,
          );
          tabCacheSet(cacheKey, text);
          if (text) await recordTabUse(userId, resolved.hosted);
          return Response.json({ text });
        } catch {
          return Response.json({ text: "" });
        }
      },
    },
  },
});
