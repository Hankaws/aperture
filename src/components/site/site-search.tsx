import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { showPricing } from "@/lib/billing/pricing-visible";
import { useHydratedUserState } from "@/lib/use-hydrated-user";

type Item = { label: string; hint: string; href?: string; to?: string };

const PAGES: Item[] = [
  { label: "How it works", hint: "You ask. It waits.", href: "/#how" },
  { label: "Checks", hint: "Five checks, then Apply.", href: "/#checks" },
  { label: "Benchmark", hint: "What the checks caught, and what they missed.", to: "/benchmark" },
  { label: "Agents", hint: "Give your agent the same checks.", to: "/agents" },
  { label: "Agent Check", hint: "The checks on every pull request.", to: "/agent-check" },
  { label: "Bot", hint: "Ask the coding bot, watch it work.", to: "/bot" },
  { label: "Privacy", hint: "What leaves the browser.", to: "/privacy" },
  { label: "Security", hint: "How the checks and keys are handled.", to: "/security" },
  { label: "Changelog", hint: "What changed.", to: "/changelog" },
  { label: "Terms", hint: "The rules for using Aperture.", to: "/terms" },
];

export function SiteSearch() {
  const { user } = useHydratedUserState();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const all: Item[] = [
      ...PAGES,
      ...(showPricing ? [{ label: "Pricing", hint: "Nothing is charged today.", to: "/pricing" }] : []),
      user
        ? { label: "Open the editor", hint: "Go to your project.", to: "/app" }
        : { label: "Open the editor", hint: "Sign in, then the editor.", to: "/login" },
    ];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(needle));
  }, [q, user]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const go = (item: Item) => {
    setOpen(false);
    setQ("");
    if (item.href) window.location.assign(item.href);
  };

  return (
    <div ref={root} className="relative shrink-0">
      <label className="flex h-8 w-32 items-center gap-2 rounded-full border border-border bg-surface px-3 text-muted lg:w-44">
        <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
        <input
          ref={input}
          value={q}
          placeholder="Search"
          aria-label="Search"
          aria-expanded={open}
          role="combobox"
          className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((n) => Math.min(n + 1, Math.max(items.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((n) => Math.max(n - 1, 0));
            } else if (event.key === "Enter" && items[active]) {
              event.preventDefault();
              const item = items[active];
              if (item.href) go(item);
              else document.getElementById(`site-search-${active}`)?.click();
            }
          }}
        />
      </label>
      {open && (
        <ul className="absolute top-10 right-0 z-40 w-72 overflow-hidden rounded-xl border border-border bg-bg py-1 shadow-[var(--shadow-float)]" role="listbox">
          {items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-subtle">Nothing matches.</li>
          ) : (
            items.map((item, i) => {
              const row = `block px-3 py-2 text-left hover:bg-surface ${i === active ? "bg-surface" : ""}`;
              const body = (
                <>
                  <span className="block text-sm text-fg">{item.label}</span>
                  <span className="block text-xs text-subtle">{item.hint}</span>
                </>
              );
              return (
                <li key={item.label} role="option" aria-selected={i === active}>
                  {item.to ? (
                    <Link
                      id={`site-search-${i}`}
                      to={item.to}
                      search={item.to === "/login" ? { next: "/app" } : undefined}
                      className={row}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                      }}
                    >
                      {body}
                    </Link>
                  ) : (
                    <a href={item.href} className={row} onClick={() => go(item)}>
                      {body}
                    </a>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
