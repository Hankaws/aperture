/**
 * The bot's suggestion lists, signed. Ticking a box in a reply runs its
 * suggestion as a task, so a list must be one this bot wrote: another bot
 * (any GitHub App on the repository, or another workflow posting as
 * github-actions) could post a comment that looks like the bot's reply, with
 * a summary listing a task nobody suggested, and a maintainer who ticks it
 * would start it.
 *
 * So the summary of every comment the bot posts carries `sig`, an HMAC of its
 * suggestions, the repository and the thread, keyed from the model key: only
 * a workflow holding that secret can sign. A tick on a list without a valid
 * `sig` (another bot's, a copy from another thread, or a reply from before
 * the bot signed) starts nothing. Pure, for tests.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readSummary } from "../../../src/lib/bot/summary.ts";

/** Where a list was posted: a signature is good on that thread of that repository only. */
export type SealScope = { repo: string; number: number };

const OPEN = "<!-- aperture-bot ";
const CLOSE = " -->";
const SIG = /,"sig":"[0-9a-f]*"(?=\}$)/;

/**
 * The signing key, derived from the model key so the key itself never signs
 * anything; null without one, and then nothing is signed.
 */
export function sealKey(secret: string): Buffer | null {
  return secret
    ? createHmac("sha256", secret).update("aperture-bot suggestions v1").digest()
    : null;
}

/** The signature of a list of suggestions on a thread: 32 hex characters. */
export function suggestionSig(key: Buffer, scope: SealScope, next: string[]): string {
  return createHmac("sha256", key)
    .update(JSON.stringify([scope.repo.toLowerCase(), scope.number, next]))
    .digest("hex")
    .slice(0, 32);
}

/**
 * The body with its summary signed, when the summary lists suggestions. The
 * list signed is the one `readSummary` reads back, so the tick checks exactly
 * what it would run. Any other body is returned as it is.
 */
export function sealBody(body: string, key: Buffer | null, scope: SealScope): string {
  if (!key) return body;
  const next = readSummary(body)?.next;
  if (!next?.length) return body;
  const start = body.lastIndexOf(OPEN);
  const end = body.indexOf(CLOSE, start + OPEN.length);
  if (start < 0 || end < 0) return body;
  const json = body.slice(start + OPEN.length, end).replace(SIG, "");
  if (!json.endsWith("}")) return body;
  const signed = `${json.slice(0, -1)},"sig":"${suggestionSig(key, scope, next)}"}`;
  return `${body.slice(0, start + OPEN.length)}${signed}${body.slice(end)}`;
}

/** True when the body's suggestions were signed by this bot, for this thread. */
export function isSealed(body: string, key: Buffer | null, scope: SealScope): boolean {
  if (!key) return false;
  const summary = readSummary(body);
  if (!summary?.next?.length || !summary.sig) return false;
  const want = Buffer.from(suggestionSig(key, scope, summary.next));
  const got = Buffer.from(summary.sig);
  return got.length === want.length && timingSafeEqual(got, want);
}
