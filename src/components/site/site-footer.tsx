import { Link } from "@tanstack/react-router";
import { showPricing } from "@/lib/billing/pricing-visible";
import { version } from "../../../package.json";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2">
          Aperture · MIT
          <Link to="/changelog" className="font-mono text-xs hover:text-fg" aria-label={`Version ${version}, changelog`}>
            v{version}
          </Link>
        </span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/benchmark" className="hover:text-fg">
            Benchmark
          </Link>
          <Link to="/bot" className="hover:text-fg">
            Bot
          </Link>
          <Link to="/bot" search={{ tab: "check" }} className="hover:text-fg">
            Agent Check
          </Link>
          <Link to="/bot" search={{ tab: "agents" }} className="hover:text-fg">
            Agents
          </Link>
          <Link to="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link to="/security" className="hover:text-fg">
            Security
          </Link>
          <Link to="/changelog" className="hover:text-fg">
            Changelog
          </Link>
          <Link to="/terms" className="hover:text-fg">
            Terms
          </Link>
          {showPricing && (
            <Link to="/pricing" className="hover:text-fg">
              Pricing
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}