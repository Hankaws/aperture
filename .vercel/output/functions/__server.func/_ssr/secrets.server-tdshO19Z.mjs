import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/secrets.server-tdshO19Z.js
/**
* AES-256-GCM envelope for BYOK strings at rest.
* Format: aperture.v1:<last4>:<iv>:<tag>:<ciphertext>  (base64url parts)
* Never import this from client code.
*/
var PREFIX = "aperture.v1";
function material() {
	const raw = (process.env.BETTER_AUTH_SECRET || process.env.GROK_AUTH_CLIENT_SECRET || "").trim();
	if (raw) return createHash("sha256").update(`aperture-keys:${raw}`).digest();
	const g = globalThis;
	g.__apertureKeyMaterial ??= randomBytes(32);
	return g.__apertureKeyMaterial;
}
function isEncryptedSecret(stored) {
	return stored.startsWith(`${PREFIX}:`);
}
function peekLast4(stored) {
	if (!stored) return null;
	if (isEncryptedSecret(stored)) {
		const last4 = stored.split(":")[1] ?? "";
		return last4.length > 0 ? last4 : null;
	}
	return stored.slice(-4);
}
function encryptSecret(plain) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", material(), iv);
	const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [
		PREFIX,
		plain.slice(-4),
		iv.toString("base64url"),
		tag.toString("base64url"),
		enc.toString("base64url")
	].join(":");
}
function decryptSecret(stored) {
	if (!stored) return null;
	if (!isEncryptedSecret(stored)) return stored;
	const parts = stored.split(":");
	if (parts.length !== 5) return null;
	const [, , ivB64, tagB64, ctB64] = parts;
	try {
		const decipher = createDecipheriv("aes-256-gcm", material(), Buffer.from(ivB64, "base64url"));
		decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
		return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}
function validateProviderKey(provider, key) {
	const next = key.trim();
	if (next.length < 16 || next.length > 256) throw new Error("That does not look like an API key.");
	if (!/^[\x21-\x7E]+$/.test(next)) throw new Error("API keys can only contain printable characters.");
	if (/\s/.test(next)) throw new Error("API keys cannot contain spaces.");
	if (provider === "openai" && !next.startsWith("sk-")) throw new Error("OpenAI keys start with sk-");
	if (provider === "anthropic" && !next.startsWith("sk-ant-")) throw new Error("Anthropic keys start with sk-ant-");
	if (provider === "grok" && !(next.startsWith("xai-") || next.startsWith("sk-"))) throw new Error("xAI keys start with xai-");
	return next;
}
//#endregion
export { decryptSecret, encryptSecret, isEncryptedSecret, peekLast4, validateProviderKey };
