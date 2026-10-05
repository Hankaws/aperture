import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, LoaderCircle, Minus, RefreshCw, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { submitAgent } from "@/lib/agent/run";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAccount } from "@/lib/billing/use-account";
import { quoteRun, replayQuote } from "@/lib/billing/cost";
import { githubChecks, publishGithub } from "@/lib/github/api";
import { ciFixLabel, ciFixPrompt, type CiCheck, type CiOverall } from "@/lib/github/ci";
import { changesSince, readGithubToken, sendable, stampsAfterSend } from "@/lib/github/roundtrip";
import { listPendingEdits } from "@/lib/workspace/edits";
import { useWorkspace } from "@/lib/workspace/store";

/** How often a pull request still running CI is asked again, while this tab is in view. */
const POLL_MS = 30_000;
/** CI can take a minute to register a new commit; "no checks" is believed after this. */
const NO_CHECKS_GRACE_MS = 3 * 60_000;

type Loaded =
  | { sha: string; state: CiOverall; checks: CiCheck[]; at: number }
  | { sha: string; error: string; at: number };

const STATE_LABEL: Record<CiOverall, string> = {
  pending: "checks running",
  failure: "checks failed",
  success: "checks passed",
  none: "no checks",
};

function usePrChecks() {
  const github = useWorkspace((s) => s.github);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const since = useRef<{ sha: string; at: number } | null>(null);
  const sha = github?.pull ? github.sha : null;

  const refresh = useCallback(async () => {
    const current = useWorkspace.getState().github;
    if (!current?.pull) return;
    setBusy(true);
    try {
      const result = await githubChecks({
        data: {
          token: readGithubToken() ?? undefined,
          owner: current.owner,
          repo: current.repo,
          sha: current.sha,
        },
      });
      setLoaded(
        result.ok
          ? { sha: current.sha, state: result.state, checks: result.checks, at: Date.now() }
          : { sha: current.sha, error: result.error, at: Date.now() },
      );
    } catch (error) {
      setLoaded({
        sha: current.sha,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
        at: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!sha) return;
    since.current = { sha, at: Date.now() };
    void refresh();
  }, [sha, refresh]);

  const current = loaded && loaded.sha === sha ? loaded : null;
  const waiting =
    current !== null &&
    "state" in current &&
    (current.state === "pending" ||
      (current.state === "none" && Date.now() - (since.current?.at ?? 0) < NO_CHECKS_GRACE_MS));

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, refresh]);

  return { github, current, busy, refresh, waiting };
}

const ICON = { pending: LoaderCircle, success: Check, failure: X, neutral: Minus } as const;

function CheckRow({ check, onOpenFile }: { check: CiCheck; onOpenFile: () => void }) {
  const Icon = ICON[check.state];
  const files = useWorkspace((s) => s.files);
  return (
    <li className="rounded-lg border border-border bg-bg px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            check.state === "success" && "text-ok",
            check.state === "failure" && "text-danger",
            check.state === "pending" && "animate-spin text-muted",
            check.state === "neutral" && "text-subtle",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm">{check.name}</span>
        <span className="sr-only">{check.state}</span>
        {check.url && (
          <a
            href={check.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-subtle hover:text-fg"
            aria-label={`Open ${check.name} on GitHub`}
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      {check.state === "failure" && check.summary && (
        <p className="mt-1 line-clamp-3 text-xs whitespace-pre-line text-muted">{check.summary}</p>
      )}
      {check.state === "failure" && check.annotations.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {check.annotations.slice(0, 6).map((note, i) => {
            const here = files[note.path] !== undefined;
            return (
              <li key={i} className="font-mono text-[11px] text-danger">
                {here ? (
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => {
                      useWorkspace.getState().openFile(note.path);
                      if (note.line)
                        useIdeUi.getState().setReveal({ path: note.path, line: note.line });
                      useIdeUi.getState().setMobilePane("editor");
                      onOpenFile();
                    }}
                  >
                    {note.path}
                    {note.line ? `:${note.line}` : ""}
                  </button>
                ) : (
                  <span>
                    {note.path}
                    {note.line ? `:${note.line}` : ""}
                  </span>
                )}{" "}
                <span className="text-muted">{note.message}</span>
              </li>
            );
          })}
        </ul>
      )}
      {check.state === "failure" && check.log && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11px] text-subtle">End of the log</summary>
          <pre className="aperture-scroll mt-1 max-h-48 overflow-auto rounded-md border border-border bg-surface p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
            {check.log}
          </pre>
        </details>
      )}
    </li>
  );
}

/**
 * A pull request opened from this editor, driven to green: its CI on the
 * latest commit, Composer asked to fix a failure, and the fix pushed back to
 * the same pull request. Every step is a click; nothing runs unattended.
 */
export function PrChecksBadge() {
  const pull = useWorkspace((s) => s.github?.pull);
  // Nothing to watch, nothing loaded: the account and GitHub are only asked once there is a pull request.
  return pull ? <PrChecks /> : null;
}

