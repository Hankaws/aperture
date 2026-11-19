import { useCallback, useEffect, useState } from "react";
import type { Memory } from "@/lib/bot/memory";
import { forgetAllMemory, forgetMemory, keepMemory, loadMemory } from "@/lib/bot/memory.api";

export type MemoryStore = ReturnType<typeof useMemory>;

/** Sent when a bot's memory changes, so its chat and its Knowledge, open together, agree. */
const CHANGED = "aperture:memory-changed";
const changed = (scope: string) =>
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: { scope } }));

/**
 * What a bot remembers about the person (`memory.ts`): Aperture Bot's own
 * with no `botId`, or a team bot's. Read once, then kept in step with each
 * keep, edit and forget, here and wherever else the same bot's memory shows.
 * `available` is false for a visitor, who has no account to keep it on.
 */
export function useMemory(botId?: string) {
  const scope = botId ?? "private";
  const [memories, setMemories] = useState<Memory[]>([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const out = await loadMemory({ data: botId ? { botId } : {} }).catch(() => null);
    if (!out?.ok) return;
    setMemories(out.memories);
    setAvailable(true);
  }, [botId]);

  useEffect(() => {
    void reload();
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<{ scope: string }>).detail?.scope === scope) void reload();
    };
    window.addEventListener(CHANGED, onChanged);
    return () => window.removeEventListener(CHANGED, onChanged);
  }, [reload, scope]);

  /** Lines a reply just offered. */
  const add = useCallback(
    (offered: Memory[]) => {
      setMemories((now) => [...now.filter((m) => !offered.some((o) => o.id === m.id)), ...offered]);
      changed(scope);
    },
    [scope],
  );

  const keep = useCallback(
    async (id: string, text?: string) => {
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
      changed(scope);
      return true;
    },
    [scope],
  );

  const forget = useCallback(
    async (id: string) => {
      setError(null);
      setMemories((now) => now.filter((m) => m.id !== id));
      await forgetMemory({ data: { id } }).catch(() => setError("Could not forget it. Try again."));
      changed(scope);
    },
    [scope],
  );

  const forgetAll = useCallback(async () => {
    setError(null);
    setMemories([]);
    await forgetAllMemory({ data: botId ? { botId } : {} }).catch(() =>
      setError("Could not forget everything. Try again."),
    );
    changed(scope);
  }, [botId, scope]);

  return { memories, available, error, add, keep, forget, forgetAll };
}
