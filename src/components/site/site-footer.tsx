import { Link } from "@tanstack/react-router";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import { ApertureMark } from "@/components/ide/logo";
import { showPricing } from "@/lib/billing/pricing-visible";

export function SiteFooter() {
  const { user, isPending } = useHydratedUserState();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="inline-flex items-center gap-2 text-sm text-subtle">
          <ApertureMark className="size-4" />
          Aperture
        </span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <Link to="/" className="hover:text-fg">
            Product
          </Link>
          {showPricing && (
            <Link to="/pricing" className="hover:text-fg">
              Pricing
            </Link>
          )}
          <Link to="/settings" search={{ tab: "models" }} className="hover:text-fg">
            Models
          </Link>
          <Link to="/app" className="hover:text-fg">
            Editor
          </Link>
          {!isPending && !user && (
            <Link to="/login" search={{ next: "/app" }} className="hover:text-fg">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
