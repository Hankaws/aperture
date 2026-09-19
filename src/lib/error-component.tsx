import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
const RELOAD_KEY = "aperture-chunk-reload";

function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : FALLBACK_MESSAGE;
  const minified = /Minified React error #(\d+)/i.exec(raw);
  if (minified?.[1] === "185") {
    return "The editor hit an update loop and stopped. Reload to continue.";
  }
  return raw;
}

function isStaleChunk(message: string): boolean {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    message,
  );
}

function hardReload() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = errorMessage(error);
  const stale = isStaleChunk(message);

  useEffect(() => {
    if (!stale || typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
      sessionStorage.setItem(RELOAD_KEY, "1");
    } catch {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.pathname + url.search + url.hash);
  }, [stale]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {stale
          ? "The editor failed to load a cached file. Reload to pick up the latest version."
          : message}
      </p>
      <button
        type="button"
        className="mt-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90"
        onClick={hardReload}
      >
        Reload
      </button>
    </main>
  );
}
