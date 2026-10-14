import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A file to paste somewhere else, such as a workflow: its path, its text, and
 * a Copy button. Copying from a code block by hand is fiddly, and on a phone
 * it is worse.
 */
export function CopyBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure page, or permission refused): the text is still there to select.
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-muted">{title}</p>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? `Copied ${title}` : `Copy ${title}`}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted hover:bg-elevated hover:text-fg"
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {children}
      </pre>
    </div>
  );
}
