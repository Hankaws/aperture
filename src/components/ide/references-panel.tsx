import { useMemo } from "react";
import { X } from "lucide-react";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { Reference } from "@/lib/workspace/ts-service";

function RefRow({ name, reference }: { name: string; reference: Reference }) {
  // The line is trimmed for the list: find the name in it rather than trust the column.
  const at = reference.text.indexOf(name);
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          useWorkspace.getState().openFile(reference.path);
          useIdeUi.getState().setReveal({
            path: reference.path,
            line: reference.line,
            col: reference.col,
            length: reference.length,
          });
          useIdeUi.getState().setMobilePane("editor");
        }}
        className="flex w-full min-w-0 items-baseline gap-2 rounded py-0.5 pr-1 pl-3 text-left hover:bg-elevated"
      >
        <span className="w-7 shrink-0 text-right font-mono text-[10px] text-subtle">
          {reference.line}
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted">
          {at < 0 ? (
            reference.text
          ) : (
            <>
              {reference.text.slice(0, at)}
              <mark className="rounded-sm bg-accent/25 px-px text-fg">{name}</mark>
              {reference.text.slice(at + name.length)}
            </>
          )}
        </span>
        {reference.definition && <span className="shrink-0 text-[10px] text-subtle">declared</span>}
      </button>
    </li>
  );
}

/**
 * Shift+F12's answer in the sidebar: every place a name is declared or used,
 * from TypeScript, by file. A list of where things were when it was asked;
 * Shift+F12 again brings it up to date.
 */
export function ReferencesPanel() {
  const found = useIdeUi((s) => s.references);
  const byFile = useMemo(() => {
    const groups = new Map<string, Reference[]>();
    for (const ref of found?.references ?? [])
      groups.set(ref.path, [...(groups.get(ref.path) ?? []), ref]);
    return [...groups];
  }, [found]);
  const count = found?.references.length ?? 0;

  return (
    <div className="ide-stack" role="region" aria-label="References">
      <div className="flex items-start gap-2 border-b border-border p-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-fg">
            References · <span className="font-mono">{found?.name ?? ""}</span>
          </p>
          <p className="text-[11px] text-subtle" aria-live="polite">
            {count === 1 ? "1 place" : `${count} places`} in{" "}
            {byFile.length === 1 ? "1 file" : `${byFile.length} files`}. Shift+F12 on a name again
            to refresh.
          </p>
        </div>
        <button
          type="button"
          aria-label="Back to files"
          title="Back to files"
          onClick={() => useIdeUi.getState().setSidebarView("files")}
          className="flex size-6 shrink-0 items-center justify-center rounded text-subtle hover:bg-elevated hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="aperture-scroll min-h-0 overflow-y-auto p-1" aria-label="Reference results">
        {byFile.map(([path, refs]) => {
          const slash = path.lastIndexOf("/");
          return (
            <li key={path} className="mb-1">
              <p className="flex items-baseline gap-1 px-1 py-0.5">
                <span className="truncate text-[12px] text-fg">{path.slice(slash + 1)}</span>
                <span className="min-w-0 truncate text-[11px] text-subtle">
                  {path.slice(0, Math.max(0, slash))}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-elevated px-1.5 text-[10px] text-subtle">
                  {refs.length}
                </span>
              </p>
              <ul>
                {refs.map((ref) => (
                  <RefRow key={`${ref.path}:${ref.start}`} name={found!.name} reference={ref} />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
