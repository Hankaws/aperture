import { lookup } from "node:dns/promises";
import { isPrivateAddress, normalizeCustomBase } from "./custom-endpoint";

/** Resolves the host and refuses a public name that points at a private address. */
export async function assertFetchableBase(raw: string): Promise<string> {
  const base = normalizeCustomBase(raw);
  if (!base) throw new Error("Use http://127.0.0.1 for Ollama or LM Studio, or https for OpenRouter.");
  const host = new URL(base).hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return base;
  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve that endpoint.");
  }
  if (records.length === 0 || records.some((rec) => isPrivateAddress(rec.address))) {
    throw new Error("That endpoint does not resolve to a public address.");
  }
  return base;
}
