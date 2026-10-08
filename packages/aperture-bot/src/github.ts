/**
 * The few GitHub REST calls the bot makes, over plain fetch with the
 * workflow's token. `fetch` is injectable so the tests run against an API
 * that lives in memory.
 */
import { retryStale } from "./retry.ts";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export type Repo = { owner: string; repo: string };

export type Pull = {
  number: number;
  headRef: string;
  headSha: string;
  headRepo: string;
  baseRef: string;
};

export type ThreadComment = { id: number; author: string; authorType: string; body: string };

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class GitHub {
  constructor(
    readonly repo: Repo,
    private readonly token: string,
    private readonly api = "https://api.github.com",
    private readonly fetcher: Fetch = fetch,
  ) {}

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    accept = "application/vnd.github+json",
  ): Promise<T> {
    const res = await retryStale(() =>
      this.fetcher(`${this.api}${path}`, {
        method,
        headers: {
          Accept: accept,
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "aperture-bot",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GitHubError(
        `GitHub answered ${res.status} to ${method} ${path}${text ? `: ${text.slice(0, 200)}` : ""}`,
        res.status,
      );
    }
    if (accept !== "application/vnd.github+json") return (await res.text()) as T;
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private get base(): string {
    return `/repos/${this.repo.owner}/${this.repo.repo}`;
  }

  /** admin, maintain, write, triage, read or none. */
  async permission(user: string): Promise<string> {
    try {
      const out = await this.call<{ permission?: string; role_name?: string }>(
        "GET",
        `${this.base}/collaborators/${encodeURIComponent(user)}/permission`,
      );
      return out.role_name ?? out.permission ?? "none";
    } catch (error) {
      // Someone GitHub does not know as a collaborator here.
      if (error instanceof GitHubError && error.status === 404) return "none";
      throw error;
    }
  }

  async react(commentId: number, content: "eyes" | "rocket" | "confused"): Promise<void> {
    await this.call("POST", `${this.base}/issues/comments/${commentId}/reactions`, { content });
  }

  async comments(issue: number): Promise<ThreadComment[]> {
    const out = await this.call<
      Array<{ id: number; body?: string; user?: { login?: string; type?: string } }>
    >("GET", `${this.base}/issues/${issue}/comments?per_page=100`);
    return out.map((c) => ({
      id: c.id,
      author: c.user?.login ?? "someone",
      authorType: c.user?.type ?? "User",
      body: c.body ?? "",
    }));
  }

  async pull(number: number): Promise<Pull> {
    const out = await this.call<{
      number: number;
      head: { ref: string; sha: string; repo: { full_name: string } | null };
      base: { ref: string };
    }>("GET", `${this.base}/pulls/${number}`);
    return {
      number: out.number,
      headRef: out.head.ref,
      headSha: out.head.sha,
      headRepo: out.head.repo?.full_name ?? "",
      baseRef: out.base.ref,
    };
  }

  /** The pull request's diff, as text. */
  async diff(number: number): Promise<string> {
    return this.call<string>(
      "GET",
      `${this.base}/pulls/${number}`,
      undefined,
      "application/vnd.github.diff",
    );
  }

  async createPull(input: { title: string; head: string; base: string; body: string }): Promise<{
    number: number;
    url: string;
  }> {
    const out = await this.call<{ number: number; html_url: string }>(
      "POST",
      `${this.base}/pulls`,
      input,
    );
    return { number: out.number, url: out.html_url };
  }

  async comment(issue: number, body: string): Promise<string> {
    const out = await this.call<{ html_url: string }>(
      "POST",
      `${this.base}/issues/${issue}/comments`,
      { body },
    );
    return out.html_url;
  }
}

/** Write access, the bar for asking the bot to change the repository. */
export function canWrite(permission: string): boolean {
  return ["admin", "maintain", "write"].includes(permission);
}
