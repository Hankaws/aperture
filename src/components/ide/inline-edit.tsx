import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { submitAgent } from "@/lib/agent/run";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAccount } from "@/lib/billing/use-account";
import { quoteRun } from "@/lib/billing/cost";
import { cn } from "@/lib/utils";

export function InlineEdit() {
  const open = useIdeUi((s) => s.inlineOpen);
  const setInlineOpen = useIdeUi((s) => s.setInlineOpen);
  const selection = useWorkspace((s) => s.selection);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const { user, isPending } = useCurrentUserState();
  const { account } = useAccount();
  const [draft, setDraft] = useState("");
  const quote = quoteRun(account);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[18vh] md:justify-end md:pr-[min(28vw,420px)] md:pt-24">
      <button
        type="button"
        aria-label="Close inline edit"
        className="absolute inset-0 bg-bg/50"
        onClick={() => setInlineOpen(false)}
      />
      <form
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-float)]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim() || !user) return;
          setInlineOpen(false);
          const instruction = draft;
          setDraft("");
          await submitAgent(instruction, "inline", account?.modelSource ?? "hosted");
        }}
      >
        <div className="mb-2 flex items-center gap-2 px-1">
          <Sparkles className="size-3.5 text-accent" />
          <p className="text-[13px] font-medium">Inline edit</p>
          <span className="truncate text-[11px] text-subtle">
            {selection ? `${selection.path}:${selection.fromLine}` : "current line"}
          </span>
        </div>
        {!isPending && !user ? (
          <div className="px-1 py-2">
            <p className="text-sm text-muted">Sign in to edit with the agent.</p>
            <Link
              to="/login"
              search={{ next: "/app" }}
              className={cn(buttonVariants({ size: "sm" }), "mt-3")}
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Describe the change for the selected code"
              className="min-h-24"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
                if (e.key === "Escape") setInlineOpen(false);
              }}
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <p className="mr-auto truncate text-[11px] text-subtle">{quote.label}</p>
              <Button variant="ghost" size="sm" onClick={() => setInlineOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!draft.trim() || agentRunning || !user || quote.blocked}>
                Generate
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
