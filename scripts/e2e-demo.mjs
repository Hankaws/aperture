#!/usr/bin/env node
/**
 * End to end: the replay demo as a new visitor runs it, against a running
 * build (`APERTURE_MODEL=replay VITE_AUTH_ENABLED=false`).
 *
 *   node scripts/e2e-demo.mjs http://127.0.0.1:8095
 *
 * Unit tests have passed over bugs only a real browser shows (a recap that
 * named finished steps as left, a landing page that downloaded the whole
 * editor), so CI runs this too. Set PW_CHROMIUM to use a browser binary that
 * is already installed.
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://127.0.0.1:8080").replace(/\/$/, "");
/** The landing page must not download the editor: about 540 KB today, the editor alone is over 800. */
const LANDING_JS_BUDGET_KB = 800;
const failures = [];

function check(ok, what) {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
}

/** Uncaught errors and console errors, minus resources a sandboxed preview cannot load. */
function watch(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|ERR_(CERT|TUNNEL|NAME)/.test(m.text())) {
      errors.push(m.text().slice(0, 200));
    }
  });
  return errors;
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

async function waitForText(page, pattern, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pattern.test(await bodyText(page))) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  // 1. The landing page: renders, stays small, and is clean.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watch(page);
    let jsBytes = 0;
    page.on("response", async (res) => {
      if (res.url().endsWith(".js")) jsBytes += (await res.body().catch(() => Buffer.alloc(0))).length;
    });
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    check(/checks its own work/i.test(await bodyText(page)), "landing page renders");
    const kb = Math.round(jsBytes / 1024);
    check(kb < LANDING_JS_BUDGET_KB, `landing page JavaScript is ${kb} KB (budget ${LANDING_JS_BUDGET_KB} KB)`);
    check(errors.length === 0, `landing page console is clean${errors.length ? `: ${errors[0]}` : ""}`);
    await page.close();
  }

  // 2. The editor: plan, build, an honest recap, checks, Apply and Revert.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watch(page);
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Fix the off-by-one in listTasks" }).click();
    const build = page.getByRole("button", { name: /Build it/ }).first();
    await build.waitFor({ timeout: 60_000 });
    check(true, "Composer posts a plan and offers Build it");
    await build.click();
    check(await waitForText(page, /\nChanged: src\/store\.ts/, 60_000), "Build it stages the fix and recaps it");
    const recap = await bodyText(page);
    check(/Left: nothing on the plan\./.test(recap), "the recap does not list finished steps as left");
    check(!/Didn't: [^\n]*\.md/.test(recap), "the recap does not count docs as code that still references the change");
    check(
      await waitForText(page, /Already failing before this change/, 30_000),
      "Tests runs in the browser and marks the other known bugs as already failing",
    );
    await page.getByRole("button", { name: /^(Apply all|Apply anyway)$/ }).first().click();
    const revert = page.getByRole("button", { name: "Revert" }).first();
    await revert.waitFor({ timeout: 15_000 });
    await revert.click();
    check(await waitForText(page, /Reverted “/, 10_000), "Apply, then Revert, puts the change back");
    check(errors.length === 0, `editor console is clean${errors.length ? `: ${errors[0]}` : ""}`);
    await page.close();
  }

  // 3. A phone: the editor fits the screen.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = watch(page);
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `phone layout has no sideways scroll (${overflow}px)`);
    check(errors.length === 0, `phone console is clean${errors.length ? `: ${errors[0]}` : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check${failures.length === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll end-to-end checks passed.");
