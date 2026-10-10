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

/** A check or status that finished red, with what it reported. */
export type CheckFailure = { name: string; detail: string; annotations: string[] };

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

  /**
   * Every page of a list, oldest first as GitHub gives them, up to `max`
   * pages of 100: one page would miss the newest comments on a long thread,
   * or a job's tracking issue in a busy repository.
   */
  private async all<T>(path: string, max = 10): Promise<T[]> {
    const out: T[] = [];
    const sep = path.includes("?") ? "&" : "?";
    for (let page = 1; page <= max; page++) {
      const items = await this.call<T[]>("GET", `${path}${sep}per_page=100&page=${page}`);
      out.push(...items);
      if (items.length < 100) break;
    }
    return out;
  }

  async comments(issue: number): Promise<ThreadComment[]> {
    const out = await this.all<{
      id: number;
      body?: string;
      user?: { login?: string; type?: string };
    }>(`${this.base}/issues/${issue}/comments`);
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

  /** Posts a comment; `by` is who the token posts as, which names the bot's commits. */
  async comment(
    issue: number,
    body: string,
  ): Promise<{ id: number; url: string; by: { login: string; id: number } | null }> {
    const out = await this.call<{
      id: number;
      html_url: string;
      user?: { login?: string; id?: number } | null;
    }>("POST", `${this.base}/issues/${issue}/comments`, { body });
    const by =
      out.user?.login && typeof out.user.id === "number"
        ? { login: out.user.login, id: out.user.id }
        : null;
    return { id: out.id, url: out.html_url, by };
  }

  async defaultBranch(): Promise<string> {
    const out = await this.call<{ default_branch?: string }>("GET", this.base);
    return out.default_branch ?? "main";
  }

  /** The commit a branch points at. */
  async head(branch: string): Promise<string> {
    const out = await this.call<{ commit?: { sha?: string } }>(
      "GET",
      `${this.base}/branches/${encodeURIComponent(branch)}`,
    );
    return out.commit?.sha ?? "";
  }

  /** The checks and statuses on a commit that finished red, with what they said. */
  async failures(sha: string): Promise<CheckFailure[]> {
    const [runs, status] = await Promise.all([
      this.call<{
        check_runs?: Array<{
          id: number;
          name: string;
          status?: string;
          conclusion?: string | null;
          output?: { title?: string | null; summary?: string | null };
        }>;
      }>("GET", `${this.base}/commits/${sha}/check-runs?per_page=100`),
      this.call<{
        statuses?: Array<{ context: string; state: string; description?: string | null }>;
      }>("GET", `${this.base}/commits/${sha}/status`),
    ]);
    const out: CheckFailure[] = [];
    for (const run of runs.check_runs ?? []) {
      if (run.status !== "completed" || !["failure", "timed_out"].includes(run.conclusion ?? ""))
        continue;
      const notes = await this.call<Array<{ path: string; start_line?: number; message?: string }>>(
        "GET",
        `${this.base}/check-runs/${run.id}/annotations?per_page=20`,
      ).catch(() => []);
      out.push({
        name: run.name,
        detail: [run.output?.title, run.output?.summary].filter(Boolean).join("\n"),
        annotations: notes.map((n) => `${n.path}:${n.start_line ?? 1}: ${n.message ?? ""}`),
      });
    }
    for (const s of status.statuses ?? [])
      if (s.state === "failure" || s.state === "error")
        out.push({ name: s.context, detail: s.description ?? "", annotations: [] });
    return out;
  }

  async openIssues(): Promise<Array<{ number: number; title: string; isPull: boolean }>> {
    const out = await this.all<{ number: number; title: string; pull_request?: unknown }>(
      `${this.base}/issues?state=open`,
    );
    return out.map((i) => ({ number: i.number, title: i.title, isPull: Boolean(i.pull_request) }));
  }

  async createIssue(title: string, body: string): Promise<number> {
    const out = await this.call<{ number: number }>("POST", `${this.base}/issues`, { title, body });
    return out.number;
  }

  /** Open pull requests from this repository's branches: their branch and page. */
  async openPulls(): Promise<Array<{ headRef: string; url: string }>> {
    const out = await this.all<{ head: { ref: string }; html_url: string }>(
      `${this.base}/pulls?state=open`,
    );
    return out.map((p) => ({ headRef: p.head.ref, url: p.html_url }));
  }

  async editComment(id: number, body: string): Promise<void> {
    await this.call("PATCH", `${this.base}/issues/comments/${id}`, { body });
  }
}

/** Write access, the bar for asking the bot to change the repository. */
export function canWrite(permission: string): boolean {
  return ["admin", "maintain", "write"].includes(permission);
}
