/** The public demo. Recorded runs only — never the operator's Grok key. */
export const PUBLIC_DEMO_HOST = "aperturesais.grok.me";

export function isPublicDemoHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.trim().toLowerCase().split(",")[0]?.trim().split(":")[0];
  return name === PUBLIC_DEMO_HOST;
}
