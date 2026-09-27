import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSlot({ compact = false }: { compact?: boolean }) {
  const { user, isPending } = useHydratedUserState();
  if (isPending) {
    return <div className={cn("animate-pulse rounded-lg bg-elevated", compact ? "h-8 w-8 rounded-full" : "h-10 w-28")} />;
  }
  if (user) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        {!compact && (
          <Link to="/app" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            Open editor
          </Link>
        )}
        <UserButton compact={compact} />
      </div>
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
      <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        Sign in
      </Link>
      <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "sm" }))}>
        Start free
      </Link>
    </div>
  );
}
