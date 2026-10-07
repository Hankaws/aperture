import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

const SEES = [
  ["Your Grok key", "xAI", "api.x.ai"],
  ["Your GPT key", "OpenAI", "api.openai.com"],
  ["Your Claude key", "Anthropic", "api.anthropic.com"],
  ["Your Gemini key", "Google", "aistudio.google.com"],
  ["Your DeepSeek key", "DeepSeek", "api.deepseek.com"],
  ["A custom endpoint", "The host you typed", "Ollama, LM Studio, OpenRouter, or another OpenAI-compatible URL"],
  [
    "A model on this computer",
    "Only your machine",
    "Your browser tab calls Ollama or LM Studio on localhost. The turn does not pass through Aperture's server.",
  ],
  ["Replay, including the public demo", "Nobody", "A recorded answer. No provider is called."],
] as const;

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Data handling</p>
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="text-fg">Privacy</span>
          <Link to="/security" className="text-muted underline-offset-2 hover:text-fg hover:underline">
            Security
          </Link>
          <Link to="/terms" className="text-muted underline-offset-2 hover:text-fg hover:underline">
            Terms
          </Link>
        </nav>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">What leaves the browser</h1>
        <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
          Aperture is not pure browser-only after you sign in. Two copies can leave this tab: the project is saved to
          your account as you edit, and each send uploads a snapshot through Aperture's server before the provider
          you picked is called. Checks and the in-tab test sandbox stay in the browser. Threat model and disclosure
          are on the{" "}
          <Link to="/security" className="text-fg underline-offset-2 hover:underline">
            security page
          </Link>
          .
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">What stays in the tab</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>Signed out, the project stays in this browser. It is not uploaded.</li>
          <li>Parse, import, and type checks, and the page preview, run in the tab. They do not call a model.</li>
          <li>
            <span className="text-fg">npm run test</span> in the built-in runner is a Worker with no network access. That
            code cannot reach Aperture or anything else.
          </li>
          <li>Design mode stays in the tab until you send the capture to Composer.</li>
          <li>
            <span className="text-fg">.env</span>, private keys, and credential files stay on this device. They are not
            saved and they are not sent.
          </li>
        </ul>

        <h2 className="mt-10 text-lg font-medium tracking-tight">What is saved when you sign in</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The rest of the project is saved on the account as you edit. It does not expire. Delete the account in
          Settings to remove it, with your keys and your GitHub token. That also removes the copy in this browser, so
          the next sign-in does not save it again. If a secret file was saved earlier, the next save removes it and
          does not load it back.
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">What a send includes</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Composer, Chat, Inline, and Tab each take a server hop. The browser uploads a snapshot for that turn to
          Aperture's server. That snapshot is your instruction, recent chat, the file tree, a symbol map, the open
          file, the selection, a short note of the cursor line and anything you just typed or dismissed, files you
          attach with @, and files the agent reads with its tools. The server uses that snapshot to run the tools, then
          forwards the prompt to the provider you picked. The saved project is the other copy. A model on this computer
          (Ollama / LM Studio on localhost) is the exception: that turn does not pass through Aperture's server.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Secret-looking files are dropped before the send: <span className="text-fg">.env</span> (not{" "}
          <span className="text-fg">.env.example</span>), private keys, and credential files. Lines that look like API
          keys, tokens, or passwords are replaced with <span className="text-fg">[redacted]</span>. Your provider key
          is not put in the prompt.
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">Where keys are stored</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            A provider key, a custom-endpoint key, a GitHub token, and an MCP token are encrypted with AES-256-GCM
            before they are saved on the account.
          </li>
          <li>The browser is only sent the last four characters. The full key is not returned.</li>
          <li>On a send, the server decrypts the key you chose and calls that provider. There is no shared Grok key. If the key is missing, the send stops.</li>
        </ul>

        <h2 className="mt-10 text-lg font-medium tracking-tight">What each model can see</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Every real model gets the same prompt for that turn. The difference is who receives it. They do not receive
          your key.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">You pick</th>
                <th className="px-4 py-2 font-medium">Who sees the prompt</th>
              </tr>
            </thead>
            <tbody>
              {SEES.map(([pick, who, where]) => (
                <tr key={pick} className="border-t border-border">
                  <td className="px-4 py-3 text-fg">{pick}</td>
                  <td className="px-4 py-3 text-muted">
                    {who}
                    <span className="mt-0.5 block text-xs text-subtle">{where}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-medium tracking-tight">GitHub</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Connecting GitHub stores an encrypted token on the account and uses it to list, read, push, and review the
          repos you granted. Opening a repo downloads the files into the tab. A later send can include those files, the
          same as a folder you dropped. The token itself is not sent to the model.
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">Agents that check their work here</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          An agent you connect in Settings → Agents sends the project's files and its change to Aperture's MCP server.
          The server parses and type-checks them in memory and answers. Nothing in them is run, saved, logged, or sent
          to a model. The agent signs in with a token that is shown to you once; the account keeps only a SHA-256 hash
          of it, with its name and when it was last used. Revoking the token, or deleting the account, removes it.
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">The public demo</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          On aperturesais.grok.me, and wherever the server is started with{" "}
          <span className="text-fg">APERTURE_MODEL=replay</span>, a send is a recording. It does not call a provider,
          even if you added your own key. The key is still saved on the account. On any other host, the key you pick
          is the one that is called.
        </p>

        <p className="mt-10 text-sm text-muted">
          Keys are added under{" "}
          <Link to="/settings" search={{ tab: "models" }} className="text-fg underline-offset-2 hover:underline">
            Settings → Models
          </Link>
          . Sandbox limits and how to report a vulnerability are on the{" "}
          <Link to="/security" className="text-fg underline-offset-2 hover:underline">
            security page
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
