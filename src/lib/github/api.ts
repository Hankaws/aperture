import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isSecretPath, safeRelPath } from "@/lib/security/redact";
import { overLimit } from "@/lib/security/rate-limit";
import { filesFromZipBuffer, MAX_ZIP_BYTES, type ImportResult } from "@/lib/workspace/project-files";
import { parseGithubUrl } from "./parse";
import { blobModes, cleanGithubToken, type GithubChange, type GithubSource } from "./roundtrip";
import { checksFromGithub, failureNotes, logExcerpt, overallState, type CiCheck, type CiOverall } from "./ci";
import {
  githubChecksInput,
  githubImportInput,
  githubListInput,
  githubMergeInput,
  githubPublishInput,
  githubReviewInput,
  githubSaveTokenInput,
} from "@/lib/security/inputs";

export type GithubImportResult =
  | (ImportResult & { ok: true; source: GithubSource | null })
  | { ok: false; error: string };

const GITHUB_HOSTS = new Set(["api.github.com", "codeload.github.com", "github.com"]);

/** One line, with control characters turned into spaces. */
function commitMessage(message: string, fallback: string): string {
  let out = "";
  for (const ch of message) {
    const code = ch.codePointAt(0) ?? 0;
    out += code <= 31 ? " " : ch;
  }
  return out.trim().slice(0, 200) || fallback;
}

async function fetchPinned(url: string, headers: Record<string, string>, hops = 0): Promise<Response> {
  if (hops > 4) throw new Error("Too many redirects from GitHub.");
  const parsed = new URL(url);
  if (!GITHUB_HOSTS.has(parsed.hostname)) {
    throw new Error("Unexpected download host.");
  }
  const res = await fetch(url, { headers, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error("GitHub redirect was empty.");
    return fetchPinned(new URL(loc, url).toString(), headers, hops + 1);
  }
  return res;
}

async function readCapped(res: Response, cap: number): Promise<ArrayBuffer> {
  const len = Number(res.headers.get("content-length") ?? "0");
  if (len > cap) {
    throw new Error("Repo archive is too large. Drop a folder instead.");
  }
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let used = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    used += value.byteLength;
    if (used > cap) throw new Error("Repo archive is too large. Drop a folder instead.");
    chunks.push(value);
  }
  const out = new Uint8Array(used);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

export const importGithubRepo = createServerFn({ method: "POST" })
  .validator(githubImportInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<GithubImportResult> => {
    const busy = overLimit("import", context.userId);
    if (busy) return { ok: false, error: busy };
    const parsed = parseGithubUrl(data.url);
    if (!parsed) {
      return { ok: false, error: "Use owner/repo or a github.com URL." };
    }
    const token = await useToken(context.userId, data.token);
    if (data.token && !token) return { ok: false, error: "That token does not look like a GitHub token." };
    const headers = githubHeaders(token);
    const zipUrl = parsed.ref
      ? `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball/${encodeURIComponent(parsed.ref)}`
      : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball`;
    let res: Response;
    try {
      res = await fetchPinned(zipUrl, headers);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach GitHub." };
    }
    if (res.status === 401) return { ok: false, error: "GitHub rejected that token." };
    if (res.status === 404) {
      return {
        ok: false,
        error: token ? "Repo not found, or the token cannot see it." : "Repo not found. Public repos work without a token.",
      };
    }
    if (res.status === 403) {
      return { ok: false, error: "GitHub rate limit. Wait a bit, or drop a folder / zip instead." };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub returned ${res.status}.` };
    }
    try {
      const buf = await readCapped(res, MAX_ZIP_BYTES);
      const imported = await filesFromZipBuffer(buf, parsed.repo);
      if (Object.keys(imported.files).length === 0) {
        return { ok: false, error: "No text files found in that repo (after skipping node_modules and binaries)." };
      }
      const source = await readSource(parsed.owner, parsed.repo, parsed.ref, headers);
    return { ok: true, ...imported, name: parsed.repo, source };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not unpack the repo." };
    }
  });

