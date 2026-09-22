/**
 * Vercel Sandbox adapter.
 *
 * NOT EXERCISED. Every other layer here is covered by tests against a fake
 * runner; this file talks to a live service and has never been run against
 * one, because provisioning a token is not something the build can do. Treat
 * the request shapes as read from the API docs rather than confirmed, and
 * expect the first real call to need corrections.
 *
 * It is dark until `VERCEL_SANDBOX_TOKEN` and `VERCEL_TEAM_ID` are set: with no
 * token `isConfigured()` is false and the agent is simply told that running is
 * unavailable, so a missing credential degrades rather than breaks.
 */
import { env } from "@/lib/env.server";
import { clipOutput, type RunOutcome, type RunRequest, type SandboxRunner, type StepResult } from "./runner";

const API = "https://api.vercel.com";

export function isConfigured(): boolean {
  return Boolean(env("VERCEL_SANDBOX_TOKEN") && env("VERCEL_TEAM_ID"));
}

type Json = Record<string, unknown>;

async function call(path: string, init: RequestInit & { body?: string }): Promise<Json> {
  const token = env("VERCEL_SANDBOX_TOKEN");
  const team = env("VERCEL_TEAM_ID");
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(team ?? "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    // The body can carry a token in an echoed request; never surface it raw.
    throw new Error(`Sandbox API ${res.status}`);
  }
  return text ? (JSON.parse(text) as Json) : {};
}

/** Vercel caps a single write; the workspace caps mean this is one batch in practice. */
function toFilePayload(files: Record<string, string>) {
  return Object.entries(files).map(([path, content]) => ({
    path,
    content: Buffer.from(content, "utf8").toString("base64"),
    encoding: "base64",
  }));
}

export class VercelSandboxRunner implements SandboxRunner {
  readonly name = "vercel";

  async run(request: RunRequest): Promise<RunOutcome> {
    if (!isConfigured()) {
      return { ok: false, error: "No sandbox is configured for this deployment." };
    }
    let sessionId: string | null = null;
    const started = Date.now();
    try {
      const created = await call("/v1/sandboxes", {
        method: "POST",
        body: JSON.stringify({
          runtime: "node22",
          timeout: request.timeoutMs,
          resources: { vcpus: 2 },
        }),
      });
      sessionId = String(created.id ?? created.sandboxId ?? "");
      if (!sessionId) return { ok: false, error: "The sandbox did not start." };

      await call(`/v1/sandboxes/${sessionId}/files`, {
        method: "POST",
        body: JSON.stringify({ files: toFilePayload(request.files) }),
      });

      const steps: StepResult[] = [];
      for (const step of request.steps) {
        if (request.signal?.aborted) return { ok: false, error: "Run cancelled." };
        const elapsed = Date.now() - started;
        const remaining = request.timeoutMs - elapsed;
        if (remaining <= 0) {
          steps.push({ label: step.label, exitCode: 124, output: "Timed out before this step ran.", durationMs: 0 });
          break;
        }
        const stepStarted = Date.now();
        const result = await call(`/v1/sandboxes/${sessionId}/commands?wait=true`, {
          method: "POST",
          body: JSON.stringify({
            command: step.command,
            args: step.args,
            env: request.env,
            timeout: remaining,
            wait: true,
          }),
        });
        const exitCode = Number(result.exitCode ?? result.exit_code ?? 0);
        const output = clipOutput(String(result.output ?? result.logs ?? ""));
        steps.push({ label: step.label, exitCode, output, durationMs: Date.now() - stepStarted });
        // A failed install makes every later step meaningless noise.
        if (exitCode !== 0) break;
      }
      return { ok: true, steps, passed: steps.every((s) => s.exitCode === 0) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The sandbox failed." };
    } finally {
      if (sessionId) {
        // Best effort: an orphaned sandbox bills until it expires.
        await call(`/v1/sandboxes/${sessionId}`, { method: "DELETE" }).catch(() => undefined);
      }
    }
  }
}
