import { lookup } from "node:dns/promises";
import { pinnedFetch, type PinnedResponse } from "../security/pinned-fetch.server.ts";
import {
  customAddressAllowed,
  isPrivateAddress,
  LOCAL_ENDPOINTS_OFF,
  localEndpointsAllowed,
  normalizeCustomBase,
} from "./custom-endpoint.ts";

/**
 * Resolves the host and refuses a public name that points at a private address.
 * Loopback is refused too once deployed (see `localEndpointsAllowed`).
 */
export async function assertFetchableBase(
  raw: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const base = normalizeCustomBase(raw);
  if (!base) throw new Error("Use http://127.0.0.1 for Ollama or LM Studio, or https for OpenRouter.");
  const host = new URL(base).hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    if (!localEndpointsAllowed(env)) throw new Error(LOCAL_ENDPOINTS_OFF);
    return base;
  }
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

/**
 * Call a custom endpoint at `path` under its base. The base is checked as above,
 * then the request connects only to the addresses that check resolved, so a
 * name cannot answer the check with a public address and the call with a
 * private one.
 */
export async function customEndpointFetch(
  base: string,
  path: string,
  init: RequestInit,
  env: Record<string, string | undefined> = process.env,
  resolve?: (host: string) => Promise<string[]>,
): Promise<PinnedResponse> {
  const checked = await assertFetchableBase(base, env);
  const host = new URL(checked).hostname;
  return pinnedFetch(`${checked}${path}`, init, (address) => customAddressAllowed(host, address), resolve);
}
