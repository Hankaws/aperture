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
    // The plan can be edited before Build it.
    const steps = page.locator('ol[aria-label="Plan steps"] li');
    const before = await steps.count();
    await page.getByRole("button", { name: /^Edit step 1:/ }).click();
    await page.getByRole("textbox", { name: "Step 1" }).fill("Read src/store.ts first");
    await page.getByRole("textbox", { name: "Step 1" }).press("Enter");
    await page.getByRole("button", { name: "Add a step" }).click();
    await page.getByRole("textbox", { name: "New step" }).fill("Say what changed");
    await page.getByRole("textbox", { name: "New step" }).press("Enter");
    const edited = await steps.allInnerTexts();
    check(
      edited.length === before + 1 && /Read src\/store\.ts first/.test(edited[0] ?? "") && /Say what changed/.test(edited.at(-1) ?? ""),
      "the plan can be reworded and added to before Build it",
    );
    await build.click();
    check(await waitForText(page, /\nChanged: src\/store\.ts/, 60_000), "Build it stages the fix and recaps it");
    const recap = await bodyText(page);
    check(/Left: nothing on the plan\./.test(recap), "the recap does not list finished steps as left");
    check(!/Didn't: [^\n]*\.md/.test(recap), "the recap does not count docs as code that still references the change");
    // The agent board shows the run, staged for review.
    await page.keyboard.press("Control+j");
    const review = await page.locator('[role="dialog"] section[aria-label="Review"] li').allInnerTexts();
    check(review.length === 1 && /Fix the off-by-one in listTasks/.test(review[0] ?? ""), "the agent board shows the run in Review");
    await page.keyboard.press("Escape");
    check(
      await waitForText(page, /Already failing before this change/, 30_000),
      "Tests runs in the browser and marks the other known bugs as already failing",
    );
    // Types is real tsc, run in a worker on the staged change.
    const types = page.locator('[data-check="types"]');
    await page
      .waitForFunction(() => document.querySelector('[data-check="types"]')?.getAttribute("data-status") !== "running", null, {
        timeout: 90_000,
      })
      .catch(() => {});
    const typesLabel = (await types.getAttribute("aria-label")) ?? "";
    check(/Types: passed\. tsc found no errors in \d+ files? this change touches/.test(typesLabel), `Types runs real tsc on the change (${typesLabel.slice(0, 90)})`);
    // The demo's stage hook (.aperture/hooks.json) is one more check, and its rule for src/store.ts was followed.
    await page
      .waitForFunction(() => document.querySelector('[data-check="hook:0:check:store"]')?.getAttribute("data-status") !== "running", null, {
        timeout: 30_000,
      })
      .catch(() => {});
    const hookStatus = await page.locator('[data-check="hook:0:check:store"]').getAttribute("data-status").catch(() => null);
    check(hookStatus === "pass", `the stage hook runs as a check on the change (${hookStatus})`);
    check(
      (await page.getByRole("button", { name: "store.md" }).count()) > 0 && /Followed rule/.test(await bodyText(page)),
      "the rule for src/store.ts is given to the agent and listed on the message",
    );
    await page.getByRole("button", { name: /^(Apply all|Apply anyway)$/ }).first().click();
    const revert = page.getByRole("button", { name: "Revert" }).first();
    await revert.waitFor({ timeout: 15_000 });
    await revert.click();
    check(await waitForText(page, /Reverted “/, 10_000), "Apply, then Revert, puts the change back");
    // Save hooks: Ctrl+S on src/store.ts runs the demo's hook, and the status bar says how it went.
    await page.keyboard.press("Control+s");
    check(await waitForText(page, /hooks passed/, 20_000), "Ctrl+S runs the save hook and the status bar shows it passed");
    check(errors.length === 0, `editor console is clean${errors.length ? `: ${errors[0]}` : ""}`);
    await page.close();
  }

  // 3. A check failure gets a dot in the margin, and F7 goes to it.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watch(page);
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    await page.locator(".cm-content").first().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\nconst broken: string = 1;\n");
    await page.locator(".cm-aperture-check-dot").first().waitFor({ timeout: 10_000 }).catch(() => {});
    const title = await page.locator(".cm-aperture-check-dot").first().getAttribute("title").catch(() => null);
    check(/not assignable to string/.test(title ?? ""), "a type error gets a dot in the margin that names it");
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("F7");
    const active = await page.locator(".cm-activeLine").first().innerText().catch(() => "");
    check(/const broken/.test(active), "F7 jumps to the marked line");
    check(errors.length === 0, `margin check console is clean${errors.length ? `: ${errors[0]}` : ""}`);
    await page.close();
  }

  // 4. A background run: it works on its own copy while you edit, is checked, waits on the board, and opens onto your newer file.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watch(page);
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    await page.locator("textarea").last().fill("Fix the off-by-one in listTasks");
    await page.locator("textarea").last().press("Control+Shift+Enter");
    const tray = page.locator('[aria-label="Background runs"]');
    check(await tray.getByText(/working in the background/).isVisible().catch(() => false), "a background run starts without taking over Composer");
    await page.locator(".cm-content").first().click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type("// a hand edit while the run works\n");
    const ready = await page
      .waitForFunction(() => /ready to review/.test(document.querySelector('[aria-label="Background runs"]')?.textContent ?? ""), null, {
        timeout: 90_000,
      })
      .then(
        () => true,
        () => false,
      );
    check(ready && /Checks clear/.test(await tray.innerText()), "the run is checked in the background and waits for review");
    await page.keyboard.press("Control+j");
    check(
      (await page.locator('section[aria-label="Review"] [data-background-run]').count()) === 1,
      "the agent board shows the background run in Review",
    );
    await page.locator('section[aria-label="Review"] [data-background-run]').getByRole("button", { name: "Open" }).click();
    check(
      await waitForText(page, /Carried onto your newer src\/store\.ts/, 10_000),
      "opening carries the change onto the file you edited meanwhile",
    );
    const staged = await page.locator(".cm-content").first().innerText();
    check(
      /a hand edit while the run works/.test(staged) && /tasks\.slice\(start, start \+ pageSize\)/.test(staged),
      "the staged file keeps both your edit and the run's fix",
    );
    check(errors.length === 0, `background run console is clean${errors.length ? `: ${errors[0]}` : ""}`);
    await page.close();
  }

  // 5. A phone: the editor fits the screen.
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
