import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, ExternalLink, Link2, Loader2, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { CopyBlock } from "@/components/site/copy-block";
import { checkPublicPull, type PublicCheckResult } from "@/lib/github/public-pull";
import { headline, shareMarkdown, verdictSentence } from "@/lib/github/check-summary";
import { parsePullLink, pullLinkFromPath, pullLinkPath, pullUrl } from "@/lib/github/pull-link";
import type { CheckRow } from "@/lib/workspace/checks";
import { cn } from "@/lib/utils";

/**
 * Real agent pull requests, red first: the first thing a visitor sees is a catch. Picked from the
 * proof run (137 agent pull requests, PR #276) for verdicts that are the same before and after
 * the parse fix, on merged pull requests, so the label stays true.
 */
const EXAMPLES: ReadonlyArray<{
  pr: string;
  agent: string;
  verdict: "red" | "clear" | "look";
  label: string;
}> = [
  { pr: "Julieisbaka/Tagline#43", agent: "Copilot", verdict: "red", label: "1 red" },
  { pr: "langfuse/langfuse#20929", agent: "Cursor", verdict: "clear", label: "nothing red" },
  { pr: "compulim/onvif-camera#10", agent: "Copilot", verdict: "look", label: "1 to look at" },
];

type Ok = Extract<PublicCheckResult, { ok: true }>;

/** The check page: paste a public pull request's link, read Aperture's checks on it, share the result. */
export function PullCheck({ pr }: { pr?: string }) {
  const navigate = useNavigate();
  const fromPath = pr ? pullLinkFromPath(pr) : null;
  const [text, setText] = useState(fromPath ? pullUrl(fromPath) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Ok | null>(null);

  useEffect(() => {
    if (!pr) return;
    let cancel = false;
    const link = pullLinkFromPath(pr);
    if (link) setText(pullUrl(link));
    setBusy(true);
    setError(null);
    setResult(null);
    checkPublicPull({ data: { pr } })
      .then((out) => {
        if (cancel) return;
        if (out.ok) setResult(out);
        else setError(out.error);
      })
      .catch(() => !cancel && setError("Could not reach the check. Try again in a moment."))
      .finally(() => !cancel && setBusy(false));
    return () => {
      cancel = true;
    };
  }, [pr]);

  function submit(value: string) {
    const link = parsePullLink(value);
    if (!link) {
      setError(
        "That is not a pull request link. Paste one like https://github.com/owner/repo/pull/12.",
      );
      return;
    }
    const path = pullLinkPath(link);
    if (path === pr) return;
    void navigate({ to: "/check", search: { pr: path } });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submit(text);
        }}
      >
        <label htmlFor="pull-link" className="sr-only">
          Pull request link
        </label>
        <input
          id="pull-link"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="https://github.com/owner/repo/pull/12"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 font-mono sm:flex-1 text-sm text-fg placeholder:text-subtle focus:border-accent/60 focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={busy || !text.trim()} className="h-11">
          {busy && <Loader2 className="size-4 animate-spin" />}
          Check it
        </Button>
      </form>
      {!pr && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle" data-examples>
          <span>Try one:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.pr}
              type="button"
              data-example={example.verdict}
              aria-label={`${example.pr}, by ${example.agent}: ${example.label}`}
              onClick={() => {
                setText(example.pr);
                submit(example.pr);
              }}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-muted hover:bg-elevated hover:text-fg"
            >
              <span className="font-mono">{example.pr}</span>
              <span
                className={cn(
                  "font-medium",
                  example.verdict === "red"
                    ? "text-danger"
                    : example.verdict === "look"
                      ? "text-warn"
                      : "text-ok",
                )}
              >
                {example.agent} · {example.label}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {/* Always mounted, so a screen reader hears the verdict when it arrives, not only the wait. */}
      <p className="sr-only" aria-live="polite" data-check-announce>
        {busy
          ? "Reading the pull request from GitHub and checking it."
          : result
            ? `${verdictSentence(result.rows).headline}.`
            : ""}
      </p>
      {/* A shared ?pr= link fills this in after load: hold a screen's height so the footer does not jump. */}
      <div className={cn(pr && "min-h-[100svh]")} data-check-slot>
        {busy && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Reading the pull request from GitHub and
            checking it…
          </p>
        )}
        {result && <Result result={result} />}
      </div>
    </div>
  );
}

function RowIcon({ status }: { status: CheckRow["status"] }) {
  if (status === "pass")
    return <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />;
  if (status === "fail")
    return <X className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={2.6} />;
  if (status === "warn") return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />;
  return <Minus className="mt-0.5 size-4 shrink-0 text-subtle" />;
}

