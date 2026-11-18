import { useCallback, useEffect, useState } from "react";
import type { Memory } from "@/lib/bot/memory";
import { forgetAllMemory, forgetMemory, keepMemory, loadMemory } from "@/lib/bot/private-chat.api";

export type MemoryStore = ReturnType<typeof useMemory>;

/**
 * What Aperture Bot remembers about the person (`memory.ts`), as the chat
 * shows it: read once, then kept in step with each keep, edit and forget.
 * `available` is false for a visitor, who has no account to keep it on.
 */
export function useMemory() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void loadMemory()
      .then((out) => {
        if (cancel || !out.ok) return;
        setMemories(out.memories);
        setAvailable(true);
      })
      .catch(() => {
        // Offline, or no account: the chat goes on without memory.
      });
    return () => {
      cancel = true;
    };
  }, []);

  /** Lines a reply just offered. */
  const add = useCallback((offered: Memory[]) => {
    setMemories((now) => [...now.filter((m) => !offered.some((o) => o.id === m.id)), ...offered]);
  }, []);

  const keep = useCallback(async (id: string, text?: string) => {
    setError(null);
    const out = await keepMemory({ data: { id, ...(text === undefined ? {} : { text }) } }).catch(
      (e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not keep it.",
      }),
    );
    if (!out.ok) {
      setError(out.error);
      return false;
    }
    setMemories((now) =>
      now.map((m) =>
        m.id === id
          ? { ...m, status: "kept", text: text?.replace(/\s+/g, " ").trim() || m.text }
          : m,
      ),
    );
    return true;
  }, []);

  const forget = useCallback(async (id: string) => {
    setError(null);
    setMemories((now) => now.filter((m) => m.id !== id));
    await forgetMemory({ data: { id } }).catch(() => setError("Could not forget it. Try again."));
  }, []);

  const forgetAll = useCallback(async () => {
    setError(null);
    setMemories([]);
    await forgetAllMemory().catch(() => setError("Could not forget everything. Try again."));
  }, []);

  return { memories, available, error, add, keep, forget, forgetAll };
}
