import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import { ApertureMark } from "@/components/ide/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteNav } from "@/components/site/site-nav";

const NEXT_ROUTES = ["/app", "/bot", "/pricing", "/settings"] as const;
type NextRoute = (typeof NEXT_ROUTES)[number];

function parseNext(value: unknown): NextRoute {
  return NEXT_ROUTES.includes(value as NextRoute) ? (value as NextRoute) : "/app";
}

/**
 * What to say when Google or X sign-in comes back with an error. Better Auth
 * redirects here with `?error=<code>`; only the code is read, never shown.
 */
/** Where to report an account someone made with your email: a private GitHub security report. */
const REPORT_URL = "https://github.com/Hankaws/aperture/security/advisories/new";

function providerErrorMessage(code: string): string {
  if (code === "account_not_linked")
    return "An account with this email was already made with a password, and its email was never confirmed, so Aperture won't join this sign-in to it. Sign in with that email and password below.";
  return "That sign-in didn't complete. Try again.";
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next: NextRoute; error?: string } => ({
    next: parseNext(s.next),
    ...(typeof s.error === "string" && s.error ? { error: s.error } : {}),
  }),
  component: Login,
});

function Login() {
  const { next, error: providerError } = Route.useSearch();
  const { user, isPending } = useHydratedUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg">
        <SiteNav />
        <div className="mx-auto mt-24 h-40 max-w-sm animate-pulse rounded-2xl bg-elevated" />
      </div>
    );
  }
  if (user) {
    if (next === "/settings") return <Navigate to="/settings" search={{ tab: "plan" }} />;
    return <Navigate to={next} />;
  }

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name: name || email.split("@")[0]! });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message);
      }
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto grid max-w-md place-items-center px-4 py-16">
        <div className="w-full rounded-2xl border border-border bg-surface p-6">
          <ApertureMark className="size-7" />
          <h1 className="mt-4 text-xl font-medium tracking-tight">Sign in to Aperture</h1>
          <p className="mt-1 text-sm text-muted">One account for the editor and your API keys.</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Before you open a repo or add a key, read{" "}
            <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
              what code leaves the browser
            </Link>{" "}
            (after sign-in the project is saved and each send goes through Aperture&apos;s server) and the{" "}
            <Link to="/security" className="text-fg underline-offset-2 hover:underline">
              security page
            </Link>{" "}
            and the{" "}
            <Link to="/terms" className="text-fg underline-offset-2 hover:underline">
              terms
            </Link>
            .
          </p>

          {providerError && (
            <p role="alert" className="mt-4 rounded-lg border border-border bg-elevated p-3 text-sm leading-relaxed text-fg">
              {providerErrorMessage(providerError)}
              {providerError === "account_not_linked" && (
                <>
                  {" "}
                  Didn&apos;t make that account? Someone else may have used your email.{" "}
                  <a
                    href={REPORT_URL}
                    className="underline underline-offset-2 hover:text-accent"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Report it privately
                  </a>{" "}
                  and it will be removed, so you can sign in with Google or X.
                </>
              )}
            </p>
          )}

          {authEnabled ? (
            <div className="mt-6 flex flex-col gap-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => void signIn(provider.providerId, { callbackURL: next, errorCallbackURL: "/login" })}
                >
                  Continue with {provider.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
          )}

          <div className="my-6 flex items-center gap-3 text-[11px] tracking-wide text-subtle uppercase">
            <span className="h-px flex-1 bg-border" />
            Email
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="mb-3 flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              className={`h-10 flex-1 rounded-md text-sm ${mode === "in" ? "bg-elevated text-fg" : "text-muted"}`}
              onClick={() => setMode("in")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`h-10 flex-1 rounded-md text-sm ${mode === "up" ? "bg-elevated text-fg" : "text-muted"}`}
              onClick={() => setMode("up")}
            >
              Create account
            </button>
          </div>

          <form className="space-y-3" onSubmit={(event) => void onEmail(event)}>
            {mode === "up" && (
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" autoComplete="name" />
            )}
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@studio.dev"
              autoComplete="email"
            />
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-subtle">
            New accounts start on Hobby, which is free. Paid plans are{" "}
            <Link to="/pricing" className="text-muted hover:text-fg">
              coming soon
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
