#!/usr/bin/env node
/**
 * The /editor tour's screenshots, taken from the demo project:
 *
 *   npm run build && APERTURE_MODEL=replay VITE_AUTH_ENABLED=false npm run preview -- --port 8095
 *   node scripts/editor-shots.mjs http://127.0.0.1:8095
 *
 * Writes public/editor/hints.jpg, references.jpg and problems.jpg. Run it again
 * when the editor's look changes; the tour reads them by name.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://127.0.0.1:8095").replace(/\/$/, "");
const out = "public/editor";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.PW_CHROMIUM ??
    "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 760 },
  deviceScaleFactor: 2,
});
const shot = (name, clip) =>
  page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 72, clip });
const box = async (locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

try {
  await page.goto(`${base}/app`, { waitUntil: "networkidle" });
  await page.getByText("store.ts", { exact: true }).first().click();
  const tail = page.locator(".cm-line", { hasText: "return tasks.length;" }).first();
  await tail.waitFor({ timeout: 30_000 });

  // Typing loads the compiler; the status bar's count says it is ready.
  await tail.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  await page.keyboard.press("Backspace");
  await page.locator("text=/type errors?|No type errors/").first().waitFor({ timeout: 60_000 });

  // 1. Parameter hints, on a call being typed.
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("export const firstPage = listTasks(0, ", { delay: 30 });
  const hint = page.locator('[aria-label="Parameter hints"]');
  await hint.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
  const editor = await box(page.locator(".cm-editor").first());
  const tip = await box(hint);
  const top = Math.max(editor.y, tip.y - 150);
  // The tip can hang past the editor's edge: keep all of it.
  const right = Math.min(1280, Math.max(editor.x + 600, tip.x + tip.width + 24));
  await shot("hints", { x: editor.x, y: top, width: right - editor.x, height: tip.y + 110 - top });
  await page.keyboard.press("Escape");
  for (let i = 0; i < "export const firstPage = listTasks(0, ".length + 2; i++)
    await page.keyboard.press("Backspace");

  // 2. Every reference to listTasks.
  await page.locator(".cm-line", { hasText: "export function listTasks" }).first().click();
  await page.keyboard.press("Home");
  for (let i = 0; i < "export function list".length; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+F12");
  const refs = page.getByRole("region", { name: "References" });
  await refs.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await shot("references", { x: 0, y: 36, width: 900, height: 520 });

  // 3. A type error, in the editor and in Problems.
  await tail.click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(' + "x"', { delay: 30 });
  await page.keyboard.press("Control+Shift+M");
  const problems = page.getByRole("region", { name: "Problems" });
  await problems
    .getByRole("button", { name: /not assignable to type 'number'/ })
    .waitFor({ timeout: 30_000 });
  await page.locator(".cm-lintRange-error").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  // The list at the top of the sidebar and the underlined line beside it, in one picture.
  const line = await box(
    page.locator(".cm-line", { hasText: 'return tasks.length + "x";' }).first(),
  );
  await shot("problems", { x: 0, y: 36, width: 900, height: Math.min(720, line.y + 70 - 36) });
  console.log("Wrote public/editor/hints.jpg, references.jpg and problems.jpg");
} finally {
  await browser.close();
}
