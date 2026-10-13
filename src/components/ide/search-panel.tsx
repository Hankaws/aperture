import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CaseSensitive,
  ChevronRight,
  Regex,
  Replace,
  ReplaceAll,
  WholeWord,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { pendingPathKey } from "@/lib/workspace/edits";
import {
  replaceInFiles,
  searchFiles,
  type FileHits,
  type Hit,
  type SearchOptions,
} from "@/lib/workspace/search";

function Toggle({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded",
        on ? "bg-accent/15 text-accent" : "text-subtle hover:bg-elevated hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function HitRow({ hit, onOpen }: { hit: Hit; onOpen: () => void }) {
  const before = hit.text.slice(0, hit.start);
  const match = hit.text.slice(hit.start, hit.start + hit.length);
  const after = hit.text.slice(hit.start + hit.length);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-w-0 items-baseline gap-2 rounded py-0.5 pr-1 pl-6 text-left hover:bg-elevated"
      >
        <span className="w-7 shrink-0 text-right font-mono text-[10px] text-subtle">
          {hit.line}
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted">
          {before.trimStart()}
          <mark className="rounded-sm bg-accent/25 px-px text-fg">{match}</mark>
          {after}
        </span>
      </button>
    </li>
  );
}

/**
 * Find, and replace, across the workspace's files: the sidebar's Search view
 * (Ctrl/⌘+Shift+F). A replace writes the files like a hand edit, after a
 * checkpoint, so one Undo puts them all back. Files with a staged change are
 * left alone, since the change was made against their current text.
 */
