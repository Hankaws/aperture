/**
 * Where search engines should find Aperture: the one public origin, and the
 * pages worth listing. `public/sitemap.xml` lists `SITEMAP_PATHS`; a test keeps
 * the two in step.
 */
export const SITE_ORIGIN = "https://aperturesais.grok.me";

/** Public pages, in the order the sitemap lists them. Sign-in pages and `/api` are left out on purpose. */
export const SITEMAP_PATHS = [
  "/",
  "/check",
  "/scoreboard",
  "/bot",
  "/bot?tab=check",
  "/bot?tab=agents",
  "/app",
  "/editor",
  "/benchmark",
  "/pricing",
  "/changelog",
  "/security",
  "/privacy",
  "/terms",
] as const;

export function canonicalUrl(path: string): string {
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

/** The `links` entry that names a page's one address. */
export function canonicalLink(path: string) {
  return { rel: "canonical", href: canonicalUrl(path) };
}