export type GithubRepoSummary = { fullName: string; private: boolean; branch: string };

export const listGithubRepos = createServerFn({ method: "POST" })
  .validator(githubListInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ ok: true; repos: GithubRepoSummary[] } | { ok: false; error: string }> => {
    const busy = overLimit("repos", context.userId);
    if (busy) return { ok: false, error: busy };
    const token = await useToken(context.userId, data.token);
    if (!token) return { ok: false, error: "Connect GitHub first. A token with repo access opens private repos." };
    const { status, body } = await githubJson(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      token,
    );
    if (status === 401) return { ok: false, error: "GitHub rejected that token." };
    if (status !== 200 || !Array.isArray(body)) return { ok: false, error: `GitHub returned ${status}.` };
    const repos = body.slice(0, 100).map((row) => {
      const rec = row as { full_name?: string; private?: boolean; default_branch?: string };
      return {
        fullName: String(rec.full_name ?? ""),
        private: Boolean(rec.private),
        branch: String(rec.default_branch ?? "main"),
      };
    });
    return { ok: true, repos: repos.filter((r) => r.fullName.includes("/")) };
  });

export type GithubPublishResult =
  | { ok: true; url: string; sha: string; branch: string; pull?: number }
  | { ok: false; error: string };

export const publishGithub = createServerFn({ method: "POST" })
  .validator(githubPublishInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<GithubPublishResult> => {
    const busy = overLimit("publish", context.userId);
    if (busy) return { ok: false, error: busy };
    const token = await useToken(context.userId, data.token);
    if (!token) return { ok: false, error: "Connect GitHub first. The token needs access to this repo." };
    const parsed = parseGithubUrl(`${data.owner}/${data.repo}`);
    if (!parsed || parsed.ref) return { ok: false, error: "That repo name is not valid." };
    if (!/^[A-Za-z0-9._/-]+$/.test(data.branch) || data.branch.includes("..")) {
      return { ok: false, error: "That branch name is not valid." };
    }
    if (!/^[0-9a-f]{40}$/i.test(data.baseSha)) return { ok: false, error: "Missing the commit this project was opened at." };
    const changes = sanitizeChanges(data.changes);
    if (!changes) return { ok: false, error: "Too many or too large to send. Commit fewer files." };
    if (changes.length === 0) return { ok: false, error: "Nothing changed since you opened the repo." };
    // The editor already holds these back; refuse here too, whoever is calling.
    const secret = changes.find((change) => !("deleted" in change) && isSecretPath(change.path));
    if (secret) return { ok: false, error: `${secret.path} looks like a secret file, and secret files are never sent to GitHub.` };
    const message = commitMessage(data.message, "Update from Aperture");
    try {
      const parent = await githubJson(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/commits/${data.baseSha}`,
        token,
      );
      if (parent.status === 401) return { ok: false, error: "GitHub rejected that token." };
      if (parent.status !== 200) return { ok: false, error: "Could not read the commit you opened." };
      const baseTree = String((parent.body as { tree?: { sha?: string } }).tree?.sha ?? "");
      if (!baseTree) return { ok: false, error: "Could not read the commit you opened." };
      // Keep each file's mode: writing every blob as 100644 drops a script's executable bit.
      const listing = await githubJson(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${baseTree}?recursive=1`,
        token,
      );
      const modes = blobModes(listing.status === 200 ? (listing.body as { tree?: unknown }).tree : null);
      const tree = [];
      for (const change of changes) {
        if ("deleted" in change) {
          tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
          continue;
        }
        const blob = await githubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/blobs`, token, {
          method: "POST",
          body: JSON.stringify({ content: change.content, encoding: "utf-8" }),
        });
        if (blob.status !== 201) return { ok: false, error: `Could not write ${change.path}.` };
        const sha = String((blob.body as { sha?: string }).sha ?? "");
        if (!sha) return { ok: false, error: `Could not write ${change.path}.` };
        tree.push({ path: change.path, mode: modes.get(change.path) ?? "100644", type: "blob", sha });
      }
      const nextTree = await githubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees`, token, {
        method: "POST",
        body: JSON.stringify({ base_tree: baseTree, tree }),
      });
      if (nextTree.status !== 201) return { ok: false, error: "GitHub rejected the file tree." };
      const treeSha = String((nextTree.body as { sha?: string }).sha ?? "");
      const commit = await githubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/commits`, token, {
        method: "POST",
        body: JSON.stringify({ message, tree: treeSha, parents: [data.baseSha] }),
      });
      if (commit.status !== 201) return { ok: false, error: "GitHub rejected the commit." };
      const sha = String((commit.body as { sha?: string }).sha ?? "");
      if (!sha) return { ok: false, error: "GitHub rejected the commit." };
      if (data.mode === "commit") {
        const updated = await githubJson(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/refs/heads/${encodeURIComponent(data.branch)}`,
          token,
          { method: "PATCH", body: JSON.stringify({ sha, force: false }) },
        );
        if (updated.status === 422) {
          return { ok: false, error: "That branch moved on GitHub. Open a pull request instead." };
        }
        if (updated.status !== 200) return { ok: false, error: "Could not update the branch." };
        return {
          ok: true,
          sha,
          branch: data.branch,
          url: `https://github.com/${parsed.owner}/${parsed.repo}/commit/${sha}`,
        };
      }
      const head = `aperture/${sha.slice(0, 7)}`;
      const ref = await githubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${head}`, sha }),
      });
      if (ref.status !== 201) return { ok: false, error: "Could not create the branch." };
      const pr = await githubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls`, token, {
        method: "POST",
        body: JSON.stringify({
          title: message,
          head,
          base: data.branch,
          body: "Opened from Aperture.",
        }),
      });
      if (pr.status !== 201) return { ok: false, error: "The branch was created, but the pull request was not." };
      const url = String((pr.body as { html_url?: string }).html_url ?? "");
      const pull = Number((pr.body as { number?: number }).number ?? 0);
      return { ok: true, sha, branch: head, url, pull: pull || undefined };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach GitHub." };
    }
  });

