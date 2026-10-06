/**
 * Agent tokens: what an agent presents to Aperture's MCP server. Made in
 * Settings → Agents, shown once, stored only as a SHA-256.
 *
 * Server only (node:crypto). The Settings UI gets what it needs from the
 * server functions in `./tokens.api`.
 */
import { createHash, randomBytes } from "node:crypto";

/** Tokens one account can hold at once. */
export const MAX_AGENT_TOKENS = 5;

const PREFIX = "apt_";
/** `apt_` and 43 base64url characters: 32 random bytes. */
const SHAPE = /^apt_[A-Za-z0-9_-]{43}$/;

/** A new token, its hash for the database, and the hint the list shows. */
export function newAgentToken(): { token: string; hash: string; hint: string } {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashAgentToken(token), hint: tokenHint(token) };
}

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The first characters, enough to tell two tokens apart in a list. */
export function tokenHint(token: string): string {
  return `${token.slice(0, PREFIX.length + 6)}…`;
}

/** Whether a string could be an agent token at all. Anything else is refused without a database read. */
export function looksLikeAgentToken(value: string): boolean {
  return SHAPE.test(value);
}

/** The token in an `Authorization: Bearer …` header, or null. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1]! : null;
}

/** A name for the list: trimmed, one line, at most 60 characters. Null when nothing is left. */
export function cleanTokenName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 60);
  return name.length > 0 ? name : null;
}
