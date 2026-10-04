import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { deleteAccount } from "@/lib/account/delete";
import { clearGithubToken } from "@/lib/github/roundtrip";
import { haltWorkspaceSync } from "@/lib/workspace/sync-controller";
import { discardLocalProject } from "@/lib/workspace/store";

export function DeleteAccount() {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = phrase.trim().toLowerCase() === "delete";

  return (
    <section className="mt-12 rounded-2xl border border-danger/40 p-5">
      <h2 className="text-lg font-medium tracking-tight">Delete account</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        This removes the saved project, your keys, your GitHub token, and the account. It also removes the project in
        this browser, so it is not saved again the next time you sign in. It cannot be undone.
      </p>
      <label className="mt-4 block text-sm text-muted" htmlFor="delete-account">
        Type <span className="text-fg">delete</span> to confirm
      </label>
      <input
        id="delete-account"
        value={phrase}
        autoComplete="off"
        disabled={busy}
        onChange={(event) => setPhrase(event.target.value)}
        className="mt-2 w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      />
      <Button
        variant="outline"
        className="mt-4"
        disabled={busy || !confirmed}
        onClick={() => {
          setBusy(true);
          haltWorkspaceSync();
          void deleteAccount()
            .then(async (result) => {
              if (!result.ok) throw new Error(result.error);
              discardLocalProject();
              clearGithubToken();
              try {
                await signOut("/");
              } catch {
                window.location.href = "/";
              }
            })
            .catch((error: unknown) => {
              setBusy(false);
              toast.error(error instanceof Error ? error.message : "Could not delete the account");
            });
        }}
      >
        {busy ? "Deleting…" : "Delete account"}
      </Button>
    </section>
  );
}