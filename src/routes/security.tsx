import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/security")({ component: SecurityPage });

function SecurityPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Trust boundaries</p>
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-muted underline-offset-2 hover:text-fg hover:underline">
            Privacy
          </Link>
          <span className="text-fg">Security</span>
          <Link to="/terms" className="text-muted underline-offset-2 hover:text-fg hover:underline">
            Terms
          </Link>
        </nav>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">Security</h1>
        <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
          What we try to protect, where the walls are, and how to report a hole. The{" "}
          <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
            privacy page
          </Link>{" "}
          is the one that says what data leaves the browser. This page is about who can reach what after that.
        </p>

        <h2 className="mt-10 text-lg font-medium tracking-tight">Threat model</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Aperture is an editor that runs agent-written code and talks to model providers with your keys. The main
          risks we design against:
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-fg">Agent-written code escaping the tab.</span> Parse, import, and type checks, the
            page preview, and <span className="text-fg">npm run test</span> in the built-in runner run in the browser.
            The test runner is a Worker inside a{" "}
            <span className="text-fg">sandbox=&quot;allow-scripts&quot;</span> frame with an opaque origin and a CSP
            that blocks the network. That code must not reach Aperture&apos;s API, the page&apos;s storage, or the
            open internet.
          </li>
          <li>
            <span className="text-fg">Your keys and tokens leaving the place they belong.</span> Provider keys, custom
            endpoint keys, GitHub tokens, and MCP tokens are encrypted with AES-256-GCM on the account. The browser
            only sees the last four characters. On a send, the server decrypts the key you chose and calls that
            provider. There is no shared Grok key on the hosted demo.
          </li>
          <li>
            <span className="text-fg">Secrets in the project being sent to a model.</span>{" "}
            <span className="text-fg">.env</span> (not <span className="text-fg">.env.example</span>), private keys,
            and credential files are dropped before a send. Lines that look like API keys, tokens, or passwords are
            replaced with <span className="text-fg">[redacted]</span>.
          </li>
          <li>
            <span className="text-fg">A verify sandbox reading this app&apos;s secrets.</span> When a project is run in
            a server-side sandbox, it only gets a closed environment (
            <span className="text-fg">CI</span>, <span className="text-fg">NODE_ENV=test</span>, npm flags) — never this
            app&apos;s database URL, session secrets, or provider keys. Network is limited to package registries.
          </li>
          <li>
            <span className="text-fg">Account and session abuse.</span> Sign-in holds the saved project and encrypted
            keys. Sessions can be ended by signing out. See the privacy page for what is stored on the account.
          </li>
        </ul>

        <h2 className="mt-10 text-lg font-medium tracking-tight">Honest limits</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-fg">Not pure browser-only after sign-in.</span> Once you sign in, the project is saved
            to your account as you edit. Each Composer, Chat, Inline, or Tab send uploads a snapshot to Aperture&apos;s
            server. The server uses that snapshot to run tools, then forwards the prompt to the provider you picked
            (unless the host is in replay mode). Localhost Ollama / LM Studio is the exception: that turn stays on
            your machine.
          </li>
          <li>
            <span className="text-fg">Browser sandbox walls are browser walls.</span> Opaque origin + CSP is as far as
            a tab can go. A browser bug, a mis-set sandbox attribute, or a future runner change could weaken that.
            Reports that show a path out of the runner are especially welcome.
          </li>
          <li>
            <span className="text-fg">Server-side sandbox network is allowlisted, not air-gapped.</span> Package
            installs need registry access (
            <span className="text-fg">registry.npmjs.org</span>, related hosts,{" "}
            <span className="text-fg">codeload.github.com</span>). That narrows exfiltration; it is not a claim that
            untrusted code is safe to run.
          </li>
          <li>
            <span className="text-fg">A green check is not a security review.</span> Checks catch parse, import, type,
            preview, and test failures on staged edits. They do not prove the change is safe to ship or free of
            vulnerabilities in your app.
          </li>
          <li>
            <span className="text-fg">You choose what to open and send.</span> Opening a repo or folder you are not
            allowed to send to a provider is still your responsibility. The model sees the prompt for that turn under
            that provider&apos;s terms.
          </li>
        </ul>

        <h2 className="mt-10 text-lg font-medium tracking-tight">Sandbox limits (summary)</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">Surface</th>
                <th className="px-4 py-2 font-medium">Boundary</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-fg">In-tab tests</td>
                <td className="px-4 py-3 text-muted">
                  Worker in sandboxed frame, opaque origin, CSP blocks network. ~10s budget.
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-fg">Preview / render check</td>
                <td className="px-4 py-3 text-muted">Script-sandboxed frame with an opaque origin.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-fg">Server verify run</td>
                <td className="px-4 py-3 text-muted">
                  Declared <span className="text-fg">package.json</span> scripts only (no{" "}
                  <span className="text-fg">dev</span>/<span className="text-fg">start</span>/
                  <span className="text-fg">watch</span>). Closed env. Registry allowlist. Time cap.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-medium tracking-tight">Vulnerability disclosure</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Please do not report security problems in public issues.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Report them privately through GitHub: open the repository&apos;s{" "}
          <a
            href="https://github.com/Hankaws/aperture/security/advisories/new"
            className="text-fg underline-offset-2 hover:underline"
          >
            Security → Report a vulnerability
          </a>{" "}
          form. Include what an attacker could do, the steps to reproduce it, and the version or commit you tested.
          You&apos;ll get an answer within a week.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The same policy lives in{" "}
          <a
            href="https://github.com/Hankaws/aperture/blob/main/SECURITY.md"
            className="text-fg underline-offset-2 hover:underline"
          >
            SECURITY.md
          </a>
          . Areas where a report is especially welcome: the in-browser test runner (
          <span className="text-fg">src/lib/runner/</span>), preview and render-check frames, the agent&apos;s run
          allowance and sandbox env (<span className="text-fg">src/lib/sandbox/policy.ts</span>), and sign-in /
          session handling.
        </p>

        <p className="mt-10 text-sm text-muted">
          Questions about data handling go to the{" "}
          <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
            privacy page
          </Link>
          . How often checks stop a bad edit is on the{" "}
          <Link to="/benchmark" className="text-fg underline-offset-2 hover:underline">
            checks benchmark
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
