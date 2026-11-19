import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { MascotAvatar } from "./mascot";
import { useLocalBot } from "./use-my-bot";

/**
 * The way to the person's own bot from elsewhere (the Bot page): its face
 * and name, and the Chat page, its one home, where all its chats are.
 */
export function MyBotCard({ className }: { className?: string }) {
  const bot = useLocalBot();
  return (
    <Link
      to="/chat"
      className={cn(
        "group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-fg/20 sm:p-5",
        className,
      )}
    >
      {bot ? <MascotAvatar mascot={bot.mascot} size={56} label="" /> : <BotAvatar size="lg" />}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">
          {bot ? `Chat with ${bot.name}` : "Meet your own bot"}
        </span>
        <span className="mt-0.5 flex items-start gap-1 text-sm text-pretty text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {bot
            ? "Your own bot: ask it anything, no repository needed. Every chat is kept on the Chat page."
            : "Name it, give it a face, and ask it anything, no repository needed. Only you talk to it."}
        </span>
      </span>
      <span
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "hidden shrink-0 gap-1.5 sm:inline-flex",
        )}
        aria-hidden
      >
        Open Chat
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
