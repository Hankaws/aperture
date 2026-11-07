import { isMetadataAddress, isPrivateAddress } from "./custom-endpoint";
import { pinnedFetch } from "@/lib/security/pinned-fetch.server";
import { checkWebUrl, FETCH_TIMEOUT_MS, MAX_FETCH_BYTES, MAX_REDIRECTS, pageForModel } from "./web";

const publicAddress = (address: string) =>
  !isPrivateAddress(address) && !isMetadataAddress(address);

/**
 * Reads a page for the agent's `web_fetch` (`web.ts`): GET only, no cookies
 * or credentials, connected only to the public addresses its host resolves
 * to now. A redirect is followed only to a host the person linked to, at most
 * MAX_REDIRECTS times. Returns the page as the model is given it, or why it
 * could not be read.
 */
export async function fetchPage(
  raw: string,
  hosts: Set<string>,
  signal?: AbortSignal,
  /** For tests: which addresses may be connected to, and how a host resolves. */
  net: {
    allowed?: (address: string) => boolean;
    resolve?: (host: string) => Promise<string[]>;
  } = {},
): Promise<string> {
  let checked = checkWebUrl(raw, hosts);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if ("error" in checked) return checked.error;
    const url = checked.url;
    let pinned;
    try {
      pinned = await pinnedFetch(
        url,
        {
          method: "GET",
          headers: {
            Accept: "text/html, text/plain, text/markdown, application/json;q=0.9, */*;q=0.5",
            "User-Agent": "ApertureAgent/1.0 (+https://aperturesais.grok.me)",
          },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
            : AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
        net.allowed ?? publicAddress,
        net.resolve,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/not allowed/.test(message))
        return `${url.hostname} is not a public address, so it cannot be read.`;
      if (/resolve/.test(message)) return `${url.hostname} could not be found.`;
      return `${url} could not be read: ${/abort|timeout/i.test(message) ? "it took too long" : "the connection failed"}.`;
    }
    const { response, close } = pinned;
    try {
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return `${url} redirected without saying where.`;
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return `${url} redirected to an address that is not a URL.`;
        }
        checked = checkWebUrl(next.toString(), hosts);
        if ("error" in checked) return `${url} redirected to ${next}. ${checked.error}`;
        continue;
      }
      if (!response.ok)
        return `${url} answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`;
      const body = await readCapped(response, MAX_FETCH_BYTES);
      return pageForModel(url, response.headers.get("content-type") ?? "", body);
    } finally {
      await close();
    }
  }
  return `It redirected more than ${MAX_REDIRECTS} times, so it was not read.`;
}

/** The body as text, cut at `max` bytes; decoded by the charset it names, else UTF-8. */
async function readCapped(response: Response, max: number): Promise<string> {
  const charset =
    /charset=([^;]+)/i.exec(response.headers.get("content-type") ?? "")?.[1]?.trim() ?? "utf-8";
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  let text = "";
  let read = 0;
  while (read < max) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = read + value.length > max ? value.subarray(0, max - read) : value;
    read += chunk.length;
    text += decoder.decode(chunk, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text + decoder.decode();
}
