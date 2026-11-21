import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatPage } from "@/components/bot/chat-page";
import { SiteNav } from "@/components/site/site-nav";
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CHAT_ID } from "@/lib/bot/my-bot";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>): { c?: string } =>
    typeof s.c === "string" && CHAT_ID.test(s.c) ? { c: s.c } : {},
  head: () => pageHead("chat"),
  component: Chat,
});

/** The person's own bot, as Grok is theirs: its chats, on a page of their own. */
function Chat() {
  const { c } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  // Signed in, the chat is in the app's frame (`ChatPage`); signed out, on the site.
  if (user)
    return (
      <PanelBoundary name="The chat" className="flex h-dvh flex-col bg-bg">
        <ChatPage chat={c} />
      </PanelBoundary>
    );
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      {!isPending && <SiteNav />}
      <main className="flex min-h-0 flex-1 flex-col border-t border-border">
        {isPending ? (
          <div className="m-4 flex-1 animate-pulse rounded-2xl bg-elevated" aria-hidden />
        ) : (
          <div className="mx-auto max-w-md px-4 py-16 text-center">
            <h1 className="text-2xl font-medium tracking-tight">Your own bot</h1>
            <p className="mt-2 text-pretty text-muted">
              Name it, give it a face, and ask it anything. Sign in to meet it.
            </p>
            <Link
              to="/login"
              search={{ next: "/chat" }}
              className="mt-6 inline-block text-accent underline underline-offset-2"
            >
              Sign in
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
