#!/usr/bin/env node
/**
 * A 30–45s clip of a caught failed fix: a red check, Send back, then the stop.
 *
 *   APERTURE_MODEL=replay VITE_AUTH_ENABLED=false npm run dev -- --port 8095
 *   node scripts/demo-clip.mjs http://127.0.0.1:8095
 *
 * Writes public/caught-a-bad-change.webm. The replay plays the bad return
 * from listTasks, then one worse try, and does not apply it.
 */
import { mkdirSync, renameSync } from "node:fs";
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://127.0.0.1:8095").replace(/\/$/, "");
const dir = "artifacts/demo-clip";
const out = "public/caught-a-bad-change.webm";
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.PW_CHROMIUM ??
    "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const started = Date.now();
try {
  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Fix the off-by-one in listTasks" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const box = page.locator("textarea").last();
  await box.click();
  await box.fill("Make listTasks return a number");
  await page.waitForTimeout(700);
  await box.press("Enter");
  const build = page.getByRole("button", { name: /^Build it$/ }).first();
  await build.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await build.click();
  const sendBack = page.getByRole("button", { name: "Send back" });
  await sendBack.waitFor({ timeout: 60_000 });
  await page
    .locator('[data-check="types"][data-status="fail"]')
    .waitFor({ timeout: 45_000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  await sendBack.click();
  await page.getByLabel("Attempt 1 and this fix").waitFor({ timeout: 30_000 });
  const elapsed = Date.now() - started;
  const hold = Math.max(2500, 38_000 - elapsed);
  console.log("story visible at", elapsed, "ms; holding", hold);
  await page.waitForTimeout(hold);
  console.log("clip length about", Date.now() - started, "ms");
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const path = await video.path();
    renameSync(path, out);
    console.log(out);
  }
}
