import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { ProviderId } from "@/lib/billing/plans";

/**
 * AES-256-GCM envelope for BYOK strings at rest.
 * Format: aperture.v1:<last4>:<iv>:<tag>:<ciphertext>  (base64url parts)
 * Never import this from client code.
 */

const PREFIX = "aperture.v1";

type GlobalKeys = typeof globalThis & { __apertureKeyMaterial?: Buffer };

function material(): Buffer {
  const raw = (process.env.BETTER_AUTH_SECRET || process.env.GROK_AUTH_CLIENT_SECRET || "").trim();
  if (raw) return createHash("sha256").update(`aperture-keys:${raw}`).digest();
  const g = globalThis as GlobalKeys;
  g.__apertureKeyMaterial ??= randomBytes(32);
  return g.__apertureKeyMaterial;
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(`${PREFIX}:`);
}

export function peekLast4(stored: string | null): string | null {
  if (!stored) return null;
  if (isEncryptedSecret(stored)) {
    const last4 = stored.split(":")[1] ?? "";
    return last4.length > 0 ? last4 : null;
  }
  return stored.slice(-4);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", material(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const last4 = plain.slice(-4);
  return [PREFIX, last4, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(stored: string | null): string | null {
  if (!stored) return null;
  if (!isEncryptedSecret(stored)) return stored;
  const parts = stored.split(":");
  if (parts.length !== 5) return null;
  const [, , ivB64, tagB64, ctB64] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", material(), Buffer.from(ivB64!, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64!, "base64url"));
    const out = Buffer.concat([decipher.update(Buffer.from(ctB64!, "base64url")), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return null;
  }
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
