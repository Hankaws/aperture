import { lookup } from "node:dns/promises";
import { pinnedFetch } from "@/lib/security/pinned-fetch.server";
import { isMetadataAddress, isPrivateAddress, localEndpointsAllowed } from "@/lib/agent/custom-endpoint";
import { acpEndpointError } from "./endpoint";

/** Resolve the host and refuse a name that points at a private or metadata address. */
export async function assertAcpResolves(
  raw: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const local = localEndpointsAllowed(env);
  const problem = acpEndpointError(raw, local);
  if (problem) throw new Error(problem);
  const url = new URL(raw.trim());
  const records = await lookup(url.hostname, { all: true });
  if (records.length === 0 || records.some((rec) => blockedAddress(rec.address, local))) {
    throw new Error("That address is not allowed.");
  }
  return url.toString();
}

function blockedAddress(address: string, local: boolean): boolean {
  if (isMetadataAddress(address)) return true;
  return !local && isPrivateAddress(address);
}

/**
 * POST to an agent URL that was just resolved, and connect only to those addresses.
 * Redirects are not followed: a public host can otherwise bounce to a metadata address.
 * Call `close` after the body has been read.
 */
export async function acpFetch(
  endpoint: string,
  init: RequestInit,
): Promise<{ response: Response; close: () => Promise<void> }> {
  const local = localEndpointsAllowed(process.env);
  const problem = acpEndpointError(endpoint, local);
  if (problem) throw new Error(problem);
  return pinnedFetch(endpoint.trim(), init, (address) => !blockedAddress(address, local));
}
