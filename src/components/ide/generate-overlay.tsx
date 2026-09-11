import { ApertureMark } from "./logo";
import { useWorkspace } from "@/lib/workspace/store";
import type { AgentMode, ChatMessage } from "@/lib/workspace/types";

function lastAssistant(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return messages[i];
  }
  return undefined;
}

function isGenerating(message: ChatMessage | undefined, mode: AgentMode | null) {
  if (!message || mode === "chat") return false;
  if (message.awaitingBuild) return false;
  if (message.edits?.length) return true;
  if (message.traces?.some((t) => /edit|write|patch|create/.test(t.name))) return true;
  const status = (message.status ?? "").toLowerCase();
  if (/plan/.test(status)) return false;
  return /build|writ|generat|edit/.test(status);
}

function generatingPath(message: ChatMessage | undefined, fallback: string | null) {
  const traces = message?.traces ?? [];
  for (let i = traces.length - 1; i >= 0; i--) {
    const t = traces[i];
    if (t && typeof t.args.path === "string" && /edit|write|patch|create/.test(t.name)) {
      return t.args.path;
    }
  }
  const edit = message?.edits?.[message.edits.length - 1];
  if (edit?.path) return edit.path;
  for (let i = traces.length - 1; i >= 0; i--) {
    const t = traces[i];
    if (t && typeof t.args.path === "string") return t.args.path;
  }
  return fallback;
}

function streamLines(message: ChatMessage | undefined, path: string | null, files: Record<string, string>) {
  const edits = message?.edits ?? [];
  const edit =
    (path ? [...edits].reverse().find((e) => e.path === path) : undefined) ?? edits[edits.length - 1];
  const source = edit?.newText || (path ? files[path] : "") || "";
  const lines = source.split("\n");
  const max = 16;
  const start = Math.max(0, lines.length - max);
  return { start, lines: lines.slice(start) };
}

export function GenerateOverlay() {
  const running = useWorkspace((s) => s.agentRunning);
  const mode = useWorkspace((s) => s.runningMode);
  const messages = useWorkspace((s) => s.messages);
  const activePath = useWorkspace((s) => s.activePath);
  const files = useWorkspace((s) => s.files);

  if (!running) return null;
  const last = lastAssistant(messages);
  if (!isGenerating(last, mode)) return null;

  const path = generatingPath(last, activePath);
  const stream = streamLines(last, path, files);
  const label = path ? `Generating ${path}` : last?.status || "Generating…";

  return (
    <div
      className="generate-overlay pointer-events-none absolute inset-0 z-10 grid place-items-center px-6"
      data-testid="generate-overlay"
      aria-hidden
    >
      <div className="w-full max-w-lg">
        <div className="mb-4 flex justify-center">
          <ApertureMark className="generate-spin size-9 text-accent" />
        </div>
        <p className="text-center text-sm text-muted">
          <span className="shimmer-text">{label}</span>
        </p>
        {stream.lines.some((line) => line.trim()) && (
          <pre className="generate-stream">
            {stream.lines.map((line, i) => (
              <div key={stream.start + i} className="generate-stream-line">
                <span className="generate-gutter">{stream.start + i + 1}</span>
                <span>{line || " "}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
