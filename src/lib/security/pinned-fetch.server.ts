import { lookup } from "node:dns/promises";
import { Agent } from "undici";

export type PinnedResponse = { response: Response; close: () => Promise<void> };

/** Every address a name resolves to right now. */
export async function resolveAll(host: string): Promise<string[]> {
  try {
    return (await lookup(host, { all: true })).map((rec) => rec.address);
  } catch {
    throw new Error("Could not resolve that address.");
  }
}

/**
 * Fetch a URL on the server's behalf, connecting only to the addresses its host
 * resolves to now, and only when every one of them passes `allowed`.
 *
 * Checking a name and then fetching it looks the name up twice, and a host can
 * answer the second lookup with a private address (DNS rebinding). Connecting
 * to the checked answer closes that. Redirects are never followed: a public host
 * could otherwise bounce the request, and its credentials, to a private one.
 *
 * Call `close` once the body has been read. A caller that passes a streamed body
 * on can skip it: the connection closes when the body ends and the pool idles out.
 */
export async function pinnedFetch(
  url: string | URL,
  init: RequestInit,
  allowed: (address: string) => boolean,
  resolve: (host: string) => Promise<string[]> = resolveAll,
): Promise<PinnedResponse> {
  const target = new URL(url);
  const host = bare(target.hostname);
  const addresses = await resolve(host);
  if (addresses.length === 0 || addresses.some((address) => !allowed(address))) {
    throw new Error("That address is not allowed.");
  }
  const dispatcher = new Agent({
    keepAliveTimeout: 1000,
    connect: {
      lookup(hostname, _options, callback) {
        if (bare(hostname) !== host) {
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
    const response = await fetch(target, {
      ...init,
      redirect: "manual",
      dispatcher,
    } as RequestInit);
    return { response, close: () => dispatcher.close() };
  } catch (err) {
    await dispatcher.close();
    throw err;
  }
}

function bare(host: string): string {
  return host.toLowerCase().replace(/^\[|\]$/g, "");
}
