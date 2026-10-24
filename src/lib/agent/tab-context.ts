import { isSecretPath, redactSecrets } from "../security/redact.ts";

export const TAB_PREFIX_CHARS = 2800;
export const TAB_SUFFIX_CHARS = 400;

/**
 * What Tab may send a model: the text around the cursor, with secret-looking
 * lines redacted as Composer's are. Null when nothing should be sent.
 */
export function tabContext(
  path: string,
  prefix: unknown,
  suffix: unknown,
): { prefix: string; suffix: string } | null {
  if (isSecretPath(path)) return null;
  const before = redactSecrets(typeof prefix === "string" ? prefix.slice(-TAB_PREFIX_CHARS) : "", path);
  const after = redactSecrets(typeof suffix === "string" ? suffix.slice(0, TAB_SUFFIX_CHARS) : "", path);
  // A private key cut by the window keeps one marker, and redaction needs both: send nothing.
  if (/PRIVATE KEY-----/.test(before + after)) return null;
  return { prefix: before, suffix: after };
}
