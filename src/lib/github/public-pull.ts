/**
 * Check anyone's public pull request from its link (`public-pull.server.ts`
 * reads it, `public-check.ts` judges it). Open to signed-out visitors: it
 * reads only what GitHub serves to everyone and stores nothing per person.
 * A signed-in person's GitHub token, or the deployment's read token, is used
 * only when the diff has to come from GitHub's API.
 */
import { createServerFn } from "@tanstack/react-start";
import { publicCallerMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { publicPullInput } from "@/lib/security/inputs";
import { parsePullLink, pullLinkFromPath } from "./pull-link";
import type { PublicCheckResult } from "./public-pull.server";

export type { PublicCheckResult, PublicPull } from "./public-pull.server";

const reader = () => import("./public-pull.server");

export const checkPublicPull = createServerFn({ method: "POST" })
  .validator(publicPullInput)
  .middleware([publicCallerMiddleware])
  .handler(async ({ data, context }): Promise<PublicCheckResult> => {
    const link = parsePullLink(data.pr) ?? pullLinkFromPath(data.pr);
    if (!link)
      return {
        ok: false,
        error:
          "That is not a pull request link. Paste one like https://github.com/owner/repo/pull/12.",
      };
    const { callerAddress, readAndCheck } = await reader();
    const userId = context.userId;
    const busy =
      overLimit("publicCheck", userId ?? `ip:${callerAddress()}`) ??
      (userId ? null : overLimit("publicCheckAll", "everyone"));
    if (busy) return { ok: false, error: busy };
    let token: string | null = null;
    if (userId) {
      try {
        const { accountToken } = await import("./bot-github.server");
        token = await accountToken(userId);
      } catch {
        token = null;
      }
    }
    token ??= process.env.APERTURE_GITHUB_READ_TOKEN?.trim() || null;
    try {
      return await readAndCheck(link, token);
    } catch (error) {
      console.error("[public-check]", error);
      return {
        ok: false,
        error: "Could not read that pull request from GitHub. Try again in a moment.",
      };
    }
  });
