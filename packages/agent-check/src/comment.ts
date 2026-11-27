/**
 * The one comment Agent Check keeps on a pull request, when the workflow
 * turns it on (`comment: true`): found by its marker and updated in place,
 * so a pull request pushed ten times still has one. It is the only thing
 * the action sends anywhere, through GitHub's own API with the workflow's
 * token, and it never fails the run: without `pull-requests: write`, or on a
 * fork's pull request, it says how to turn it on and the checks stand.
 */
import { COMMENT_MARKER } from "./report.ts";

export type CommentTarget = {
  /** GitHub's API, `GITHUB_API_URL`: api.github.com, or a GitHub Enterprise server. */
  api: string;
  token: string;
  repo: string;
  number: number;
};

export type CommentOutcome =
  { ok: true; action: "created" | "updated" } | { ok: false; note: string };

type Fetch = typeof fetch;

/** What to tell the person when GitHub refused, in a line they can act on. */
export function refusalNote(status: number): string {
  if (status === 403 || status === 404)
    return "Not posted: the workflow's token cannot write to the pull request. Add \"permissions: pull-requests: write\" to the job (a fork's pull request never can). The checks above are unaffected.";
  if (status === 401)
    return "Not posted: GitHub did not accept the token. The checks above are unaffected.";
  return `Not posted: GitHub answered ${status}. The checks above are unaffected.`;
}

export async function upsertComment(
  target: CommentTarget,
  body: string,
  fetchImpl: Fetch = fetch,
): Promise<CommentOutcome> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${target.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "aperture-agent-check",
  };
  const base = `${target.api.replace(/\/$/, "")}/repos/${target.repo}/issues`;
  try {
    let existing: number | null = null;
    // A busy pull request can have many comments; ours is looked for in the first 300.
    for (let page = 1; page <= 3 && existing === null; page += 1) {
      const res = await fetchImpl(`${base}/${target.number}/comments?per_page=100&page=${page}`, {
        headers,
      });
      if (!res.ok) return { ok: false, note: refusalNote(res.status) };
      const comments = (await res.json()) as Array<{ id: number; body?: string | null }>;
      existing = comments.find((c) => (c.body ?? "").startsWith(COMMENT_MARKER))?.id ?? null;
      if (comments.length < 100) break;
    }
    const res = existing
      ? await fetchImpl(`${base}/comments/${existing}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ body }),
        })
      : await fetchImpl(`${base}/${target.number}/comments`, {
          method: "POST",
          headers,
          body: JSON.stringify({ body }),
        });
    if (!res.ok) return { ok: false, note: refusalNote(res.status) };
    return { ok: true, action: existing ? "updated" : "created" };
  } catch (error) {
    return {
      ok: false,
      note: `Not posted: ${error instanceof Error ? error.message : String(error)}. The checks above are unaffected.`,
    };
  }
}
