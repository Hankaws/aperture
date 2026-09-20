/** Fold older Composer turns into a short thread-memory block. No extra model call. */

export const HISTORY_KEEP = 4;
export const HISTORY_BUDGET = 8_000;
export const TURN_CLIP = 1_200;
export const MEMORY_CLIP = 2_400;
export const LOOP_BUDGET = 48_000;
export const TOOL_CLIP = 400;

export type Compactable = {
  role: "user" | "assistant";
  content: string;
  edits?: Array<{ path: string; status: string; description?: string }>;
  plan?: Array<{ content: string; status: string }>;
};

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export type LoopMsg = {
  role: string;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: unknown;
};

export function clipText(text: string, n: number): string {
  const t = text.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}\n…`;
}

function oneLine(text: string, n = 140): string {
  return text.replace(/\s+/g, " ").trim().slice(0, n);
}

export function summarizeTurn(message: Compactable): string {
  if (message.role === "user") return `- User: ${oneLine(message.content)}`;
  const edits = message.edits ?? [];
  const applied = [...new Set(edits.filter((e) => e.status === "applied").map((e) => e.path))];
  const pending = [...new Set(edits.filter((e) => e.status === "pending").map((e) => e.path))];
  const open = (message.plan ?? []).filter((p) => p.status !== "completed").map((p) => p.content);
  const bits: string[] = [];
  if (applied.length) bits.push(`applied ${applied.slice(0, 4).join(", ")}`);
  if (pending.length) bits.push(`pending ${pending.slice(0, 4).join(", ")}`);
  if (open.length) bits.push(`open: ${open.slice(0, 2).join("; ")}`);
  const text = oneLine(message.content, 80);
  return `- Agent: ${text || "(no recap)"}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
}

export function priorMessages<T extends Compactable>(messages: T[], instruction: string): T[] {
  const usable = messages.filter(
    (m) => m.content.trim().length > 0 || (m.edits?.length ?? 0) > 0 || (m.plan?.length ?? 0) > 0,
  );
  const last = usable[usable.length - 1];
  if (last?.role === "user" && instruction.trim().startsWith(last.content.trim())) {
    return usable.slice(0, -1);
  }
  return usable;
}

export function compactHistory(
  messages: Compactable[],
  keep = HISTORY_KEEP,
): { history: HistoryTurn[]; compacted: number } {
  const clipped: HistoryTurn[] = messages.map((m) => ({
    role: m.role,
    content: clipText(m.content, TURN_CLIP),
  }));
  const chars = clipped.reduce((n, m) => n + m.content.length, 0);
  if (messages.length <= keep + 2 && chars <= HISTORY_BUDGET) {
    return { history: clipped, compacted: 0 };
  }
  const head = messages.slice(0, Math.max(0, messages.length - keep));
  const tail = messages.slice(-keep);
  if (head.length === 0) return { history: clipped, compacted: 0 };
  const memory = clipText(
    [`Thread memory (${head.length} earlier turns; continue from here):`, ...head.map(summarizeTurn)].join("\n"),
    MEMORY_CLIP,
  );
  return {
    history: [
      { role: "user", content: memory },
      { role: "assistant", content: "Noted. I'll use the thread memory and continue from the latest turns." },
      ...tail.map((m) => ({ role: m.role, content: clipText(m.content, TURN_CLIP) })),
    ],
    compacted: head.length,
  };
}

function totalChars(messages: LoopMsg[]): number {
  return messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
}

/** Shrink stale tool dumps so later steps stay inside the window. Keeps the last two tool results intact. */
export function compactLoopMessages<T extends LoopMsg>(messages: T[], budget = LOOP_BUDGET): T[] {
  if (totalChars(messages) <= budget) return messages;
  const next = messages.map((m) => ({ ...m }));
  const toolIdx: number[] = [];
  for (let i = 0; i < next.length; i++) {
    if (next[i]!.role === "tool") toolIdx.push(i);
  }
  const preserve = new Set(toolIdx.slice(-2));
  for (const i of toolIdx) {
    if (preserve.has(i)) continue;
    const content = next[i]!.content ?? "";
    if (content.length > TOOL_CLIP) next[i] = { ...next[i]!, content: `${content.slice(0, TOOL_CLIP)}\n…` };
  }
  if (totalChars(next) <= budget) return next;
  const lastKeep = Math.max(2, next.length - 4);
  for (let i = 2; i < lastKeep; i++) {
    const row = next[i]!;
    if (row.role !== "assistant") continue;
    const content = row.content ?? "";
    if (content.length > 220) next[i] = { ...row, content: `${content.slice(0, 220)}\n…` };
  }
  return next;
}
