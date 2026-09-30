import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publishGithub } from "@/lib/github/api";
import { changesSince, readGithubToken, stampFiles } from "@/lib/github/roundtrip";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useWorkspace } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";

/** Commit the files that changed since the repo was opened, or open a pull request. */
export function GithubSendDialog({ onClose }: { onClose: () => void }) {
  const github = useWorkspace((s) => s.github);
  const files = useWorkspace((s) => s.files);
  const { user, isPending } = useCurrentUserState();
  const [message, setMessage] = useState("Update from Aperture");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"commit" | "pr" | null>(null);
  const changes = useMemo(() => (github ? changesSince(github.stamps, files) : []), [github, files]);

  async function send(mode: "commit" | "pr") {
    if (!github) return;
    const token = readGithubToken();
    if (!token) {
      setError("Save a GitHub token when you open the repo.");
      return;
    }
    setError(null);
    setBusy(mode);
    try {
      const result = await publishGithub({
        data: {
          token,
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
      useWorkspace.getState().setGithub({
        ...github,
        sha: result.sha,
        stamps: stampFiles(useWorkspace.getState().files),
      });
      toast.success(mode === "pr" ? "Pull request opened" : "Committed");
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
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-3 text-[13px]"
              aria-label="Commit message"
            />
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
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
                {busy === "commit" ? "Committing…" : `Commit to ${github.branch}`}
              </Button>
              <Button size="sm" type="button" disabled={busy !== null || changes.length === 0} onClick={() => void send("pr")}>
                {busy === "pr" ? "Opening…" : "Open PR"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