function PrChecks() {
  const { github, current, busy, refresh, waiting } = usePrChecks();
  const [open, setOpen] = useState(false);
  const files = useWorkspace((s) => s.files);
  const messages = useWorkspace((s) => s.messages);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const { user } = useCurrentUserState();
  const { account, refresh: refreshAccount } = useAccount();
  const [pushing, setPushing] = useState(false);
  const changes = useMemo(
    // Composer's lessons stay in this editor here too: they never block a CI fix or ride along with one.
    () => (github ? sendable(changesSince(github.stamps, files), { includeLessons: false }).send : []),
    [github, files],
  );
  const staged = useMemo(() => listPendingEdits(messages).length, [messages]);

  const replay = useIdeUi((s) => s.aiReplay);

  if (!github?.pull) return null;
  const pull = github.pull;
  const state = current && "state" in current ? current.state : null;
  const failures =
    current && "checks" in current
      ? current.checks.filter((check) => check.state === "failure")
      : [];
  const label = current
    ? "error" in current
      ? "checks unknown"
      : STATE_LABEL[current.state]
    : "checks…";
  const priced = quoteRun(account, account?.modelSource ?? "hosted");
  const quote = replay ? replayQuote(priced) : priced;
  const fixBlocked = !user
    ? "Sign in to run Composer."
    : agentRunning
      ? "Wait until this turn finishes."
      : staged > 0
        ? "Apply or reject the staged change first."
        : changes.length > 0
          ? "Push or revert the local changes first, so the fix starts from what CI ran."
          : quote.blocked
            ? (quote.blockReason ?? "This run is blocked.")
            : null;

  async function fix() {
    if (fixBlocked || failures.length === 0) return;
    setOpen(false);
    useIdeUi.setState({ chatOpen: true, mobilePane: "agent" });
    await submitAgent(ciFixLabel(pull, failures), "composer", account?.modelSource ?? "hosted", {
      phase: "skip",
      apiInstruction: ciFixPrompt(pull, failures),
    });
    void refreshAccount();
  }

  async function push() {
    const origin = useWorkspace.getState().github;
    if (!origin?.pull || changes.length === 0 || staged > 0) return;
    setPushing(true);
    try {
      const result = await publishGithub({
        data: {
          token: readGithubToken() ?? undefined,
          owner: origin.owner,
          repo: origin.repo,
          branch: origin.branch,
          baseSha: origin.sha,
          mode: "commit",
          message: `Fix CI on #${origin.pull}`,
          changes,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      useWorkspace.getState().setGithub({
        ...origin,
        sha: result.sha,
        stamps: stampsAfterSend(origin.stamps, changes),
      });
      toast.success(`Pushed to #${origin.pull}. Watching its checks.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reach GitHub.");
    } finally {
      setPushing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "shrink-0 hover:text-fg",
          state === "failure" && "text-danger",
          state === "success" && "text-ok",
          state === "pending" && "shimmer-text",
        )}
        title={`Pull request #${pull}: ${label}`}
      >
        #{pull} <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-bg/70"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pr-checks-title"
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <h2 id="pr-checks-title" className="min-w-0 flex-1 truncate text-base font-medium">
                Checks on #{pull}
              </h2>
              <a
                href={`https://github.com/${github.owner}/${github.repo}/pull/${pull}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
              >
                Open on GitHub <ExternalLink className="size-3" />
              </a>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Check again"
                disabled={busy}
                onClick={() => void refresh()}
              >
                <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {github.branch} · {github.sha.slice(0, 7)} · {label}
              {waiting ? " · checking again every 30 seconds" : ""}
            </p>
            {current && "error" in current && (
              <p className="mt-3 text-sm text-danger">{current.error}</p>
            )}
            {current && "checks" in current && current.checks.length === 0 && (
              <p className="mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted">
                {waiting
                  ? "No checks yet. CI can take a minute to start."
                  : "This repo runs no checks on this commit."}
              </p>
            )}
            {current && "checks" in current && current.checks.length > 0 && (
              <ul className="aperture-scroll mt-3 min-h-0 space-y-1.5 overflow-y-auto">
                {[...current.checks]
                  .sort((a, b) => Number(b.state === "failure") - Number(a.state === "failure"))
                  .map((check) => (
                    <CheckRow key={check.id} check={check} onOpenFile={() => setOpen(false)} />
                  ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {changes.length > 0 && (
                <Button
                  size="sm"
                  variant={failures.length > 0 ? "outline" : "default"}
                  disabled={pushing || staged > 0}
                  title={staged > 0 ? "Apply or reject the staged change first" : undefined}
                  onClick={() => void push()}
                >
                  {pushing
                    ? "Pushing…"
                    : `Push ${changes.length} ${changes.length === 1 ? "file" : "files"} to #${pull}`}
                </Button>
              )}
              {failures.length > 0 && (
                <Button
                  size="sm"
                  disabled={fixBlocked !== null}
                  title={fixBlocked ?? undefined}
                  onClick={() => void fix()}
                >
                  <Wrench className="size-3.5" />
                  Fix with Composer
                </Button>
              )}
            </div>
            {failures.length > 0 && fixBlocked && (
              <p className="mt-2 text-right text-xs text-subtle">{fixBlocked}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
