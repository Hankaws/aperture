import { getRequest } from "@tanstack/react-start/server";
import { isPublicDemoHost } from "./public-demo.ts";

/** True on the public demo, where Composer must not spend the operator's Grok key. */
export function requestIsPublicDemo(): boolean {
  if (process.env.APERTURE_PUBLIC_DEMO?.trim() === "1") return true;
  if (isPublicDemoHost(process.env.VITE_PUBLIC_HOSTNAME)) return true;
  try {
    const request = getRequest();
    if (!request) return false;
    return isPublicDemoHost(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  } catch {
    return false;
  }
}
