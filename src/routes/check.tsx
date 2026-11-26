import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PullCheck } from "@/components/site/pull-check";

/** Check anyone's public pull request from its link; the address (`?pr=owner/repo/12`) is the result's link to share. */
export const Route = createFileRoute("/check")({
  validateSearch: (search: Record<string, unknown>): { pr?: string } =>
    typeof search.pr === "string" && search.pr.trim() ? { pr: search.pr.trim().slice(0, 300) } : {},
  head: () => pageHead("check"),
  component: CheckPage,
});

function CheckPage() {
  const { pr } = Route.useSearch();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">
            Check a pull request
          </p>
          <h1 className="mt-4 text-3xl font-medium tracking-tight text-balance sm:text-5xl">
            What did the agent get wrong?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">
            Paste any public GitHub pull request. Aperture reads it and checks its imports, keys,
            switched-off tests and the project&apos;s own rules. No sign-in, nothing to install.
          </p>
        </div>
        <div className="mt-8">
          <PullCheck pr={pr} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
