import { Link } from "@tanstack/react-router";
import { ApertureMark } from "@/components/ide/logo";
import { showPricing } from "@/lib/billing/pricing-visible";
import { AuthSlot } from "./auth-slot";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
        <Link to="/" className="tap flex items-center gap-2 text-fg">
          <ApertureMark className="size-5" />
          <span className="text-sm font-medium tracking-tight">Aperture</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <a href="/#how" className="hidden hover:text-fg sm:inline">
            How
          </a>
          <a href="/#code" className="hidden hover:text-fg sm:inline">
            Code
          </a>
          <a href="/#why" className="hidden hover:text-fg sm:inline">
            Why
          </a>
          <Link to="/agents" className="hidden hover:text-fg sm:inline">
            Agents
          </Link>
          <Link to="/privacy" className="tap hover:text-fg">
            Privacy
          </Link>
          <Link to="/security" className="tap hidden hover:text-fg sm:inline">
            Security
          </Link>
          {showPricing && (
            <Link to="/pricing" className="hidden hover:text-fg sm:inline">
              Pricing
            </Link>
          )}
          <Link to="/app" className="hidden hover:text-fg sm:inline">
            Editor
          </Link>
        </nav>
        <div className="ml-auto min-w-0">
          <AuthSlot />
        </div>
      </div>
    </header>
  );
}
