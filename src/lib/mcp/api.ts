import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { mcpAddInput, mcpConfirmInput, mcpRemoveInput } from "@/lib/security/inputs";

export const mcpStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listMcpViews } = await import("./account.server");
    return listMcpViews(context.userId);
  });

export const saveMcpServer = createServerFn({ method: "POST" })
  .validator(mcpAddInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { addMcpServer } = await import("./account.server");
    return addMcpServer(context.userId, data);
  });

export const removeMcpServer = createServerFn({ method: "POST" })
  .validator(mcpRemoveInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { deleteMcpServer } = await import("./account.server");
    return deleteMcpServer(context.userId, data.id);
  });

export const confirmMcpCall = createServerFn({ method: "POST" })
  .validator(mcpConfirmInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { overLimit } = await import("@/lib/security/rate-limit");
    const busy = overLimit("mcp", context.userId);
    if (busy) return { ok: false as const, error: busy };
    const { runConfirmedMcp } = await import("./account.server");
    return runConfirmedMcp(context.userId, data);
  });
