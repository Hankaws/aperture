import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listGithubRepos, type GithubRepoSummary } from "@/lib/github/api";
import { askBot } from "@/lib/github/bot";

/**
 * Asks the bot for Agent Check on one pull request: posts `/aperture check`
 * on it, as the person, and the bot's workflow on that repository does the
 * rest. Nothing on the pull request changes.
 */
export function CheckPull() {
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [repo, setRepo] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<{ number: number; url: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    void listGithubRepos({ data: {} })
      .then((out) => {
        if (cancel) return;
        if (!out.ok) {
          setError(out.error);
          setRepos([]);
          return;
        }
        setRepos(out.repos);
        setRepo((r) => r || out.repos[0]?.fullName || "");
      })
      .catch(() => !cancel && setRepos([]));
    return () => {
      cancel = true;
    };
  }, []);

  const pull = Number(number.replace(/^#/, ""));
  const ready = Boolean(repo) && Number.isSafeInteger(pull) && pull > 0;

  async function send() {
    const [owner, name] = repo.split("/");
    if (!owner || !name || !ready) return;
    setBusy(true);
    setError(null);
    setAsked(null);
    try {
      const out = await askBot({ data: { owner, repo: name, number: pull, task: "check" } });
      if (out.ok) setAsked({ number: out.number, url: out.url });
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ask the bot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-surface p-5"
      aria-labelledby="check-pull"
    >
      <h3 id="check-pull" className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4 text-subtle" />
        Check a pull request now
      </h3>
      <p className="mt-1 text-sm text-pretty text-muted">
        Posts <code className="font-mono text-xs">/aperture check</code> on it as you. The
        repository needs the bot&apos;s workflow: add it from a bot&apos;s Setup, on the Team tab.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <select
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          disabled={!repos?.length}
          aria-label="Repository"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm text-fg"
        >
          {repos === null && <option value="">Loading your repositories…</option>}
          {repos?.length === 0 && <option value="">No repositories</option>}
          {repos?.map((r) => (
            <option key={r.fullName} value={r.fullName}>
              {r.fullName}
            </option>
          ))}
        </select>
        <Input
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          inputMode="numeric"
          placeholder="Pull request #"
          aria-label="Pull request number"
          className="sm:w-40"
        />
        <Button type="submit" disabled={busy || !ready}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Check it
        </Button>
      </form>
      {asked && (
        <p className="mt-3 text-sm text-muted">
          Asked on{" "}
          <a
            href={asked.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-accent hover:underline"
          >
            #{asked.number}
            <ArrowUpRight className="size-3.5" />
          </a>
          . The report lands there, and in the bot&apos;s Activity.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
