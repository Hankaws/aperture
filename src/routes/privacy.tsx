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
  ["Replay, including the public demo", "Nobody", "A recorded answer. No provider is called."],
] as const;

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Data handling</p>
        <nav className="mt-3 flex gap-4 text-sm">
          <span className="text-fg">Privacy</span>
          <Link to="/terms" className="text-muted underline-offset-2 hover:text-fg hover:underline">
            Terms
          </Link>
        </nav>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">What leaves the browser</h1>
        <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
          The editor, the checks, and the test sandbox stay in your tab. A model sees your code only when you send,
          and only the provider whose key you attached. Read this before you open a real repo or paste a key.
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">What stays in the tab</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>Files you drop, unzip, or open from GitHub live in this browser. The file tree, diffs, and Apply stay here.</li>
          <li>Parse, import, and type checks, and the page preview, run in the tab. They do not call a model.</li>
          <li>
            <span className="text-fg">npm run test</span> in the built-in runner is a Worker with no network access. That
            code cannot reach Aperture or anything else.
          </li>
          <li>Design mode stays in the tab until you send the capture to Composer.</li>
        </ul>

        <h2 className="mt-10 text-lg font-medium tracking-tight">What a send includes</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Composer, Chat, Inline, and Tab upload a snapshot for that turn. Nothing is uploaded while you are only
          editing. The snapshot is your instruction, recent chat, the file tree, a symbol map, the open file, the
          selection, a short note of the cursor line and anything you just typed or dismissed, files you attach with
          @, and files the agent reads with its tools. The server uses that snapshot to run the tools, then forwards
          the prompt to the provider you picked. It is not saved on your account as a copy of the repo.
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

        <h2 className="mt-10 text-lg font-medium tracking-tight">The public demo</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          aperturesais.grok.me runs in replay. Sends play back recorded answers and do not call xAI, OpenAI, Anthropic,
          Google, or DeepSeek. A repo you open there still stays in the tab until a send, and a send still does not
          leave for a provider.
        </p>

        <p className="mt-10 text-sm text-muted">
          Keys are added under{" "}
          <Link to="/settings" search={{ tab: "models" }} className="text-fg underline-offset-2 hover:underline">
            Settings → Models
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