export type GithubChecksResult = { ok: true; state: CiOverall; checks: CiCheck[] } | { ok: false; error: string };

/** Hosts GitHub hands job logs out from, by redirect. Only these are followed. */
const LOG_HOSTS = [".actions.githubusercontent.com", ".blob.core.windows.net"];
const LOG_TAIL_BYTES = 1_000_000;
const LOG_READ_CAP = 20_000_000;

/** The end of a GitHub Actions job's log, or "" when it cannot be read (no actions:read scope, not Actions). */
async function jobLogTail(owner: string, repo: string, jobId: string, token: string): Promise<string> {
  try {
    const first = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
      headers: githubHeaders(token),
      redirect: "manual",
    });
    const location = first.headers.get("location");
    if (first.status < 300 || first.status >= 400 || !location) return "";
    const target = new URL(location);
    if (target.protocol !== "https:" || !LOG_HOSTS.some((host) => target.hostname.endsWith(host))) return "";
    // A signed download URL: GitHub's token is not sent on.
    const res = await fetch(target, { redirect: "manual" });
    if (!res.ok || !res.body) return "";
    const reader = res.body.getReader();
    let tail = new Uint8Array(0);
    let read = 0;
    while (read < LOG_READ_CAP) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      const joined = new Uint8Array(tail.byteLength + value.byteLength);
      joined.set(tail);
      joined.set(value, tail.byteLength);
      tail = joined.byteLength > LOG_TAIL_BYTES ? joined.slice(joined.byteLength - LOG_TAIL_BYTES) : joined;
    }
    await reader.cancel().catch(() => {});
    return new TextDecoder().decode(tail);
  } catch {
    return "";
  }
}

