import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * The at-rest format for saved secrets (model keys, tokens, MCP servers).
 * AES-256-GCM, base64url parts. Pure: the keys come from the caller.
 *
 * v1  aperture.v1:<last4>:<iv>:<tag>:<ciphertext>
 *     Key derived from the sign-in secret. Read forever, written only while
 *     no secrets key is set.
 * v2  aperture.v2:<kid>:<last4 base64url>:<iv>:<tag>:<ciphertext>
 *     Key from APERTURE_SECRETS_KEY; `kid` names which one, so a value
 *     written under the previous key can still be read after a rotation.
 */
const V1 = "aperture.v1";
const V2 = "aperture.v2";

export type SecretsKey = { kid: string; key: Buffer };

export type SecretKeys = {
  /** The v1 key, derived from the sign-in secret. */
  legacy: Buffer;
  /** APERTURE_SECRETS_KEY: what new values are written under. */
  current: SecretsKey | null;
  /** APERTURE_SECRETS_KEY_PREVIOUS: still read, during a rotation. */
  previous: SecretsKey | null;
};

/** The v1 key, as it has always been derived. */
export function legacyKey(signInSecret: string): Buffer {
  return createHash("sha256").update(`aperture-keys:${signInSecret}`).digest();
}

/** A secrets key from any string; `kid` identifies it without revealing it. */
export function secretsKey(value: string): SecretsKey {
  const key = createHash("sha256").update(`aperture-secrets:${value}`).digest();
  return { kid: createHash("sha256").update(key).digest("hex").slice(0, 8), key };
}

/** Saved by this module in either format (anything else is a legacy plaintext value). */
export function isSealed(stored: string): boolean {
  return stored.startsWith(`${V1}:`) || stored.startsWith(`${V2}:`);
}

function seal(plain: string, key: Buffer): { iv: string; tag: string; ct: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ct: ct.toString("base64url"),
  };
}

function unseal(key: Buffer, iv: string, tag: string, ct: string): string | null {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Writes v2 under the current key when there is one, else v1 exactly as before. */
export function sealSecret(plain: string, keys: SecretKeys): string {
  const last4 = plain.slice(-4);
  if (!keys.current) {
    const { iv, tag, ct } = seal(plain, keys.legacy);
    return [V1, last4, iv, tag, ct].join(":");
  }
  const { iv, tag, ct } = seal(plain, keys.current.key);
  return [V2, keys.current.kid, Buffer.from(last4, "utf8").toString("base64url"), iv, tag, ct].join(
    ":",
  );
}

/**
 * The plain value, or null when it cannot be read (wrong or missing key,
 * tampered). A value saved before encryption existed comes back as it is.
 */
export function openSecret(stored: string | null, keys: SecretKeys): string | null {
  if (!stored) return null;
  if (!isSealed(stored)) return stored;
  const parts = stored.split(":");
  if (stored.startsWith(`${V2}:`)) {
    if (parts.length !== 6) return null;
    const [, kid, , iv, tag, ct] = parts;
    const key = [keys.current, keys.previous].find((k) => k?.kid === kid)?.key;
    return key ? unseal(key, iv!, tag!, ct!) : null;
  }
  // v1 kept last4 raw, so a secret ending in ":" split into more parts: the
  // last three are always iv, tag and ciphertext.
  if (parts.length < 5) return null;
  const [iv, tag, ct] = parts.slice(-3);
  return unseal(keys.legacy, iv!, tag!, ct!);
}

/** The last four characters shown in Settings, from either format or a plaintext value. */
export function sealedLast4(stored: string | null): string | null {
  if (!stored) return null;
  if (!isSealed(stored)) return stored.slice(-4);
  const parts = stored.split(":");
  const last4 = stored.startsWith(`${V2}:`)
    ? Buffer.from(parts[2] ?? "", "base64url").toString("utf8")
    : parts.slice(1, -3).join(":");
  return last4.length > 0 ? last4 : null;
}

/** Already v2 under the current key: nothing to re-encrypt. */
export function isCurrent(stored: string, current: SecretsKey): boolean {
  return stored.startsWith(`${V2}:${current.kid}:`);
}

/** What protects saved values: the secrets key, the secrets key once they finish moving to it, or the sign-in secret. */
export type SecretsProtection = "secrets-key" | "moving" | "sign-in-secret";

export function secretsProtection(
  stored: (string | null)[],
  current: SecretsKey | null,
): SecretsProtection {
  if (!current) return "sign-in-secret";
  return stored.every((value) => !value || isCurrent(value, current)) ? "secrets-key" : "moving";
}

export type Reseal = { kind: "keep" } | { kind: "unreadable" } | { kind: "reseal"; next: string };

/** What the sweep does with one stored value once a current key is set. */
export function planReseal(stored: string, keys: SecretKeys & { current: SecretsKey }): Reseal {
  if (isCurrent(stored, keys.current)) return { kind: "keep" };
  const plain = openSecret(stored, keys);
  if (plain === null || plain === "") return { kind: "unreadable" };
  return { kind: "reseal", next: sealSecret(plain, keys) };
}
