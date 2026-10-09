import { useState } from "react";
import {
  Check,
  CircleDashed,
  Download,
  ExternalLink,
  GitPullRequest,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { setBotApp, type BotSetup } from "@/lib/github/bot";
import { appManifest, newAppUrl } from "@/lib/bot/app-manifest";
import { APP_ID_VARIABLE, APP_KEY_SECRET, WORKFLOW_PATH } from "@/lib/bot/tasks";
import type { Mascot } from "@/lib/bot/mascot";
import { BotAvatar } from "./bot-avatar";
import { downloadMascot } from "@/lib/bot/mascot-png";
import { MascotAvatar } from "./mascot";

const AVATAR = "/bot/aperture-bot.png";

function Mark({ value }: { value: boolean | null }) {
  if (value === true) return <Check className="size-4 shrink-0 text-ok" aria-label="Done" />;
  if (value === false) return <X className="size-4 shrink-0 text-danger" aria-label="Not done" />;
  return <CircleDashed className="size-4 shrink-0 text-subtle" aria-label="Cannot tell" />;
}

/**
 * Starts GitHub's "new app from a manifest" page in a new tab, prefilled.
 * A form post is how GitHub takes a manifest; nothing comes back to
 * Aperture but the redirect to the Bot page.
 */
function createApp(owner: string, ownerType: string) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = `${newAppUrl(owner, ownerType)}?state=${crypto.randomUUID()}`;
  form.target = "_blank";
  form.rel = "noopener";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "manifest";
  input.value = JSON.stringify(appManifest(owner, window.location.origin));
  form.append(input);
  document.body.append(form);
  form.submit();
  form.remove();
}

/** How the bot shows up on GitHub: as the workflow, or as the repository's own app. */
export function IdentityCard({
  setup,
  owner,
  name,
  mascot,
  botName,
}: {
  setup: BotSetup;
  owner: string;
  name: string;
  /** The team bot's own face: offered as the logo instead of the Aperture lens. */
  mascot?: Mascot;
  botName?: string;
}) {
  const workflow = setup.workflow!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [created] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("app") === "created",
  );
  const settings = `https://github.com/${setup.fullName}/settings`;
  const editable = workflow.path === WORKFLOW_PATH;

  async function switchTo(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      const out = await setBotApp({ data: { owner, repo: name, on } });
      if (out.ok) setOpened(out.url);
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the pull request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-5"
      aria-labelledby="bot-identity"
    >
      <div className="flex items-center gap-3">
        {mascot ? <MascotAvatar mascot={mascot} size={36} /> : <BotAvatar size="md" />}
        <div className="min-w-0">
          <h2 id="bot-identity" className="text-sm font-medium">
            On GitHub
          </h2>
          <p className="text-sm text-muted">
            {workflow.app
              ? "Posts as your own app, with its avatar."
              : "Posts as github-actions[bot]."}
          </p>
        </div>
      </div>

      {!workflow.app && (
        <>
          <p className="mt-4 text-sm text-pretty text-muted">
            Give it its own name and avatar, and let the pull requests it opens start your CI: make
            it a GitHub App of yours.
          </p>
          <ol className="mt-3 space-y-3 text-sm">
            <li>
              <p className="font-medium">1. Create the app</p>
              <p className="mt-0.5 text-muted">
                Prefilled with only what the bot needs.{" "}
                {created && <span className="text-ok">Created. </span>}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => createApp(owner, setup.ownerType)}
              >
                <ExternalLink className="size-4" />
                Create it on GitHub
              </Button>
            </li>
            <li>
              <p className="font-medium">2. On the app's page</p>
              <p className="mt-0.5 text-pretty text-muted">
                Generate a private key, upload{" "}
                {mascot ? (
                  <button
                    type="button"
                    onClick={() => void downloadMascot(mascot, botName ?? "aperture-bot")}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <Download className="size-3.5" />
                    {botName ? `${botName}'s avatar` : "the avatar"}
                  </button>
                ) : (
                  <a
                    href={AVATAR}
                    download="aperture-bot.png"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <Download className="size-3.5" />
                    the avatar
                  </a>
                )}{" "}
                as its logo, and install it on {setup.fullName}.
              </p>
            </li>
            <li>
              <p className="font-medium">3. Give the workflow its ID and key</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-center gap-2">
                  <Mark value={setup.appVariable} />
                  <a
                    href={`${settings}/variables/actions`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    Variable <code className="font-mono text-xs">{APP_ID_VARIABLE}</code>
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mark value={setup.appSecret} />
                  <a
                    href={`${settings}/secrets/actions`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    Secret <code className="font-mono text-xs">{APP_KEY_SECRET}</code>
                  </a>
                </li>
              </ul>
              <p className="mt-1 text-xs text-subtle">
                The key stays on GitHub. Aperture never sees it.
              </p>
            </li>
          </ol>
        </>
      )}

      {editable ? (
        <div className="mt-4 space-y-2">
          {!workflow.app && (
            <p className="text-sm">
              <span className="font-medium">4. Switch the workflow to the app</span>
              <span className="block text-muted">
                A pull request; nothing changes until it is merged.
              </span>
            </p>
          )}
          <Button
            size="sm"
            variant={workflow.app ? "ghost" : "default"}
            onClick={() => void switchTo(!workflow.app)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitPullRequest className="size-4" />
            )}
            {workflow.app ? "Post as the workflow again" : "Open the pull request"}
          </Button>
          {opened && (
            <p className="text-sm text-muted">
              <a
                href={opened}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Pull request opened
              </a>
              . It takes effect once merged.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-pretty text-muted">
          The bot's workflow is at{" "}
          <code className="font-mono text-xs break-all">{workflow.path}</code>; the bot's README
          shows the step to add there.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
