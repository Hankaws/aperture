import { lookup } from "node:dns/promises";
import { Agent } from "undici";
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
  const url = new URL(endpoint.trim());
  const records = await lookup(url.hostname, { all: true });
  if (records.length === 0 || records.some((rec) => blockedAddress(rec.address, local))) {
    throw new Error("That address is not allowed.");
  }
  const addresses = records.map((rec) => rec.address);
  const host = url.hostname;
  const dispatcher = new Agent({
    connect: {
      lookup(hostname, _options, callback) {
        if (hostname !== host) {
          callback(new Error("unexpected host"), "");
          return;
        }
        callback(
          null,
          addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
        );
      },
    },
  });
  try {
    const response = await fetch(url, { ...init, redirect: "manual", dispatcher } as RequestInit);
    return { response, close: () => dispatcher.close() };
  } catch (err) {
    await dispatcher.close();
    throw err;
  }
}
