import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { showPricing } from "@/lib/billing/pricing-visible";

/** `wide`: in the bar only on wide screens; always in the menu. */
type Item = { label: string; href?: string; to?: string; wide?: boolean };

const ITEMS: Item[] = [
  { label: "How", href: "/#how" },
  { label: "Checks", href: "/#checks" },
  { label: "Benchmark", to: "/benchmark" },
  { label: "Agents", to: "/agents", wide: true },
  { label: "Agent Check", to: "/agent-check", wide: true },
  { label: "Privacy", to: "/privacy" },
  { label: "Changelog", to: "/changelog" },
  ...(showPricing ? [{ label: "Pricing", to: "/pricing" } satisfies Item] : []),
];

export function SiteLinks() {
  const base = "shrink-0 text-sm text-muted hover:text-fg";
  return (
    <nav className="hidden items-center gap-5 lg:flex" aria-label="Sections">
      {ITEMS.map((item) => {
        const className = item.wide ? `${base} hidden xl:inline` : base;
        return item.to ? (
          <Link key={item.label} to={item.to} className={className}>
            {item.label}
          </Link>
        ) : (
          <a key={item.label} href={item.href} className={className}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export function SiteTabs() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = ITEMS.filter((item) => item.label.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQ("");
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQ("");
  };
  const row = "block px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg";

  return (
    <div ref={root} className="relative lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 text-sm text-muted hover:text-fg"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
      >
        Menu
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-bg py-1 shadow-[var(--shadow-float)]">
          <label className="mx-2 mt-1 mb-1 flex items-center gap-2 rounded-lg border border-border px-2">
            <Search className="size-3.5 shrink-0 text-subtle" strokeWidth={1.75} />
            <input
              ref={input}
              value={q}
              aria-label="Search"
              placeholder="Search"
              className="w-full bg-transparent py-2 text-sm text-fg outline-none placeholder:text-subtle"
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-subtle">Nothing matches.</p>
          ) : (
            items.map((item) =>
              item.to ? (
                <Link key={item.label} to={item.to} role="menuitem" className={row} onClick={close}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.label} href={item.href} role="menuitem" className={row} onClick={close}>
                  {item.label}
                </a>
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
