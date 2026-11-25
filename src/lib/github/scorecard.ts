/**
 * The agent scorecard for one repository (`bot/scorecard.ts`): its closed
 * pull requests, read with the person's own GitHub token, scored on the
 * server. At most three pages of 100, newest first, stopping once they are
 * older than the window and the fixes that could follow it.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { agentScorecardInput } from "@/lib/security/inputs";
import { FIX_DAYS, scorecard, type PullSummary, type Scorecard } from "@/lib/bot/scorecard";
import { parseGithubUrl } from "./parse";

const github = () => import("./bot-github.server");

const API = "https://api.github.com";
const DAYS = 90;
const PAGES = 3;
const DAY = 86_400_000;

export type AgentScorecardResult =
  { ok: true; repo: string; card: Scorecard } | { ok: false; error: string };

type RawPull = {
  number?: unknown;
  title?: unknown;
  body?: unknown;
  user?: { login?: unknown; type?: unknown } | null;
  created_at?: unknown;
  updated_at?: unknown;
  merged_at?: unknown;
};

function summary(raw: RawPull): PullSummary | null {
  if (
    typeof raw.number !== "number" ||
    typeof raw.title !== "string" ||
    typeof raw.created_at !== "string"
  )
    return null;
  return {
    number: raw.number,
    title: raw.title,
    body: typeof raw.body === "string" ? raw.body.slice(0, 4000) : null,
    author: typeof raw.user?.login === "string" ? raw.user.login : "",
    ...(typeof raw.user?.type === "string" ? { authorType: raw.user.type } : {}),
    createdAt: raw.created_at,
    mergedAt: typeof raw.merged_at === "string" ? raw.merged_at : null,
  };
}

export const agentScorecard = createServerFn({ method: "POST" })
  .validator(agentScorecardInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<AgentScorecardResult> => {
    const busy = overLimit("bot", context.userId);
    if (busy) return { ok: false, error: busy };
    const parsed = parseGithubUrl(data.repo);
    if (!parsed || parsed.ref) return { ok: false, error: "That is not a repository name." };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const now = Date.now();
    const oldest = now - (DAYS + FIX_DAYS) * DAY;
    const pulls: PullSummary[] = [];
    try {
      for (let page = 1; page <= PAGES; page += 1) {
        const res = await githubJson(
          `${API}/repos/${parsed.owner}/${parsed.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
          token,
        );
        if (res.status === 401)
          return { ok: false, error: "GitHub rejected the token on your account." };
        if (res.status === 404)
          return { ok: false, error: "GitHub does not show that repository to your account." };
        if (res.status !== 200 || !Array.isArray(res.body))
          return { ok: false, error: `GitHub returned ${res.status}.` };
        const raws = res.body as RawPull[];
        for (const raw of raws) {
          const pull = summary(raw);
          if (pull) pulls.push(pull);
        }
        const last = raws.at(-1)?.updated_at;
        if (raws.length < 100 || (typeof last === "string" && Date.parse(last) < oldest)) break;
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
    return { ok: true, repo: `${parsed.owner}/${parsed.repo}`, card: scorecard(pulls, now, DAYS) };
  });
