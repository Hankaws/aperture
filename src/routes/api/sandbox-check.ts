import { createFileRoute } from "@tanstack/react-router";

/**
 * One real run through the agent's sandbox path, for checking a deployment's
 * wiring: sign-in, file upload, the package-registry allowlist and the
 * command runner. Hidden (404) unless the deployment sets
 * `APERTURE_SANDBOX_CHECK=1`; each call starts a real, billed sandbox.
 *
 * The project installs one small package (the registry must be reachable) and
 * then tries a host outside the allowlist (which must be blocked), so a pass
 * means both halves of the network policy hold.
 */
const CHECK_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "aperture-sandbox-check",
      private: true,
      type: "module",
      scripts: { test: "node check.js" },
      dependencies: { "is-number": "7.0.0" },
    },
    null,
    2,
  ),
  "check.js": [
    'import isNumber from "is-number";',
    'console.log("node", process.version);',
    'console.log("package from the registry:", isNumber(5) ? "ok" : "broken");',
    "try {",
    '  await fetch("https://example.com", { signal: AbortSignal.timeout(5000) });',
    '  console.log("host outside the allowlist: REACHABLE");',
    "  process.exit(1);",
    "} catch {",
    '  console.log("host outside the allowlist: blocked");',
    "}",
    'console.log("sandbox ok");',
    "",
  ].join("\n"),
};

export const Route = createFileRoute("/api/sandbox-check")({
  server: {
    handlers: {
      GET: async () => {
        const { env } = await import("@/lib/env.server");
        if (env("APERTURE_SANDBOX_CHECK") !== "1") return new Response("Not found", { status: 404 });

        const { sandboxMode, VercelSandboxRunner } = await import("@/lib/sandbox/vercel.server");
        const mode = sandboxMode();
        const headers = { "cache-control": "no-store" };
        if (!mode) {
          return Response.json({ ok: false, mode: null, error: "No sandbox is configured." }, { status: 503, headers });
        }

        const { planRun, sandboxEnv, clampTimeout } = await import("@/lib/sandbox/policy");
        const plan = planRun(CHECK_FILES, "test");
        if (!plan.ok) return Response.json({ ok: false, mode: mode.kind, error: plan.error }, { status: 500, headers });

        const outcome = await new VercelSandboxRunner().run({
          files: CHECK_FILES,
          steps: plan.steps,
          env: sandboxEnv(),
          timeoutMs: clampTimeout(120_000),
        });
        const passed = outcome.ok && outcome.passed;
        return Response.json({ ok: passed, mode: mode.kind, outcome }, { status: passed ? 200 : 502, headers });
      },
    },
  },
});
