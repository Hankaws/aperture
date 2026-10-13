import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { applyAppearance, readDensity } from "@/lib/appearance";
import { AuthSlot } from "./auth-slot";
import { SiteSearch } from "./site-search";
import { SiteLinks, SiteTabs } from "./site-tabs";

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const sync = () => setLight(document.documentElement.dataset.theme === "light");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!light}
      aria-label="Dark mode"
      title="Dark mode"
      className="flex shrink-0 items-center gap-2 text-sm text-muted hover:text-fg"
      onClick={() => {
        const next = document.documentElement.dataset.theme === "light" ? "cursor" : "light";
        applyAppearance(next, readDensity());
        setLight(next === "light");
      }}
    >
      Dark
      <span className={`relative h-5 w-9 rounded-full border border-border ${light ? "bg-elevated" : "bg-fg"}`}>
        <span
          className={`absolute top-0.5 left-0.5 size-3.5 rounded-full transition-transform duration-200 ${light ? "translate-x-0 bg-fg" : "translate-x-3.5 bg-bg"}`}
        />
      </span>
    </button>
  );
}

export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  return (
    <header className={`${overlay ? "absolute inset-x-0 top-0" : "sticky top-0"} z-30 bg-bg`}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-5">
        <Link to="/" className="shrink-0 text-sm font-medium tracking-tight text-fg">
          Aperture
        </Link>
        <SiteTabs />
        <SiteLinks />
        <div className="hidden shrink-0 md:block">
          <SiteSearch />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-4 lg:ml-0">
          <ThemeToggle />
          <AuthSlot plain />
        </div>
      </div>
    </header>
  );
}