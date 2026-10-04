import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publishGithub, mergeGithub, postGithubReview } from "@/lib/github/api";
import { githubReview } from "@/lib/github/review";
import { changesSince, readGithubToken, stampFiles } from "@/lib/github/roundtrip";
import { listPendingEdits } from "@/lib/workspace/edits";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useWorkspace } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";

/** Commit the files that changed since the repo was opened, or open a pull request. */
export function GithubSendDialog({ onClose }: { onClose: () => void }) {
  const github = useWorkspace((s) => s.github);
  const files = useWorkspace((s) => s.files);
  const commits = useWorkspace((s) => s.commits);
  const messages = useWorkspace((s) => s.messages);
  const revertCommit = useWorkspace((s) => s.revertCommit);
  const { user, isPending } = useCurrentUserState();
  const [message, setMessage] = useState(commits.at(-1)?.message || "Update from Aperture");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"commit" | "pr" | "merge" | "review" | null>(null);
  const changes = useMemo(() => (github ? changesSince(github.stamps, files) : []), [github, files]);
  const review = useMemo(() => githubReview(listPendingEdits(messages)), [messages]);
  const base = github?.defaultBranch || "main";
  const canMerge = Boolean(github && (github.pull || github.branch !== base));

  async function send(mode: "commit" | "pr") {
    if (!github) return;
    setError(null);
    setBusy(mode);
    try {
      const result = await publishGithub({
        data: {
          token: readGithubToken() ?? undefined,
          owner: github.owner,
          repo: github.repo,
          branch: github.branch,
          baseSha: github.sha,
          mode,
          message,
          changes,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // After a pull request, the project follows its branch: the next push updates
      // that pull request instead of fast-forwarding the base onto it unreviewed.
      useWorkspace.getState().setGithub({
        ...github,
        branch: result.branch,
        sha: result.sha,
        pull: result.pull ?? github.pull,
        stamps: stampFiles(useWorkspace.getState().files),
      });
      toast.success(mode === "pr" ? "Pull request opened" : `Pushed to ${github.branch}`);
      const pull = result.pull ?? github.pull;
      if (mode === "pr" && pull && review) {
        const posted = await postGithubReview({
          data: {
            token: readGithubToken() ?? undefined,
            owner: github.owner,
            repo: github.repo,
            pull,
            sha: result.sha,
            body: review.body,
            comments: review.comments,
          },
        });
        if (!posted.ok) setError(posted.error);
        else toast.success(`Review posted on #${pull}`);
      }
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach GitHub.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReview() {
    if (!github?.pull || !review) return;
    setError(null);
    setBusy("review");
    try {
      const posted = await postGithubReview({
        data: {
          token: readGithubToken() ?? undefined,
          owner: github.owner,
          repo: github.repo,
          pull: github.pull,
          sha: github.sha,
          body: review.body,
          comments: review.comments,
        },
      });
      if (!posted.ok) {
        setError(posted.error);
        return;
      }
      toast.success(`Review posted on #${github.pull}`);
      if (posted.url) window.open(posted.url, "_blank", "noopener,noreferrer");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach GitHub.");
    } finally {
      setBusy(null);
    }
  }

  async function merge() {
    if (!github) return;
    setError(null);
    setBusy("merge");
    try {
      const result = await mergeGithub({
        data: {
          token: readGithubToken() ?? undefined,
          owner: github.owner,
          repo: github.repo,
          base,
          head: github.branch,
          pull: github.pull,
          message,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      useWorkspace.getState().setGithub({
        ...github,
        branch: base,
        sha: result.sha || github.sha,
        pull: undefined,
      });
      toast.success(github.pull ? `Merged pull request #${github.pull}` : `Merged into ${base}`);
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach GitHub.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Github className="size-4" />
          <h2 className="text-base font-medium">Send to GitHub</h2>
        </div>
        {!github ? (
          <p className="mt-2 text-sm text-muted">Open a GitHub repo first. A dropped folder has nowhere to go back to.</p>
        ) : !isPending && !user ? (
          <div className="mt-3">
            <p className="text-sm text-muted">Sign in to send this back.</p>
            <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {github.owner}/{github.repo} · {github.branch}
              {" · "}
              {changes.length === 0 ? "no changes" : `${changes.length} ${changes.length === 1 ? "file" : "files"}`}
            </p>
            {commits.length > 0 && (
              <ul className="mt-3 max-h-32 overflow-y-auto rounded-md border border-border">
                {commits.slice(-5).map((commit) => {
                  const latest = commit.id === commits[commits.length - 1]?.id;
                  return (
                    <li key={commit.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12px]">
                      <span className="min-w-0 truncate">{commit.message}</span>
                      {latest && (
                        <button
                          type="button"
                          className="shrink-0 text-muted hover:text-fg"
                          onClick={() => {
                            const reverted = revertCommit(commit.id);
                            if (!reverted.ok) setError(reverted.error);
                          }}
                        >
                          Revert
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-3 text-[13px]"
              aria-label="Commit message"
            />
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={busy !== null || changes.length === 0}
                onClick={() => void send("commit")}
              >
                {busy === "commit" ? "Pushing…" : `Push to ${github.branch}`}
              </Button>
              <Button size="sm" type="button" disabled={busy !== null || changes.length === 0} onClick={() => void send("pr")}>
                {busy === "pr" ? "Opening…" : "Open PR"}
              </Button>
              {github.pull && review && (
                <Button size="sm" variant="outline" type="button" disabled={busy !== null} onClick={() => void sendReview()}>
                  {busy === "review" ? "Sending…" : `Review on #${github.pull}`}
                </Button>
              )}
              {canMerge && (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={busy !== null || changes.length > 0}
                  onClick={() => void merge()}
                >
                  {busy === "merge" ? "Merging…" : github.pull ? `Merge #${github.pull}` : `Merge into ${base}`}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