export function SearchPanel() {
  const files = useWorkspace((s) => s.files);
  const pendingKey = useWorkspace((s) => pendingPathKey(s.messages, s.activeCopyId));
  const pending = useMemo(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);
  const focusTick = useIdeUi((s) => s.searchFocusTick);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const input = useRef<HTMLInputElement>(null);
  // Typing stays quick in a big project, in the box or in the code: the search catches up a moment later.
  const searched = useDeferredValue(query);
  const scanned = useDeferredValue(files);
  const result = useMemo(
    () => searchFiles(scanned, searched, options),
    [scanned, searched, options],
  );

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focusTick]);

  const flip = (key: keyof SearchOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  function open(path: string, hit: Hit) {
    useWorkspace.getState().openFile(path);
    useIdeUi.getState().setReveal({ path, line: hit.line, col: hit.col, length: hit.length });
    useIdeUi.getState().setMobilePane("editor");
  }

  function replaceIn(targets: FileHits[]) {
    const ws = useWorkspace.getState();
    const skipped = targets.filter((f) => pending.has(f.path)).length;
    const paths = targets.filter((f) => !pending.has(f.path)).map((f) => f.path);
    const changed = replaceInFiles(ws.files, paths, query, replacement, options);
    const changedPaths = Object.keys(changed);
    const note = skipped
      ? ` Left ${skipped} ${skipped === 1 ? "file" : "files"} with a staged change alone.`
      : "";
    if (changedPaths.length === 0) {
      toast.info(`Nothing to replace.${note}`);
      return;
    }
    const count = targets
      .filter((f) => changed[f.path] !== undefined)
      .reduce((n, f) => n + f.hits.length, 0);
    const id = ws.checkpointFiles(changedPaths, `Replace "${query}"`);
    for (const path of changedPaths) ws.writeFile(path, changed[path]!);
    const files = changedPaths.length === 1 ? "1 file" : `${changedPaths.length} files`;
    toast.success(`Replaced ${count} ${count === 1 ? "match" : "matches"} in ${files}.${note}`, {
      action: { label: "Undo", onClick: () => useWorkspace.getState().undoCheckpoint(id) },
    });
  }

  const fileCount = result.files.length;
  const summary = result.error
    ? result.error
    : !searched
      ? "Search every file in the workspace."
      : result.total === 0
        ? "No results."
        : `${result.total}${result.truncated ? "+" : ""} ${result.total === 1 ? "result" : "results"} in ${fileCount} ${fileCount === 1 ? "file" : "files"}${result.truncated ? ". Showing the first ones: narrow the search." : ""}`;

  return (
    <div className="ide-stack" role="search" aria-label="Search in files">
      <div className="space-y-1.5 border-b border-border p-1.5">
        <div className="flex items-start gap-1">
          <button
            type="button"
            aria-label={showReplace ? "Hide replace" : "Show replace"}
            aria-expanded={showReplace}
            title="Replace"
            onClick={() => setShowReplace((v) => !v)}
            className="mt-1 flex size-6 shrink-0 items-center justify-center rounded text-subtle hover:bg-elevated hover:text-fg"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", showReplace && "rotate-90")}
            />
          </button>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center rounded-md border border-border bg-elevated pr-0.5 focus-within:ring-2 focus-within:ring-accent/40">
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !query) useIdeUi.getState().setSidebarView("files");
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder="Search"
                aria-label="Search in files"
                spellCheck={false}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 text-[12px] text-fg placeholder:text-subtle focus:outline-none"
              />
              <Toggle
                on={options.caseSensitive}
                label="Match case"
                onClick={() => flip("caseSensitive")}
              >
                <CaseSensitive className="size-4" />
              </Toggle>
              <Toggle on={options.wholeWord} label="Whole word" onClick={() => flip("wholeWord")}>
                <WholeWord className="size-4" />
              </Toggle>
              <Toggle on={options.regex} label="Regular expression" onClick={() => flip("regex")}>
                <Regex className="size-4" />
              </Toggle>
            </div>
            {showReplace && (
              <div className="flex items-center gap-1">
                <input
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && result.total > 0) replaceIn(result.files);
                  }}
                  placeholder="Replace"
                  aria-label="Replace with"
                  spellCheck={false}
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-elevated px-2 text-[12px] text-fg placeholder:text-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
                <button
                  type="button"
                  aria-label="Replace all"
                  title={result.truncated ? "Replace all in the files shown" : "Replace all"}
                  disabled={result.total === 0}
                  onClick={() => replaceIn(result.files)}
                  className="flex size-7 shrink-0 items-center justify-center rounded text-subtle hover:bg-elevated hover:text-fg disabled:opacity-40"
                >
                  <ReplaceAll className="size-4" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Back to files"
            title="Back to files"
            onClick={() => useIdeUi.getState().setSidebarView("files")}
            className="mt-1 flex size-6 shrink-0 items-center justify-center rounded text-subtle hover:bg-elevated hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p
          className={cn("px-1 text-[11px]", result.error ? "text-danger" : "text-subtle")}
          aria-live="polite"
        >
          {summary}
        </p>
      </div>
      <ul className="aperture-scroll min-h-0 overflow-y-auto p-1" aria-label="Search results">
        {result.files.map((file) => {
          const isOpen = !closed.has(file.path);
          const slash = file.path.lastIndexOf("/");
          return (
            <li key={file.path} className="group/file">
              <div className="flex items-center rounded hover:bg-elevated">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setClosed((c) => {
                      const next = new Set(c);
                      if (next.has(file.path)) next.delete(file.path);
                      else next.add(file.path);
                      return next;
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-subtle transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                  <span className="truncate text-[12px] text-fg">{file.path.slice(slash + 1)}</span>
                  <span className="min-w-0 truncate text-[11px] text-subtle">
                    {file.path.slice(0, Math.max(0, slash))}
                  </span>
                  {pending.has(file.path) && (
                    <span
                      className="shrink-0 text-[10px] text-warn"
                      title="Has a staged change: replace leaves it alone"
                    >
                      staged
                    </span>
                  )}
                </button>
                {showReplace && !pending.has(file.path) && (
                  <button
                    type="button"
                    aria-label={`Replace in ${file.path}`}
                    title="Replace in this file"
                    onClick={() => replaceIn([file])}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-subtle opacity-0 group-hover/file:opacity-100 hover:text-fg focus-visible:opacity-100"
                  >
                    <Replace className="size-3.5" />
                  </button>
                )}
                <span className="shrink-0 rounded-full bg-elevated px-1.5 text-[10px] text-subtle">
                  {file.hits.length}
                </span>
              </div>
              {isOpen && (
                <ul>
                  {file.hits.map((hit) => (
                    <HitRow
                      key={`${hit.line}:${hit.col}`}
                      hit={hit}
                      onOpen={() => open(file.path, hit)}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
