import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CANONICAL_PATH } from "./page-head.ts";
import { SITE_ORIGIN, SITEMAP_PATHS, canonicalUrl } from "./seo.ts";

const publicFile = (name: string) => readFileSync(new URL(`../../public/${name}`, import.meta.url), "utf8");

test("sitemap.xml lists exactly the public pages, once each", () => {
  const locs = [...publicFile("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, SITEMAP_PATHS.map(canonicalUrl));
  assert.equal(new Set(locs).size, locs.length);
});

test("every canonical page is in the sitemap, and every sitemap page but the home page has a canonical", () => {
  const listed = new Set<string>(SITEMAP_PATHS);
  for (const path of Object.values(CANONICAL_PATH)) assert.ok(listed.has(path!), `${path} missing from sitemap`);
  for (const path of SITEMAP_PATHS) {
    if (path !== "/") assert.ok(Object.values(CANONICAL_PATH).includes(path), `${path} has no canonical`);
  }
});

test("robots.txt allows crawling and points at the sitemap", () => {
  const robots = publicFile("robots.txt");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${SITE_ORIGIN}/sitemap\\.xml$`, "m"));
});
