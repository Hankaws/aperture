import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { applyAppearance, readDensity, readTheme } from "@/lib/appearance";
import { AuthSlot } from "./auth-slot";
import { SiteSearch } from "./site-search";
import { SiteLinks, SiteTabs } from "./site-tabs";

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(readTheme() === "light" || document.documentElement.dataset.theme === "light");
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
        const next = light ? "cursor" : "light";
        applyAppearance(next, readDensity());
        setLight(next === "light");
      }}
    >
      Dark
      <span className="relative h-5 w-9 overflow-hidden rounded-full border border-border bg-surface">
        <span
          className={`absolute top-0.5 left-0.5 size-3.5 rounded-full bg-fg transition-transform duration-200 ${light ? "translate-x-0" : "translate-x-3.5"}`}
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
        <div className="ml-auto hidden md:block">
          <SiteSearch />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-4 lg:ml-5">
          <ThemeToggle />
          <AuthSlot plain />
        </div>
      </div>
    </header>
  );
}