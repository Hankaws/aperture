import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearGithubAccount, githubStatus, saveGithubToken, type GithubAccount } from "@/lib/github/api";
import { clearGithubToken } from "@/lib/github/roundtrip";

/** GitHub's new-token form with the scopes this card asks for already ticked. */
const NEW_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo,workflow&description=Aperture";

/** GitHub on the signed-in account. The token stays on the server. `onAccount` hears every change. */
export function GithubAccountCard({ onAccount }: { onAccount?: (account: GithubAccount) => void } = {}) {
  const [account, setAccount] = useState<GithubAccount | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Until the status is known the card offers no token box: a connected
  // account shown as "Not connected" invites pasting over a working token.
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoadFailed(false);
    githubStatus()
      .then((next) => {
        if (!cancel) setAccount(next);
      })
      .catch(() => {
        if (!cancel) setLoadFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (account) onAccount?.(account);
  }, [account, onAccount]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await saveGithubToken({ data: { token } });
      if (!next.ok) {
        setError(next.error);
        return;
      }
      // The account holds it, encrypted. Nothing is kept in this browser.
      setToken("");
      setAccount(next);
      toast.success(`GitHub connected as ${next.login}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the token.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      setAccount(await clearGithubAccount());
      clearGithubToken();
      toast.success("GitHub disconnected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">GitHub</p>
          <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
            Connect the account you sign in with. Private repos, push, pull requests, and merge then use this token.
            It needs repo access. It is encrypted and never sent back here.
          </p>
        </div>
        {!account ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
            {loadFailed ? "Unknown" : "Checking…"}
          </span>
        ) : account.connected ? (
          <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs text-ok">
            {account.login}
            {account.last4 ? ` ···${account.last4}` : ""}
          </span>
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle">Not connected</span>
        )}
      </div>
      {!account ? (
        loadFailed && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">Could not check the GitHub connection.</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          </div>
        )
      ) : account.connected ? (
        <div className="mt-4">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            Disconnect
          </Button>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="GitHub token, repo scope"
            className="font-mono"
          />
          <Button type="submit" disabled={busy || token.trim().length < 20} className="sm:w-36">
            {busy ? "Saving…" : "Connect"}
          </Button>
        </form>
      )}
      {account && !account.connected && (
        <p className="mt-2 text-xs text-subtle">
          No token yet?{" "}
          <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            Make one on GitHub
          </a>
          , with the repo and workflow scopes already ticked, then paste it here.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
