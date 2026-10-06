import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import { useTyped } from "./typed";

type SnipLine = {
  mark?: "+" | "-" | " ";
  text: string;
};

type Snippet = {
  id: string;
  file: string;
  tab: string;
  caption: string;
  mode: "lines" | "type";
  lines: SnipLine[];
};

const SNIPPETS: Snippet[] = [
  {
    id: "diff",
    file: "src/store.ts",
    tab: "Diff",
    caption: "The edit, as a search-replace you can read.",
    mode: "lines",
    lines: [
      { mark: " ", text: "export function listTasks() {" },
      { mark: " ", text: "  const start = page * pageSize;" },
      { mark: "+", text: "  return tasks.slice(start, start + pageSize);" },
      { mark: " ", text: "}" },
      { mark: " ", text: "" },
      { mark: " ", text: "export function getTask(id: ID) {" },
      { mark: " ", text: "  const task = byId.get(id);" },
      { mark: "-", text: "  return task;" },
      { mark: "+", text: "  if (!task) throw new NotFound(id);" },
      { mark: "+", text: "  return task;" },
      { mark: " ", text: "}" },
    ],
  },
  {
    id: "plan",
    file: "plan.json",
    tab: "Plan",
    caption: "A checklist before the first write. Nothing is staged yet.",
    mode: "type",
    lines: [
      { text: "[" },
      { text: '  { "id": "01", "content": "Read store.ts", "status": "completed" },' },
      { text: '  { "id": "02", "content": "Patch listTasks slice", "status": "in_progress" },' },
      { text: '  { "id": "03", "content": "Guard getTask", "status": "pending" }' },
      { text: "]" },
    ],
  },
  {
    id: "apply",
    file: "composer.ts",
    tab: "Apply",
    caption: "You apply. Undo this run restores the files from before the send.",
    mode: "type",
    lines: [
      { text: "await applyEdit({" },
      { text: '  path: "src/store.ts",' },
      { text: '  search: "return task;",' },
      { text: '  replace: "if (!task) throw new NotFound(id);\\n  return task;",' },
      { text: "});" },
    ],
  },
];

function tint(text: string) {
  const parts = text.split(/(\bexport\b|\bfunction\b|\breturn\b|\bconst\b|\bif\b|\bthrow\b|\bnew\b|\bawait\b|"[^"]*"|'[^']*')/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^(export|function|return|const|if|throw|new|await)$/.test(part)) {
      return (
        <span key={i} className="text-accent">
          {part}
        </span>
      );
    }
    if (part.startsWith('"') || part.startsWith("'")) {
      return (
        <span key={i} className="text-ok">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function LineRow({ line, n, on }: { line: SnipLine; n: number; on: boolean }) {
  const mark = line.mark ?? " ";
  return (
    <div
      className={cn(
        "demo-line flex gap-3 px-4 font-mono text-xs leading-6",
        on && "is-on",
        mark === "+" && "bg-ok/10 text-ok",
        mark === "-" && "bg-danger/10 text-danger",
        mark === " " && "text-muted",
      )}
      style={{ animationDelay: `${n * 55}ms` }}
    >
      <span className="w-3 shrink-0 select-none text-subtle">{mark === " " ? "\u00A0" : mark}</span>
      <span className="min-w-0 whitespace-pre">{tint(line.text) || "\u00A0"}</span>
    </div>
  );
}

function TypedBlock({ source, active, reduced }: { source: string; active: boolean; reduced: boolean }) {
  const typed = useTyped(source, active, reduced, 12);
  return (
    <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-6 text-muted whitespace-pre">
      {tint(typed.text)}
      {active && !typed.done ? <span className="caret-blink" /> : null}
    </pre>
  );
}

export function SnippetShowcase() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setInterval(() => setActive((n) => (n + 1) % SNIPPETS.length), 5200);
    return () => window.clearInterval(id);
  }, [reduced, paused]);

  const snippet = SNIPPETS[active]!;
  const source = snippet.lines.map((l) => l.text).join("\n");

  return (
    <div
      // grid-cols-1 is minmax(0, 1fr): without it the column sizes to the longest
      // code line, and the section scrolls the whole page sideways on a phone.
      className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[14rem_1fr]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex gap-2 lg:flex-col">
        {SNIPPETS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              // Three to a row on a phone: each takes a third and cuts a long file name, so none sticks out.
              "min-w-0 flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200 lg:flex-none",
              i === active ? "border-accent/40 bg-elevated text-fg" : "border-border text-muted hover:text-fg",
            )}
          >
            <span className="font-mono text-xs text-subtle">{item.tab}</span>
            <span className="mt-0.5 block truncate font-medium tracking-tight">{item.file}</span>
          </button>
        ))}
      </div>
      <div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]">
          <div className="flex h-10 items-center gap-2 border-b border-border px-3">
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <span className="ml-2 font-mono text-xs text-subtle">{snippet.file}</span>
            <span className="ml-auto hidden font-mono text-xs text-ok sm:inline">
              {snippet.mode === "lines" ? "staged" : "streaming"}
            </span>
          </div>
          <div key={snippet.id} className="min-h-56 py-2">
            {snippet.mode === "type" ? (
              <TypedBlock key={snippet.id} source={source} active reduced={reduced} />
            ) : (
              snippet.lines.map((line, i) => <LineRow key={`${snippet.id}-${i}`} line={line} n={i} on />)
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{snippet.caption}</p>
      </div>
    </div>
  );
}
