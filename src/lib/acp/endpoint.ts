import { isMetadataAddress, isPrivateAddress } from "../agent/custom-endpoint.ts";

/** Why this agent URL must not be called, or null when the shape is allowed. DNS is checked separately. */
export function acpEndpointError(raw: string, localAllowed: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "Endpoint must be a URL.";
  }
  if (url.username || url.password) return "Put the token in the token field, not in the URL.";
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Endpoint must be http or https.";
  const host = url.hostname.toLowerCase();
  if (!host) return "Endpoint must have a host.";
  if (isMetadataAddress(host) || (!localAllowed && isPrivateAddress(host))) {
    return "That address is not allowed.";
  }
  if (!localAllowed && url.protocol !== "https:") return "Use an https address.";
  return null;
}
