import { randomBytes } from "node:crypto";
import type { ProviderId } from "@/lib/billing/plans";
import {
  isSealed,
  legacyKey,
  openSecret,
  sealSecret,
  sealedLast4,
  secretsKey,
  secretsProtection,
  type SecretKeys,
  type SecretsProtection,
} from "./secret-box";

/**
 * Saved secrets at rest (format in `secret-box.ts`). Never import this from
 * client code.
 *
 * APERTURE_SECRETS_KEY (32+ characters) is the key new values are written
 * under, so rotating the sign-in secret leaves them readable;
 * APERTURE_SECRETS_KEY_PREVIOUS is still read during a rotation. Without it,
 * values are written as before, under a key derived from the sign-in secret.
 */

const MIN_KEY_LENGTH = 32;

type GlobalKeys = typeof globalThis & { __apertureKeyMaterial?: Buffer; __apertureShortKeyWarned?: boolean };

function legacyMaterial(): Buffer {
  const raw = (process.env.BETTER_AUTH_SECRET || process.env.GROK_AUTH_CLIENT_SECRET || "").trim();
  if (raw) return legacyKey(raw);
  const g = globalThis as GlobalKeys;
  g.__apertureKeyMaterial ??= randomBytes(32);
  return g.__apertureKeyMaterial;
}

function configuredKey(name: string) {
  const value = (process.env[name] ?? "").trim();
  if (!value) return null;
  if (value.length < MIN_KEY_LENGTH) {
    const g = globalThis as GlobalKeys;
    if (!g.__apertureShortKeyWarned) {
      g.__apertureShortKeyWarned = true;
      console.warn(`[secrets] ${name} is shorter than ${MIN_KEY_LENGTH} characters and is ignored.`);
    }
    return null;
  }
  return secretsKey(value);
}

/** The keys in use now: the legacy one always, the secrets keys when set. */
export function secretKeys(): SecretKeys {
  return {
    legacy: legacyMaterial(),
    current: configuredKey("APERTURE_SECRETS_KEY"),
    previous: configuredKey("APERTURE_SECRETS_KEY_PREVIOUS"),
  };
}

export function isEncryptedSecret(stored: string): boolean {
  return isSealed(stored);
}

export function peekLast4(stored: string | null): string | null {
  return sealedLast4(stored);
}

export function encryptSecret(plain: string): string {
  return sealSecret(plain, secretKeys());
}

export function decryptSecret(stored: string | null): string | null {
  return openSecret(stored, secretKeys());
}

/** What protects these saved values, for Settings to show. */
export function protectionOf(stored: (string | null)[]): SecretsProtection {
  return secretsProtection(stored, secretKeys().current);
}

export function validateProviderKey(provider: ProviderId, key: string): string {
  const next = key.trim();
  if (next.length < 16 || next.length > 256) {
    throw new Error("That does not look like an API key.");
  }
  if (!/^[\x21-\x7E]+$/.test(next)) {
    throw new Error("API keys can only contain printable characters.");
  }
  if (/\s/.test(next)) {
    throw new Error("API keys cannot contain spaces.");
  }
  if (provider === "openai" && !next.startsWith("sk-")) {
    throw new Error("OpenAI keys start with sk-");
  }
  if (provider === "anthropic" && !next.startsWith("sk-ant-")) {
    throw new Error("Anthropic keys start with sk-ant-");
  }
  if (provider === "grok" && !(next.startsWith("xai-") || next.startsWith("sk-"))) {
    throw new Error("xAI keys start with xai-");
  }
  if (provider === "gemini" && !next.startsWith("AIza")) {
    throw new Error("Gemini keys start with AIza");
  }
  if (provider === "deepseek" && !next.startsWith("sk-")) {
    throw new Error("DeepSeek keys start with sk-");
  }
  return next;
}
