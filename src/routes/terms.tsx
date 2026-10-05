import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/terms")({ component: TermsPage });

const SECTIONS: Array<{ title: string; body: ReactNode }> = [
  {
    title: "1. These terms",
    body: (
      <>
        These terms cover the hosted Aperture editor. If you use the site, you agree to them. The source code is
        separate: it is under the{" "}
        <a
          href="https://github.com/Hankaws/aperture/blob/main/LICENSE"
          className="text-fg underline-offset-2 hover:underline"
        >
          MIT license
        </a>
        , and running your own copy is the same program on a machine you control.
      </>
    ),
  },
  {
    title: "2. The service",
    body: (
      <>
        Aperture is an editor in the browser. You open a project, ask for a change, and decide what to keep. The
        hosted site can be unavailable, slow, or changed. It is offered as it is. A green check is not a promise that
        a change is correct, safe, or ready to ship.
      </>
    ),
  },
  {
    title: "3. Accounts",
    body: (
      <>
        You sign in with email, or with Grok where that button is offered. The account holds your settings, the plan
        label, and the secrets you choose to save. You are responsible for the password and for what is done with the
        account. Signing out ends the session in that browser.
      </>
    ),
  },
  {
    title: "4. Your projects",
    body: (
      <>
        You choose the folder, zip, or repository you open. You need the right to put that code into the editor and,
        when you send, to pass it to the provider you picked. Do not open a repository you are not allowed to send.
        Aperture does not claim your code. What a send includes, and what stays in the tab, is on the{" "}
        <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
          privacy page
        </Link>
        .
      </>
    ),
  },
  {
    title: "5. Keys and other companies",
    body: (
      <>
        You attach your own key for Grok, OpenAI, Anthropic, Gemini, DeepSeek, or a custom endpoint. That company
        bills you under their terms. Aperture does not use a shared key. If the key you picked is missing, the send
        stops. A GitHub token, if you connect one, is used only for the GitHub actions you take. Those companies see
        what their own terms say they see.
      </>
    ),
  },
  {
    title: "6. Checks",
    body: (
      <>
        Parse, imports, types, the preview, and the test run are tools. A pass means that step succeeded. It does not
        mean the change is right. You choose Apply. The built-in test runner has no network. A project that needs a
        real Node may run elsewhere, and that run follows that host’s terms.
      </>
    ),
  },
  {
    title: "7. The public demo",
    body: (
      <>
        aperturesais.grok.me answers from recorded runs. It does not call a model provider. It is for looking at the
        editor, not for keeping a private repository.
      </>
    ),
  },
  {
    title: "8. Price",
    body: (
      <>
        The hosted site does not charge you today. Prices marked “coming soon” are not on sale. A provider you call
        with your own key charges you on their side. If a paid plan is offered later, the price is the one shown at
        the time you choose it, and these terms will say so.
      </>
    ),
  },
  {
    title: "9. Acceptable use",
    body: (
      <>
        Do not use the editor to break into a system, to send code you have no right to send, or to hide a key in a
        prompt on purpose. Do not hammer the hosted site so that other people cannot use it. We can refuse a send or
        close an account that is used this way.
      </>
    ),
  },
  {
    title: "10. Stopping",
    body: (
      <>
        You can stop by signing out. You can delete the account from Settings. That removes the saved project, the
        keys, the GitHub token, the account, and the copy in that browser. We can suspend the hosted site, or an
        account that breaks these terms. Your own copy of the MIT source is not affected.
      </>
    ),
  },
  {
    title: "11. Changes",
    body: (
      <>
        If these terms change, the page changes, and the date below changes. Using the hosted site after that means
        you accept the new terms. The date of this version is 4 October 2026.
      </>
    ),
  },
  {
    title: "12. Contact",
    body: (
      <>
        Questions about these terms go to the public repository:{" "}
        <a href="https://github.com/Hankaws/aperture" className="text-fg underline-offset-2 hover:underline">
          github.com/Hankaws/aperture
        </a>
        .
      </>
    ),
  },
];

function TermsPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Using Aperture</p>
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-muted underline-offset-2 hover:underline hover:text-fg">
            Privacy
          </Link>
          <Link to="/security" className="text-muted underline-offset-2 hover:underline hover:text-fg">
            Security
          </Link>
          <span className="text-fg">Terms</span>
        </nav>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">Terms</h1>
        <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
          The rules for the hosted editor. Twelve short sections. The privacy page is the one that says what leaves
          the browser. The security page covers threat model, sandboxes, and disclosure.
        </p>
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mt-10 text-lg font-medium tracking-tight">{section.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">{section.body}</p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