/**
 * A commit's CI: GitHub check runs and the older commit statuses. Failed
 * checks also bring where GitHub pinned them and the end of the job's log,
 * which is what a fix needs; at most three failed checks are read in full.
 */
export const githubChecks = createServerFn({ method: "POST" })
  .validator(githubChecksInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<GithubChecksResult> => {
    const busy = overLimit("checks", context.userId);
    if (busy) return { ok: false, error: busy };
    const token = await useToken(context.userId, data.token);
    if (!token) return { ok: false, error: "Connect GitHub first. The token needs access to this repo." };
    const parsed = parseGithubUrl(`${data.owner}/${data.repo}`);
    if (!parsed || parsed.ref) return { ok: false, error: "That repo name is not valid." };
    if (!/^[0-9a-f]{40}$/i.test(data.sha)) return { ok: false, error: "Missing the commit to check." };
    const repoUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
    try {
      const [runs, statuses] = await Promise.all([
        githubJson(`${repoUrl}/commits/${data.sha}/check-runs?per_page=50`, token),
        githubJson(`${repoUrl}/commits/${data.sha}/status`, token),
      ]);
      if (runs.status === 401) return { ok: false, error: "GitHub rejected that token." };
      if (runs.status !== 200) return { ok: false, error: "Could not read this commit's checks." };
      const { checks, actionsJobs } = checksFromGithub(runs.body, statuses.status === 200 ? statuses.body : null);
      const failed = checks.filter((check) => check.state === "failure" && /^\d+$/.test(check.id)).slice(0, 3);
      await Promise.all(
        failed.map(async (check) => {
          const notes = await githubJson(`${repoUrl}/check-runs/${check.id}/annotations?per_page=30`, token);
          if (notes.status === 200) check.annotations = failureNotes(notes.body);
          if (actionsJobs.has(check.id)) {
            check.log = logExcerpt(await jobLogTail(parsed.owner, parsed.repo, check.id, token));
          }
        }),
      );
      return { ok: true, state: overallState(checks), checks };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach GitHub." };
    }
  });

export type GithubAccount = { connected: boolean; login: string | null; last4: string | null };

export const githubStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<GithubAccount> => accountGithub(context.userId));

export const saveGithubToken = createServerFn({ method: "POST" })
  .validator(githubSaveTokenInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<GithubAccount & { ok: true } | { ok: false; error: string }> => {
    const token = cleanGithubToken(data.token);
    if (!token) return { ok: false, error: "That does not look like a GitHub token." };
    const who = await githubJson("https://api.github.com/user", token);
    if (who.status === 401) return { ok: false, error: "GitHub rejected that token." };
    if (who.status !== 200) return { ok: false, error: `GitHub returned ${who.status}.` };
    const login = String((who.body as { login?: string }).login ?? "");
    if (!login) return { ok: false, error: "GitHub did not return an account." };
    const { encryptSecret } = await import("@/lib/security/secrets.server");
    await ensureSettings(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update user_settings
      set github_token = ${encryptSecret(token)}, github_login = ${login}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true, ...(await accountGithub(context.userId)) };
  });

