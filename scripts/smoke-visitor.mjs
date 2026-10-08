#!/usr/bin/env node
/**
 * Launch smoke test: the path a new visitor takes on the live site, with
 * sign-in on, against a production build.
 *
 *   npm run build && npm run smoke            # serves the build itself
 *   node scripts/smoke-visitor.mjs http://127.0.0.1:8096   # a server you started
 *
 * scripts/e2e-demo.mjs covers the editor with sign-in off. This covers what
 * only the signed-in site does: every public page on a laptop and a phone,
 * sign-up, Composer on the public demo host playing recordings, the server
 * refusing a paid plan, the project saved to the account and opened on a
 * second device, an agent token checking a change through the MCP server, and
 * Composer on any other host refusing to run without the visitor's own key.
 *
 * When it serves the build itself it sets BETTER_AUTH_URL to the URL it serves
 * (Better Auth only trusts origins it knows) and a decoy XAI_API_KEY, so the
 * last check proves a key in the server's environment is never spent on a
 * visitor. A server you start yourself needs the same, and no APERTURE_MODEL.
 * Set PW_CHROMIUM to use a browser binary that is already installed.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const PUBLIC_DEMO_HOST = "aperturesais.grok.me";
const OWN_PORT = 8096;
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const benchCases = JSON.parse(
  readFileSync(new URL("../src/lib/bench/results.json", import.meta.url), "utf8"),
).cases.length;

const given = process.argv[2]?.replace(/\/$/, "");
const base = given ?? `http://127.0.0.1:${OWN_PORT}`;
const failures = [];

function check(ok, what) {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
  return ok;
}

/** Uncaught errors and console errors, minus resources a sandboxed runner cannot load. */
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

function clean(errors, where) {
  check(errors.length === 0, `${where}: console is clean${errors.length ? `: ${errors[0]}` : ""}`);
  errors.length = 0;
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

/** A browser profile; on the demo host every request to the app carries the live site's forwarded host. */
async function profile(browser, { demoHost, phone = false }) {
  const context = await browser.newContext(
    phone
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  );
  if (demoHost) {
    await context.route(`${base}/**`, (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-forwarded-host": PUBLIC_DEMO_HOST },
      }),
    );
  }
  return context;
}

async function emailAuth(page, mode, account) {
  await page.goto(`${base}/login?next=%2Fapp`, { waitUntil: "networkidle" });
  if (mode === "up") {
    await page.getByRole("button", { name: "Create account", exact: true }).first().click();
    await page.getByPlaceholder("Name").fill(account.name);
  }
  await page.getByPlaceholder("you@studio.dev").fill(account.email);
  await page.getByPlaceholder("Password").fill(account.password);
  await page
    .locator("form")
    .getByRole("button", { name: mode === "up" ? "Create account" : "Sign in with email" })
    .click();
  return page.waitForURL(/\/app$/, { timeout: 30_000 }).then(
    () => true,
    () => false,
  );
}

async function startOwnServer() {
  const env = { ...process.env, BETTER_AUTH_URL: base, XAI_API_KEY: "smoke-decoy-key-never-used" };
  for (const name of [
    "APERTURE_MODEL",
    "APERTURE_PUBLIC_DEMO",
    "VITE_PUBLIC_HOSTNAME",
    "DATABASE_URL",
  ])
    delete env[name];
  const server = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(OWN_PORT), "--strictPort"],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) break;
    const up = await fetch(`${base}/`).then(
      (r) => r.ok,
      () => false,
    );
    if (up) return server;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(log);
  stopOwnServer(server);
  throw new Error(`The build did not come up on ${base}. Run npm run build first.`);
}

