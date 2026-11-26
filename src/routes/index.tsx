import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/site/landing";
import { canonicalLink } from "@/lib/seo";

/** The front page, for everyone, signed in or not: the app is a click away (Open, Chat, Bot). */
export const Route = createFileRoute("/")({
  head: () => ({ links: [canonicalLink("/")] }),
  component: Landing,
});
