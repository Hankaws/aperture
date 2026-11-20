import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Landing } from "@/components/site/landing";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({
  // `?about`: the site's front page even when signed in ("About Aperture" in the sidebar).
  validateSearch: (s: Record<string, unknown>): { about?: boolean } =>
    s.about === true || s.about === "true" || s.about === "1" ? { about: true } : {},
  component: Home,
});

/**
 * The front page. Signed in to an account, Aperture opens on your chat, as
 * Grok opens on its box; the front page stays one click away. Signed out, or
 * with sign-in off (everyone the same visitor), it is the front page.
 */
function Home() {
  const { about } = Route.useSearch();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const account = Boolean(user && !user.isDevFallback);
  useEffect(() => {
    if (account && !about) void navigate({ to: "/chat", search: {}, replace: true });
  }, [account, about, navigate]);
  return <Landing />;
}