function Result({ result }: { result: Ok }) {
  const { pull, rows, verdict } = result;
  const link = { owner: pull.owner, repo: pull.repo, number: pull.number };
  const [origin, setOrigin] = useState("https://aperturesais.grok.me");
  useEffect(() => setOrigin(window.location.origin), []);
  const shareUrl = `${origin}/check?pr=${pullLinkPath(link)}`;
  const setupUrl = `${origin}/bot?tab=check`;
  const said = headline(rows);
  const sentence = verdictSentence(rows);
  const post = `Aperture checked ${pull.owner}/${pull.repo}#${pull.number}${pull.agent ? `, written by ${pull.agent}` : ""}: ${said}.`;

  return (
    <section className="mt-8" aria-labelledby="check-result" data-pull-check={verdict}>
      <div className="rounded-2xl border border-border bg-surface">
        <header className="border-b border-border p-4 sm:p-5">
          <p className="font-mono text-xs text-subtle">
            {pull.owner}/{pull.repo} #{pull.number}
            {pull.state && ` · ${pull.state}`} · {pull.changedFiles}{" "}
            {pull.changedFiles === 1 ? "file" : "files"} changed
          </p>
          <h2 id="check-result" className="mt-1 text-lg font-medium tracking-tight text-pretty">
            <a href={pullUrl(link)} target="_blank" rel="noreferrer" className="hover:underline">
              {pull.title}
              <ExternalLink className="ml-1.5 inline size-3.5 align-baseline text-subtle" />
            </a>
          </h2>
          <p className="mt-1 text-sm text-muted">
            by {pull.author || "someone"}
            {pull.agent && (
              <span className="ml-2 rounded-md border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-xs text-fg">
                {pull.agent}
              </span>
            )}
          </p>
          {/* The answer first, in the editor's words; the rows under it are the evidence. */}
          <div
            className={cn(
              "mt-4 rounded-xl px-3 py-2.5",
              verdict === "red" ? "bg-danger/10" : verdict === "look" ? "bg-warn/10" : "bg-ok/10",
            )}
            data-check-verdict={verdict}
          >
            <p
              className={cn(
                "flex items-start gap-2 text-lg leading-snug font-semibold tracking-tight sm:text-xl",
                verdict === "red" ? "text-danger" : verdict === "look" ? "text-warn" : "text-ok",
              )}
            >
              {verdict === "red" ? (
                <X className="mt-1 size-5 shrink-0" aria-hidden />
              ) : verdict === "look" ? (
                <AlertTriangle className="mt-1 size-5 shrink-0" aria-hidden />
              ) : (
                <Check className="mt-1 size-5 shrink-0" aria-hidden />
              )}
              {sentence.headline}
            </p>
            {sentence.detail && <p className="mt-1 text-sm text-muted">{sentence.detail}</p>}
          </div>
        </header>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">
            Nothing in this pull request could be read as text, so there is nothing to check.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex gap-3 p-4 sm:px-5"
                data-row={row.id}
                data-status={row.status}
              >
                <RowIcon status={row.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      row.status === "fail" ? "text-danger" : "text-fg",
                    )}
                  >
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-sm break-words text-muted">{row.detail}</p>
                  {row.evidence && row.status === "fail" && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-subtle hover:text-fg">
                        What it saw
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-xs leading-5 whitespace-pre-wrap text-muted">
                        {row.evidence}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {(result.notChecked.length > 0 || result.notes.length > 0) && (
          <div className="border-t border-border p-4 text-xs text-subtle sm:px-5">
            {result.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            {result.notChecked.length > 0 && (
              <p className="break-words">
                Not read (binary, over 1 MB, or not text):{" "}
                {result.notChecked.slice(0, 8).join(", ")}
                {result.notChecked.length > 8 && ` and ${result.notChecked.length - 8} more`}.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-pretty text-subtle">
        Read from GitHub {new Date(result.checkedAt).toLocaleString()}. Nothing was installed and
        none of the pull request&apos;s code ran: Types and the tests need the project installed, so
        Agent Check runs them in the repository&apos;s own CI.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4 text-subtle" /> Share this check
          </p>
          <CopyBlock title="Link" className="mt-3">
            {shareUrl}
          </CopyBlock>
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(post)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
          >
            Post it on X
          </a>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Check every pull request, not just this one</p>
          <p className="mt-1 text-sm text-muted">
            Agent Check runs these rows and Types and the tests on each pull request, with notes on
            the lines that fail.
          </p>
          <Link
            to="/bot"
            search={{ tab: "check" }}
            className={cn(buttonVariants({ size: "sm" }), "mt-3")}
          >
            Add Agent Check →
          </Link>
        </div>
      </div>
      <CopyBlock title="A comment for the pull request" className="mt-4">
        {shareMarkdown(rows, shareUrl, setupUrl)}
      </CopyBlock>
    </section>
  );
}