function stopOwnServer(server) {
  if (!server || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

const server = given ? null : await startOwnServer();
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const stamp = Date.now();
const visitor = {
  name: "Smoke",
  email: `smoke-${stamp}@example.com`,
  password: `smoke-${stamp}-password`,
};
const marker = `// smoke ${stamp}: saved to the account`;

try {
  // 1. Every public page, signed out, on a laptop and a phone.
  const pages = [
    ["/", /Checked before you apply it\./],
    ["/benchmark", new RegExp(`with ${benchCases} edits an agent might stage`)],
    ["/pricing", /Hobby is free today/],
    ["/agents", /Your agent writes the change\. Aperture checks it first\./],
    ["/agent-check", /Catches AI agents.{1,2}mistakes in pull requests, before they merge\./],
    ["/changelog", new RegExp(pkg.version.replace(/\./g, "\\."))],
    ["/security", /security/i],
    ["/privacy", /privacy/i],
    ["/terms", /terms/i],
    ["/login?error=account_not_linked", /Report it privately/],
  ];
  for (const phone of [false, true]) {
    const context = await profile(browser, { demoHost: true, phone });
    const page = await context.newPage();
    const errors = watch(page);
    const device = phone ? "phone" : "laptop";
    for (const [path, expected] of pages) {
      await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      const text = await bodyText(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      check(
        expected.test(text) && overflow <= 0,
        `${device} ${path} renders${overflow > 0 ? `, but scrolls sideways ${overflow}px` : ""}`,
      );
    }
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    check(
      (await page.getByRole("link", { name: `Version ${pkg.version}, changelog` }).count()) > 0,
      `${device} footer shows v${pkg.version}`,
    );
    clean(errors, `${device} public pages`);
    await context.close();
  }

  // The rest needs sign-in, which a build made with VITE_AUTH_ENABLED=false does not have.
  {
    const context = await profile(browser, { demoHost: true });
    const page = await context.newPage();
    await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
    const signInOn = /\/login/.test(page.url());
    await context.close();
    if (!check(signInOn, "signed out, /settings sends you to sign in")) {
      throw new Error(
        "This build has sign-in off. Build without VITE_AUTH_ENABLED=false and run again.",
      );
    }
  }

  // 2. On the live site's host: sign up, Composer plays a recording, a paid plan is refused, the project is saved.
  {
    const context = await profile(browser, { demoHost: true });
    const page = await context.newPage();
    const errors = watch(page);
    check(await emailAuth(page, "up", visitor), "Create account signs you up and opens the editor");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Fix the off-by-one in listTasks" }).click();
    const build = page.getByRole("button", { name: /Build it/ }).first();
    const planned = await build.waitFor({ timeout: 60_000 }).then(
      () => true,
      () => false,
    );
    check(planned, "Composer posts a plan without a key");
    if (planned) await build.click();
    check(
      await waitForText(page, /\nChanged: src\/store\.ts/, 60_000),
      "Build it stages the recorded fix",
    );
    check(
      /Replay model · recorded runs · no API call · no cost/.test(await bodyText(page)),
      "Composer says it is the replay model and costs nothing",
    );

    // A hand edit, saved to the account.
    await page.locator(".cm-content").first().click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type(`${marker}\n`);
    const saved = await page
      .locator('[title="This project is saved to your account."]', { hasText: /^Saved$/ })
      .waitFor({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      );
    check(saved, "an edit is saved to the account");
    clean(errors, "signed-in editor");

    // The paid plan button is disabled; the server must refuse it even when the button is forced.
    await page.goto(`${base}/pricing`, { waitUntil: "networkidle" });
    const pro = page.getByRole("button", { name: "Coming soon" }).first();
    check(await pro.isDisabled(), "Pro cannot be picked on the pricing page");
    await pro.evaluate((el) => el.removeAttribute("disabled"));
    await pro.click();
    check(
      await waitForText(page, /not available yet: there is no checkout/, 10_000),
      "the server refuses Pro when the button is forced",
    );
    await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
    check(/Current plan\s+Hobby/.test(await bodyText(page)), "Settings still shows Hobby");
    clean(errors, "plans");

    // Connect an agent: a token made in Settings lets an MCP client check a change.
    await page.goto(`${base}/settings?tab=agents`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Token name, e.g. Grok Bot").fill("Smoke agent");
    await page.getByRole("button", { name: "Make a token" }).click();
    const token = await page
      .locator("[data-agent-token]")
      .innerText({ timeout: 15_000 })
      .catch(() => "");
    check(/^apt_[A-Za-z0-9_-]{43}$/.test(token), "Settings makes an agent token and shows it once");
    const mcp = (body, headers = { authorization: `Bearer ${token}` }) =>
      fetch(`${base}/api/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...headers,
        },
        body: JSON.stringify(body),
      });
    const listed = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }).then((r) => r.json());
    check(
      listed.result?.tools?.[0]?.name === "check_change",
      "the MCP server lists check_change for that token",
    );
    const checked = await mcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "check_change",
        arguments: {
          files: {
            "src/math.ts":
              "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
            "src/index.ts":
              'import { add } from "./math";\nexport const total: number = add(1, 2);\n',
          },
          changes: {
            "src/math.ts":
              "export function add(a: number, b: number): string {\n  return String(a + b);\n}\n",
          },
        },
      },
    }).then((r) => r.json());
    check(
      checked.result?.structuredContent?.verdict === "red" &&
        /src\/index\.ts: TS2322/.test(checked.result?.content?.[0]?.text ?? ""),
      "check_change flags the caller a change breaks",
    );
    const cookieOnly = await page.request.post(`${base}/api/mcp`, {
      data: { jsonrpc: "2.0", id: 3, method: "ping" },
    });
    check(
      cookieOnly.status() === 401,
      `the MCP server ignores a signed-in browser's cookie (${cookieOnly.status()})`,
    );
    await page.getByRole("button", { name: "Revoke Smoke agent" }).click();
    await page
      .getByText("No tokens yet.")
      .waitFor({ timeout: 10_000 })
      .catch(() => {});
    const revoked = await mcp({ jsonrpc: "2.0", id: 4, method: "ping" });
    check(revoked.status === 401, `a revoked token is refused (${revoked.status})`);
    clean(errors, "agent tokens");
    await context.close();
  }

  // 3. A second device: sign in and the saved project is there.
  {
    const context = await profile(browser, { demoHost: true });
    const page = await context.newPage();
    const errors = watch(page);
    check(await emailAuth(page, "in", visitor), "Sign in on a second device opens the editor");
    await page.waitForLoadState("networkidle");
    // Which file is open is not saved with the project, so open the edited one.
    await page.getByRole("button", { name: "store.ts", exact: true }).first().click();
    const opened = await page
      .waitForFunction(
        (m) => document.querySelector(".cm-content")?.textContent?.includes(m),
        marker,
        { timeout: 30_000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(opened, "the second device opens the saved edit");
    clean(errors, "second device");
    await context.close();
  }

  // 4. Any other host: Composer needs the visitor's own key, and never spends the server's.
  {
    const context = await profile(browser, { demoHost: false });
    const page = await context.newPage();
    const errors = watch(page);
    const other = {
      name: "Smoke two",
      email: `smoke-${stamp}-2@example.com`,
      password: visitor.password,
    };
    check(await emailAuth(page, "up", other), "a second visitor signs up off the demo host");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Fix the off-by-one in listTasks" }).click();
    check(
      await waitForText(
        page,
        /Add your Grok key in Settings\. This app does not use a shared key\./,
        30_000,
      ),
      "off the demo host, Composer asks for the visitor's own key instead of using the server's",
    );
    check(
      !/Replay model/.test(await bodyText(page)),
      "off the demo host, Composer does not claim to be the replay model",
    );
    clean(errors, "other host");
    await context.close();
  }
} catch (error) {
  check(false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
  stopOwnServer(server);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check${failures.length === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