export const clearGithubAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<GithubAccount> => {
    await ensureSettings(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update user_settings
      set github_token = null, github_login = null, updated_at = now()
      where user_id = ${context.userId}
    `;
    return { connected: false, login: null, last4: null };
  });

export const postGithubReview = createServerFn({ method: "POST" })
  .validator(githubReviewInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const busy = overLimit("review", context.userId);
    if (busy) return { ok: false, error: busy };
    const token = await useToken(context.userId, data.token);
    if (!token) return { ok: false, error: "Connect GitHub first. The token needs access to this repo." };
    const parsed = parseGithubUrl(`${data.owner}/${data.repo}`);
    if (!parsed || parsed.ref) return { ok: false, error: "That repo name is not valid." };
    const pull = Math.floor(data.pull);
    if (!Number.isFinite(pull) || pull < 1) return { ok: false, error: "That pull request is not valid." };
    if (!/^[0-9a-f]{7,40}$/i.test(data.sha)) return { ok: false, error: "That commit is not valid." };
    if (typeof data.body !== "string") return { ok: false, error: "The review is empty." };
    let body = "";
    for (const ch of data.body) {
      const code = ch.codePointAt(0) ?? 0;
      body += code <= 31 && ch !== "\n" ? " " : ch;
    }
    body = body.trim().slice(0, 6000);
    if (body.length < 8) return { ok: false, error: "The review is empty." };
    const comments = (Array.isArray(data.comments) ? data.comments : []).slice(0, 20).flatMap((row) => {
      const path = safeRelPath(row?.path ?? "");
      const line = Math.floor(row?.line ?? 0);
      const text = typeof row?.body === "string" ? row.body.replace(/\s+/g, " ").trim().slice(0, 400) : "";
      if (!path || line < 1 || text.length < 4) return [];
      return [{ path, line, side: "RIGHT" as const, body: text }];
    });
    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${pull}/reviews`;
    try {
      const posted = await githubJson(url, token, {
        method: "POST",
        body: JSON.stringify({ commit_id: data.sha, event: "COMMENT", body, ...(comments.length ? { comments } : {}) }),
      });
      if (posted.status === 422 && comments.length > 0) {
        const plain = await githubJson(url, token, {
          method: "POST",
          body: JSON.stringify({ commit_id: data.sha, event: "COMMENT", body }),
        });
        if (plain.status === 200 || plain.status === 201) {
          return { ok: true, url: `https://github.com/${parsed.owner}/${parsed.repo}/pull/${pull}` };
        }
        return { ok: false, error: "GitHub would not take the review comments." };
      }
      if (posted.status !== 200 && posted.status !== 201) {
        return { ok: false, error: `GitHub returned ${posted.status}.` };
      }
      return { ok: true, url: `https://github.com/${parsed.owner}/${parsed.repo}/pull/${pull}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach GitHub." };
    }
  });

export const mergeGithub = createServerFn({ method: "POST" })
  .validator(githubMergeInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<GithubPublishResult> => {
    const busy = overLimit("merge", context.userId);
    if (busy) return { ok: false, error: busy };
    const token = await useToken(context.userId, data.token);
    if (!token) return { ok: false, error: "Connect GitHub first. The token needs access to this repo." };
    const parsed = parseGithubUrl(`${data.owner}/${data.repo}`);
    if (!parsed || parsed.ref) return { ok: false, error: "That repo name is not valid." };
    const message = commitMessage(data.message, "Merge from Aperture");
    try {
      if (data.pull && data.pull > 0) {
        const merged = await githubJson(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${data.pull}/merge`,
          token,
          { method: "PUT", body: JSON.stringify({ commit_title: message, merge_method: "merge" }) },
        );
        if (merged.status === 405) return { ok: false, error: "That pull request cannot be merged yet." };
        if (merged.status === 409) return { ok: false, error: "GitHub could not merge — the branches conflict." };
        if (merged.status === 404) return { ok: false, error: "That pull request is gone." };
        if (merged.status !== 200) return { ok: false, error: `GitHub returned ${merged.status}.` };
        const sha = String((merged.body as { sha?: string }).sha ?? "");
        return {
          ok: true,
          sha: sha || data.head,
          branch: data.base,
          url: `https://github.com/${parsed.owner}/${parsed.repo}/pull/${data.pull}`,
        };
      }
      if (!/^[A-Za-z0-9._/-]+$/.test(data.base) || !/^[A-Za-z0-9._/-]+$/.test(data.head)) {
        return { ok: false, error: "That branch name is not valid." };
      }
      if (data.base === data.head) return { ok: false, error: "This is already the default branch. Push writes to it." };
      const merged = await githubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/merges`, token, {
        method: "POST",
        body: JSON.stringify({ base: data.base, head: data.head, commit_message: message }),
      });
      if (merged.status === 204) {
        return {
          ok: true,
          sha: data.head,
          branch: data.base,
          url: `https://github.com/${parsed.owner}/${parsed.repo}/tree/${encodeURIComponent(data.base)}`,
        };
      }
      if (merged.status === 409) return { ok: false, error: "GitHub could not merge — the branches conflict." };
      if (merged.status === 404) return { ok: false, error: "GitHub could not find that branch." };
      if (merged.status !== 201) return { ok: false, error: `GitHub returned ${merged.status}.` };
      const sha = String((merged.body as { sha?: string }).sha ?? "");
      return {
        ok: true,
        sha,
        branch: data.base,
        url: sha ? `https://github.com/${parsed.owner}/${parsed.repo}/commit/${sha}` : "",
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach GitHub." };
    }
  });

