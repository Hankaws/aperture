#!/usr/bin/env node
/**
 * A short clip of the editor catching a bad change: open the demo, type a
 * line that does not typecheck, and hold on the red mark.
 *
 *   node scripts/demo-clip.mjs http://127.0.0.1:8080
 *
 * Writes a webm next to the script's output directory (artifacts/demo-clip).
 * The second-try comparison (attempt 1 beside a failed fix) needs a model
 * that writes the fix; this recording is the check going red.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const dir = "artifacts/demo-clip";
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
try {
  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  console.log("url", page.url());
  const editor = page.locator(".cm-content").first();
  await editor.waitFor({ timeout: 30_000 });
  await editor.scrollIntoViewIfNeeded();
  await page.waitForTimeout(8000);
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nconst broken: string = 1;\n", { delay: 50 });
  const dot = page.locator(".cm-aperture-check-dot").first();
  await dot.waitFor({ timeout: 20_000 });
  await dot.scrollIntoViewIfNeeded();
  console.log("url after catch", page.url());
  await page.waitForTimeout(18_000);
  console.log("caught the type error");
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) console.log(await video.path());
}
