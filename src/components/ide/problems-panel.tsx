import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, TriangleAlert, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useIdeUi } from "@/lib/ui-store";
import { scheduleKeyedRun } from "@/lib/use-keyed-async";
import { useWorkspace } from "@/lib/workspace/store";
import { applyQuickFix } from "@/lib/workspace/quick-fix";
import type { FixAllAction, ProjectProblem, ProjectProblems } from "@/lib/workspace/ts-service";

type Found = ProjectProblems | { unavailable: string } | null;

/** After the first answer, a change waits for typing to pause before the project is checked again. */
const RECHECK_MS = 700;

function ProblemRow({ path, problem }: { path: string; problem: ProjectProblem }) {
  const [first, ...rest] = problem.message.split("\n");
  return (
    <li>
      <button
        type="button"
        title={rest.length ? problem.message : undefined}
        onClick={() => {
          useWorkspace.getState().openFile(path);
          useIdeUi.getState().setReveal({
            path,
            line: problem.line,
            col: problem.col,
            length: problem.length,
          });
          useIdeUi.getState().setMobilePane("editor");
        }}
        className="flex w-full min-w-0 items-start gap-1.5 rounded py-0.5 pr-1 pl-3 text-left hover:bg-elevated"
      >
        {problem.severity === "error" ? (
          <CircleX className="mt-0.5 size-3 shrink-0 text-danger" aria-label="Error" />
        ) : (
          <TriangleAlert className="mt-0.5 size-3 shrink-0 text-warn" aria-label="Warning" />
        )}
        <span className="min-w-0 flex-1 text-[11px] leading-snug break-words text-muted">
          {first}
          <span className="ml-1.5 font-mono text-[10px] whitespace-nowrap text-subtle">
            {problem.code} · {problem.line}:{problem.col + 1}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * One of TypeScript's "fix all" actions for a file, such as adding every
 * missing import: written like a quick fix, with one Undo.
 */
function FixAllButton({ path, action }: { path: string; action: FixAllAction }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title={`${action.description} (${action.count} problems in this file), with one Undo`}
      onClick={async () => {
        setBusy(true);
        const basis = useWorkspace.getState().files;
        const { tsFixAll } = await import("@/lib/workspace/tsc");
        const changes = await tsFixAll(basis, path, action.fixId);
        setBusy(false);
        if ("unavailable" in changes) return toast.info(changes.unavailable);
        applyQuickFix({ description: `${action.description} in ${path}`, changes }, basis);
      }}
      className="ml-3 flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] text-accent hover:bg-elevated disabled:opacity-60"
    >
      {busy ? (
        <LoaderCircle className="size-3 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Wand2 className="size-3 shrink-0" aria-hidden />
      )}
      <span className="truncate">
        {action.description} ({action.count})
      </span>
    </button>
  );
}

function summary(found: ProjectProblems): string {
  const { errors, warnings } = found;
  if (errors === 0 && warnings === 0) return "No type errors in the project.";
  const parts = [
    errors ? `${errors} ${errors === 1 ? "error" : "errors"}` : "",
    warnings ? `${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "",
  ].filter(Boolean);
  const files = found.files.length;
  return `${parts.join(" and ")} in ${files} ${files === 1 ? "file" : "files"}.`;
}

/**
 * Every TypeScript file's errors, by file, as the "Types" check would report
 * them: the whole project, not just the open file. It checks again when the
 * files change, while it is open. A row opens the file at the problem, where
 * hovering the underline (or Ctrl/⌘+.) offers TypeScript's fixes.
 */
export function ProblemsPanel() {
  const files = useWorkspace((s) => s.files);
  const [found, setFound] = useState<Found | undefined>(undefined);
  const [checking, setChecking] = useState(true);
  const answered = useRef(false);

  useEffect(() => {
    setChecking(true);
    return scheduleKeyedRun(
      async (signal) => {
        const { tsProjectProblems } = await import("@/lib/workspace/tsc");
        const next = await tsProjectProblems(files, signal);
        if (signal.aborted) return;
        answered.current = true;
        setFound(next);
        setChecking(false);
      },
      answered.current ? RECHECK_MS : 0,
    );
  }, [files]);

  const result = found && !("unavailable" in found) ? found : null;

  return (
    <div className="ide-stack" role="region" aria-label="Problems">
      <div className="flex items-start gap-2 border-b border-border p-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[12px] text-fg">
            Problems
            {checking && (
              <LoaderCircle className="size-3 animate-spin text-subtle" aria-label="Checking" />
            )}
          </p>
          <p className="text-[11px] text-subtle" aria-live="polite">
            {found === undefined
              ? "Loading TypeScript and checking every file. The first time takes a few seconds."
              : found === null
                ? "TypeScript did not answer. Close this and open it again to retry."
                : "unavailable" in found
                  ? found.unavailable
                  : summary(found)}
            {result?.truncated
              ? ` The first ${result.files.reduce((n, f) => n + f.problems.length, 0)} are listed.`
              : ""}
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
      {result && result.files.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center text-[11px] text-subtle">
          <CircleCheck className="size-4 text-ok" aria-hidden />
          Every TypeScript file checks clean. This list updates as you edit.
        </div>
      )}
      <ul className="aperture-scroll min-h-0 overflow-y-auto p-1" aria-label="Problems by file">
        {result?.files.map(({ path, problems, fixAll }) => {
          const slash = path.lastIndexOf("/");
          return (
            <li key={path} className="mb-1">
              <p className="flex items-baseline gap-1 px-1 py-0.5">
                <span className="truncate text-[12px] text-fg">{path.slice(slash + 1)}</span>
                <span className="min-w-0 truncate text-[11px] text-subtle">
                  {path.slice(0, Math.max(0, slash))}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-elevated px-1.5 text-[10px] text-subtle">
                  {problems.length}
                </span>
              </p>
              {fixAll?.map((action) => (
                <FixAllButton key={action.fixId} path={path} action={action} />
              ))}
              <ul>
                {problems.map((problem) => (
                  <ProblemRow
                    key={`${problem.start}:${problem.code}`}
                    path={path}
                    problem={problem}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
