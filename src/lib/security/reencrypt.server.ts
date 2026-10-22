import { keepAlive } from "@/lib/jobs/keep-alive.server";
import { reencryptSecrets } from "./reencrypt";
import { secretKeys } from "./secrets.server";

type GlobalSweep = typeof globalThis & { __apertureSecretsSweep?: Promise<void> };

/**
 * Once per server instance, when APERTURE_SECRETS_KEY is set: moves saved
 * secrets written under the sign-in secret (or the previous key) under it, in
 * the background. It runs in the new deployment, after it serves traffic: an
 * older deployment cannot read the new format, so this never happens at build
 * time. Logs counts only.
 */
export function startSecretsSweep(): void {
  const keys = secretKeys();
  const current = keys.current;
  if (!current) return;
  const g = globalThis as GlobalSweep;
  if (g.__apertureSecretsSweep) return;
  const sweep = (async () => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { changed, unreadable } = await reencryptSecrets(
      (text, params) => sql.query(text, params),
      { ...keys, current },
    );
    console.log(
      `[secrets] re-encrypted ${changed} saved secret(s) under the secrets key; ${unreadable} could not be read.`,
    );
  })().catch((error: unknown) => {
    // Try again on a later request.
    g.__apertureSecretsSweep = undefined;
    console.error(
      `[secrets] re-encryption stopped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  });
  g.__apertureSecretsSweep = sweep;
  keepAlive(sweep);
}