async function useToken(userId: string, passed?: string): Promise<string | null> {
  const stored = await accountToken(userId);
  if (stored) return stored;
  return passed ? cleanGithubToken(passed) : null;
}

async function accountToken(userId: string): Promise<string | null> {
  const { decryptSecret } = await import("@/lib/security/secrets.server");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ github_token: string | null }>`
    select github_token from user_settings where user_id = ${userId}
  `;
  return decryptSecret(rows[0]?.github_token ?? null);
}

async function accountGithub(userId: string): Promise<GithubAccount> {
  const { decryptSecret, peekLast4 } = await import("@/lib/security/secrets.server");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ github_token: string | null; github_login: string | null }>`
    select github_token, github_login from user_settings where user_id = ${userId}
  `;
  const row = rows[0];
  const token = decryptSecret(row?.github_token ?? null);
  return {
    connected: Boolean(token),
    login: row?.github_login ?? null,
    last4: peekLast4(row?.github_token ?? null),
  };
}

async function ensureSettings(userId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const month = new Date().toISOString().slice(0, 7);
  await sql`
    insert into user_settings (user_id, plan, usage_month, model_source)
    values (${userId}, 'hobby', ${month}, 'hosted')
    on conflict (user_id) do nothing
  `;
}

function githubHeaders(token: string | null): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "aperture-editor",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson(
  url: string,
  token: string,
  init?: { method?: string; body?: string },
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    body: init?.body,
    redirect: "manual",
    headers: {
      ...githubHeaders(token),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status >= 300 && res.status < 400) return { status: res.status, body: {} };
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function readSource(
  owner: string,
  repo: string,
  ref: string | undefined,
  headers: Record<string, string>,
): Promise<GithubSource | null> {
  try {
    const repoRes = await fetchPinned(`https://api.github.com/repos/${owner}/${repo}`, headers);
    if (!repoRes.ok) return null;
    const repoBody = (await repoRes.json()) as { default_branch?: string };
    const defaultBranch = repoBody.default_branch || "main";
    const branch = ref || defaultBranch;
    const commitRes = await fetchPinned(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
      headers,
    );
    if (!commitRes.ok) return null;
    const commitBody = (await commitRes.json()) as { sha?: string };
    if (!commitBody.sha) return null;
    return { owner, repo, branch, sha: commitBody.sha, defaultBranch };
  } catch {
    return null;
  }
}

function sanitizeChanges(changes: GithubChange[]): GithubChange[] | null {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > 80) return changes?.length === 0 ? [] : null;
  let total = 0;
  const out: GithubChange[] = [];
  for (const change of changes) {
    if (!change || typeof change.path !== "string") return null;
    if (!isSafePath(change.path)) return null;
    if ("deleted" in change) {
      out.push({ path: change.path, deleted: true });
      continue;
    }
    if (typeof change.content !== "string" || change.content.length > 300_000) return null;
    total += change.content.length;
    if (total > 2_000_000) return null;
    out.push({ path: change.path, content: change.content });
  }
  return out;
}

function isSafePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    !path.split("/").includes("..")
  );
}
