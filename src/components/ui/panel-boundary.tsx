import { Component, type ReactNode } from "react";
import { errorPlace } from "@/lib/error-place";
import { cn } from "@/lib/utils";

type Props = {
  /** What stopped, as the person sees it: "The chat", "Files". */
  name: string;
  children: ReactNode;
  className?: string;
  /** A second way out, for a panel whose own saved state can break it. */
  reset?: { label: string; run: () => void };
};
type State = { failed: boolean; error: unknown };

/**
 * One panel can fail without taking the page down with it: it shows what
 * went wrong and where, and can be tried again. Errors in event handlers and
 * promises are not caught here; those panels report them themselves.
 */
export class PanelBoundary extends Component<Props, State> {
  state: State = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { error } = this.state;
    const message = error instanceof Error && error.message ? error.message : "This panel stopped.";
    const place = errorPlace(error);
    const retry = () => this.setState({ failed: false, error: null });
    const button = "rounded-md border border-border px-2.5 py-1 text-xs text-fg hover:bg-elevated";
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-4 py-6 text-center",
          this.props.className,
        )}
      >
        <p className="text-sm text-fg">{this.props.name} hit a problem</p>
        <p className="max-w-xs text-xs break-words text-muted">{message}</p>
        {place.length > 0 && (
          <ul
            className="max-w-xs font-mono text-[11px] break-all text-subtle"
            aria-label="Where it happened"
          >
            {place.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <button type="button" className={button} onClick={retry}>
            Try again
          </button>
          {this.props.reset && (
            <button
              type="button"
              className={button}
              onClick={() => {
                this.props.reset!.run();
                retry();
              }}
            >
              {this.props.reset.label}
            </button>
          )}
        </div>
      </div>
    );
  }
}
