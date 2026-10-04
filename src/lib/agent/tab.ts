import { getBearerToken } from "@/lib/auth/client";

export async function requestTabCompletion(
  input: { path: string; prefix: string; suffix: string },
  signal?: AbortSignal,
): Promise<{ text: string | null; reason: string | null }> {
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
  if (res.status === 401) return { text: null, reason: "Sign in to use Tab." };
  if (res.status === 403) return { text: null, reason: null };
  if (!res.ok) return { text: null, reason: "Tab did not answer." };
  const body = (await res.json()) as { text?: string; reason?: string };
  const text = (body.text ?? "").trim();
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  return { text: text.length > 0 ? text : null, reason };
}
