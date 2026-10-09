import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSlot({ compact = false, plain = false }: { compact?: boolean; plain?: boolean }) {
  const { user, isPending } = useHydratedUserState();
  if (isPending) {
    return <div className={cn("animate-pulse rounded-lg bg-elevated", compact ? "h-8 w-8 rounded-full" : "h-10 w-28")} />;
  }
  if (user) {
    return (
      <div className="flex min-w-0 items-center gap-5">
        {!compact && (
          <Link to="/app" className={plain ? "text-sm text-fg hover:text-muted" : cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            {plain ? "Open →" : "Open editor"}
          </Link>
        )}
        {/* The site's bar has no room for a name and Sign out: they are in the avatar's menu. */}
        <UserButton compact={compact || plain} />
      </div>
    );
  }
  if (plain) {
    return (
      <Link to="/login" search={{ next: "/app" }} className="shrink-0 text-sm text-fg hover:text-muted">
        Open →
      </Link>
    );
  }
  if (compact) {
    return (
      <Link
        to="/login"
        search={{ next: "/app" }}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2.5 text-xs")}
      >
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {/* Same page as Start free; dropped on the narrowest phones so the bar fits. */}
      <Link
        to="/login"
        search={{ next: "/app" }}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
      >
        Sign in
      </Link>
      <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "sm" }))}>
        Start free
      </Link>
    </div>
  );
}
