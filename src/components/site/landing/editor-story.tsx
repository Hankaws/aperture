import { Link } from "@tanstack/react-router";
import { EDITOR_FEATURES, LANDING_KEYS } from "../editor-features";
import { Frame } from "./story";

const ROWS = LANDING_KEYS.map((key) => EDITOR_FEATURES.find((f) => f.key === key)!);

/** The editor's TypeScript help, in brief: a call with its parameter hint, and the keys for the rest. */
export function EditorStory() {
  return (
    <section id="editor" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-5 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 className="max-w-md text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
            The editor knows your code.
          </h2>
          <p className="mt-5 max-w-sm text-lg text-muted">
            The TypeScript compiler runs in your tab. Nothing to install.
          </p>
          <Link to="/editor" className="mt-6 inline-block text-fg">
            Tour the editor →
          </Link>
        </div>
        <Frame title="store.ts">
          <div className="font-mono text-sm">
            <div className="w-fit max-w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-muted shadow-[var(--shadow-float)] [overflow-wrap:anywhere]">
              listTasks(page: number,{" "}
              <span className="font-semibold whitespace-nowrap text-fg underline underline-offset-4">
                pageSize: number
              </span>
              ): Task[]
            </div>
            <p className="mt-3 truncate text-muted">
              <span className="text-fg">const</span> page = listTasks(0,
              <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-fg" />)
            </p>
          </div>
          <ul className="mt-6 divide-y divide-border border-t border-border">
            {ROWS.map((row) => (
              <li key={row.key} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-fg">{row.title}</span>
                <kbd className="shrink-0 rounded-md border border-border bg-bg px-2 py-0.5 font-mono text-xs text-muted">
                  {row.key}
                </kbd>
              </li>
            ))}
          </ul>
        </Frame>
      </div>
    </section>
  );
}
