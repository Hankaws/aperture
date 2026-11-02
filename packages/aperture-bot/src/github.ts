/**
 * The few GitHub REST calls the bot makes, over plain fetch with the
 * workflow's token. `fetch` is injectable so the tests run against an API
 * that lives in memory.
 */
import type { ReviewNote } from "./lessons.ts";
import { retryStale } from "./retry.ts";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
import type { RawComment, Thread } from "../../../src/lib/bot/tasks.ts";

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

  /**
   * Applied to every comment body as it is posted or edited: the run sets it
   * to sign the suggestion lists in its replies (`seal.ts`).
   */
  seal: (body: string) => string = (body) => body;

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
    }>("POST", `${this.base}/issues/${issue}/comments`, { body: this.seal(body) });
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

  async openIssues(): Promise<
    Array<{ number: number; title: string; isPull: boolean; updatedAt?: string }>
  > {
    const out = await this.all<{
      number: number;
      title: string;
      pull_request?: unknown;
      updated_at?: string;
    }>(`${this.base}/issues?state=open`);
    return out.map((i) => ({
      number: i.number,
      title: i.title,
      isPull: Boolean(i.pull_request),
      updatedAt: i.updated_at,
    }));
  }

  async createIssue(title: string, body: string): Promise<number> {
    const out = await this.call<{ number: number }>("POST", `${this.base}/issues`, { title, body });
    return out.number;
  }

  /** The review comments on a pull request's lines: what the bot already said there. */
  async reviewComments(
    pull: number,
  ): Promise<Array<{ path: string; body: string; authorType: string }>> {
    const out = await this.all<{ path?: string; body?: string; user?: { type?: string } }>(
      `${this.base}/pulls/${pull}/comments`,
      3,
    );
    return out.map((c) => ({
      path: c.path ?? "",
      body: c.body ?? "",
      authorType: c.user?.type ?? "User",
    }));
  }

  /**
   * Reviews and comments on lines of the bot's pull requests (`aperture/…`
   * branches) updated since then, the newest `pulls` of them: what people
   * asked the bot to do differently (`lessons.ts`).
   */
  async reviewNotes(since: string, pulls: number): Promise<ReviewNote[]> {
    const rows = await this.all<{
      number: number;
      head?: { ref?: string };
      updated_at?: string;
    }>(`${this.base}/pulls?state=all&sort=updated&direction=desc`, 1);
    const mine = rows
      .filter((p) => (p.head?.ref ?? "").startsWith("aperture/") && (p.updated_at ?? "") >= since)
      .slice(0, pulls);
    type Row = {
      body?: string | null;
      path?: string;
      user?: { login?: string; type?: string };
      author_association?: string;
      submitted_at?: string;
      created_at?: string;
    };
    const note = (pull: number, r: Row, path?: string): ReviewNote => ({
      pull,
      author: r.user?.login ?? "someone",
      authorType: r.user?.type ?? "User",
      association: r.author_association ?? "NONE",
      body: r.body ?? "",
      ...(path ? { path } : {}),
      at: r.submitted_at ?? r.created_at ?? "",
    });
    const lists = await Promise.all(
      mine.map(async (p) => {
        const [reviews, lines] = await Promise.all([
          this.all<Row>(`${this.base}/pulls/${p.number}/reviews`, 1),
          this.all<Row>(`${this.base}/pulls/${p.number}/comments`, 1),
        ]);
        return [
          ...reviews.map((r) => note(p.number, r)),
          ...lines.map((r) => note(p.number, r, r.path)),
        ];
      }),
    );
    return lists.flat();
  }

  /** A review that only comments: it never approves or asks for changes. */
  async createReview(
    pull: number,
    input: {
      commitId: string;
      body: string;
      comments: Array<{ path: string; line: number; side: "RIGHT" | "LEFT"; body: string }>;
    },
  ): Promise<{ url: string }> {
    const out = await this.call<{ html_url?: string }>(
      "POST",
      `${this.base}/pulls/${pull}/reviews`,
      {
        commit_id: input.commitId,
        event: "COMMENT",
        body: input.body,
        comments: input.comments,
      },
    );
    return { url: out.html_url ?? "" };
  }

  async editIssue(number: number, body: string): Promise<void> {
    await this.call("PATCH", `${this.base}/issues/${number}`, { body });
  }

  /** Comments anywhere in the repository since `since` (ISO): what the bot said lately. */
  async commentsSince(since: string): Promise<ThreadComment[]> {
    const out = await this.all<{
      id: number;
      body?: string;
      user?: { login?: string; type?: string };
    }>(`${this.base}/issues/comments?since=${encodeURIComponent(since)}&sort=created`);
    return out.map((c) => ({
      id: c.id,
      author: c.user?.login ?? "someone",
      authorType: c.user?.type ?? "User",
      body: c.body ?? "",
    }));
  }

  /**
   * Comments updated since then, as GitHub gives them, newest first: the
   * week's digest reads them as tasks (`week.ts`).
   */
  async rawCommentsSince(since: string): Promise<RawComment[]> {
    return this.all<RawComment>(
      `${this.base}/issues/comments?since=${encodeURIComponent(since)}&sort=updated&direction=desc`,
    );
  }

  /** Issues and pull requests updated since then, and whether each pull request was merged. */
  async threadsSince(since: string): Promise<Map<number, Thread>> {
    const rows = await this.all<{
      number?: number;
      title?: string;
      state?: string;
      pull_request?: { merged_at?: string | null } | null;
    }>(`${this.base}/issues?state=all&since=${encodeURIComponent(since)}`);
    const threads = new Map<number, Thread>();
    for (const r of rows)
      if (typeof r.number === "number")
        threads.set(r.number, {
          title: r.title ?? "",
          isPull: Boolean(r.pull_request),
          open: r.state !== "closed",
          ...(r.pull_request?.merged_at ? { merged: true } : {}),
        });
    return threads;
  }

  /**
   * The bot's pull requests (`aperture/…` branches) closed since then, by
   * title: those merged, the work the maintainer took, and those closed
   * without merging, the work they turned down.
   */
  async closedBotPulls(since: string): Promise<{ merged: string[]; unmerged: string[] }> {
    const rows = await this.all<{
      title?: string;
      head?: { ref?: string };
      merged_at?: string | null;
      closed_at?: string | null;
    }>(`${this.base}/pulls?state=closed&sort=updated&direction=desc`, 2);
    const mine = rows.filter(
      (p) => (p.head?.ref ?? "").startsWith("aperture/") && (p.closed_at ?? "") >= since && p.title,
    );
    return {
      merged: mine.filter((p) => p.merged_at).map((p) => p.title!),
      unmerged: mine.filter((p) => !p.merged_at).map((p) => p.title!),
    };
  }

  /** Open pull requests: their branch and page, and what the look-over reads. */
  async openPulls(): Promise<
    Array<{
      headRef: string;
      url: string;
      number: number;
      title: string;
      draft: boolean;
      updatedAt?: string;
    }>
  > {
    const out = await this.all<{
      head: { ref: string };
      html_url: string;
      number: number;
      title: string;
      draft?: boolean;
      updated_at?: string;
    }>(`${this.base}/pulls?state=open`);
    return out.map((p) => ({
      headRef: p.head.ref,
      url: p.html_url,
      number: p.number,
      title: p.title,
      draft: p.draft === true,
      updatedAt: p.updated_at,
    }));
  }

  async editComment(id: number, body: string): Promise<void> {
    await this.call("PATCH", `${this.base}/issues/comments/${id}`, { body: this.seal(body) });
  }
}

/** Write access, the bar for asking the bot to change the repository. */
export function canWrite(permission: string): boolean {
  return ["admin", "maintain", "write"].includes(permission);
}
