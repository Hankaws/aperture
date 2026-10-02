import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const mcpStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listMcpViews } = await import("./account.server");
    return listMcpViews(context.userId);
  });

export const saveMcpServer = createServerFn({ method: "POST" })
  .validator((input: { name: string; url: string; token?: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { addMcpServer } = await import("./account.server");
    return addMcpServer(context.userId, data);
  });

export const removeMcpServer = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { deleteMcpServer } = await import("./account.server");
    return deleteMcpServer(context.userId, data.id);
  });

export const confirmMcpCall = createServerFn({ method: "POST" })
  .validator((input: { server: string; tool: string; args: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { runConfirmedMcp } = await import("./account.server");
    return runConfirmedMcp(context.userId, data);
  });
