import { getBearerToken } from "@/lib/auth/client";

export async function requestTabCompletion(
  input: { path: string; prefix: string; suffix: string },
  signal?: AbortSignal,
): Promise<string | null> {
  const token = getBearerToken();
  const res = await fetch("/api/tab", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(input),
    signal,
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { text?: string };
  const text = (body.text ?? "").trim();
  return text.length > 0 ? text : null;
}
