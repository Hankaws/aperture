import { toast } from "sonner";
import { Bug, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitAgent } from "@/lib/agent/run";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAccount } from "@/lib/billing/use-account";
import { quoteRun } from "@/lib/billing/cost";
import { useIdeUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { hasCodeRange } from "@/lib/workspace/edits";
import { useWorkspace } from "@/lib/workspace/store";

function explainPrompt(path: string, fromLine: number, toLine: number) {
  return `Explain the selected code in ${path} (L${fromLine}–${toLine}). First say what it is and how it works. Then 2–4 key insights. Do not edit.`;
}

function useAssistActions() {
  const selection = useWorkspace((s) => s.selection);
  const activePath = useWorkspace((s) => s.activePath);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const { user } = useCurrentUserState();
  const { account, refresh } = useAccount();
  const quote = quoteRun(account, account?.modelSource ?? "hosted");
  const ranged = hasCodeRange(selection);

  async function run(kind: "explain" | "fix" | "bugs") {
    if (agentRunning) return;
    if ((kind === "explain" || kind === "fix") && !ranged) {
      toast.message("No code selected", {
        description: "Select some code in the editor to explain or fix it.",
      });
      return;
    }
    if (!user) {
      toast.error("Sign in to run Composer.");
      return;
    }
    if (quote.blocked) {
      toast.error(quote.blockReason ?? "This run is blocked.");
      return;
    }
    useIdeUi.getState().setChatOpen(true);
    useIdeUi.getState().setMobilePane("agent");
    const source = account?.modelSource ?? "hosted";
    if (kind === "explain" && selection) {
      await submitAgent(explainPrompt(selection.path, selection.fromLine, selection.toLine), "chat", source);
    } else if (kind === "fix") {
      await submitAgent("Fix the selected code. Keep the change as small as possible.", "composer", source, {
        phase: "skip",
      });
    } else {
      const target = activePath ? ` in @${activePath}` : "";
      await submitAgent(`Find bugs${target}. Cite path:line. Do not edit unless I ask.`, "chat", source);
    }
    void refresh();
  }

  return { run, ranged, agentRunning, selection };
}

export function SelectionActions() {
  const { run, ranged, agentRunning, selection } = useAssistActions();
  if (!ranged || agentRunning || !selection) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface/95 px-2 py-1.5 shadow-[var(--shadow-float)]">
        <p className="hidden max-w-40 truncate px-1.5 font-mono text-[11px] text-subtle sm:block">
          {selection.path}:{selection.fromLine}
          {selection.toLine !== selection.fromLine ? `–${selection.toLine}` : ""}
        </p>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void run("explain")}>
          <Sparkles className="size-3.5" />
          Explain
        </Button>
        <Button size="sm" className="h-7 px-2.5" onClick={() => void run("fix")}>
          <Wand2 className="size-3.5" />
          Fix this
        </Button>
      </div>
    </div>
  );
}

export function AssistChips({ className }: { className?: string }) {
  const { run, ranged, agentRunning } = useAssistActions();
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <button type="button" className="assist-chip" disabled={agentRunning} onClick={() => void run("explain")}>
        <Sparkles className="size-3.5" />
        Explain this
        {!ranged && <span className="text-subtle"> · select</span>}
      </button>
      <button type="button" className="assist-chip" disabled={agentRunning} onClick={() => void run("fix")}>
        <Wand2 className="size-3.5" />
        Fix this
      </button>
      <button type="button" className="assist-chip" disabled={agentRunning} onClick={() => void run("bugs")}>
        <Bug className="size-3.5" />
        Find bugs
      </button>
    </div>
  );
}
