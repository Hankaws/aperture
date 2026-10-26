import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How far a webhook's signed time may be from the server's clock. Paddle's SDK
 * allows 5 seconds; a little more absorbs clock skew between the two, and an
 * old event replayed inside the window changes nothing (events older than the
 * newest applied are ignored).
 */
export const SIGNATURE_TOLERANCE_S = 60;

/**
 * Whether `Paddle-Signature` (`ts=…;h1=…`) signs this exact body:
 * HMAC-SHA256 of `${ts}:${rawBody}` with the destination's secret, in hex.
 * During a secret rotation the header can carry more than one `h1`; any match
 * counts.
 */
export function validPaddleSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!header || !secret) return false;
  let ts: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === "ts" && /^\d+$/.test(value)) ts = Number(value);
    else if (key === "h1" && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (ts === null || signatures.length === 0) return false;
  if (Math.abs(nowMs - ts * 1000) > SIGNATURE_TOLERANCE_S * 1000) return false;
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex"),
  );
  return signatures.some((sig) => timingSafeEqual(Buffer.from(sig), expected));
}
