import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** Any address with no page: the site's own bar and a way back, not a bare "Not Found". */
export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-16 pb-20 sm:px-5 sm:pt-24">
        <p className="font-mono text-sm text-subtle">404</p>
        <h1 className="mt-3 text-[clamp(2.4rem,6vw,4rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
          There is no page here.
        </h1>
        <p className="mt-5 max-w-prose text-lg text-pretty text-muted">
          The address may have a typo, or the page may have moved. These are the places that exist.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/app" className={cn(buttonVariants({ size: "md" }))}>
            Open the editor
          </Link>
          <Link to="/" className={cn(buttonVariants({ variant: "outline", size: "md" }))}>
            Home
          </Link>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-base">
          <li>
            <Link to="/benchmark" className="text-fg underline underline-offset-2">
              Benchmark
            </Link>
          </li>
          <li>
            <Link to="/bot" className="text-fg underline underline-offset-2">
              Bot
            </Link>
          </li>
          <li>
            <Link to="/changelog" className="text-fg underline underline-offset-2">
              Changelog
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="text-fg underline underline-offset-2">
              Privacy
            </Link>
          </li>
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
