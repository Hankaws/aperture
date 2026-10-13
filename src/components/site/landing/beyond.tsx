import { Link } from "@tanstack/react-router";
import { EXAMPLE } from "@/lib/mcp-server/example";
import { ACTION_USES, RUN_EXAMPLE } from "../../../../packages/agent-check/src/run-example.ts";
import { Frame } from "./story";

const TONE: Record<string, string> = { "✓": "text-ok", "✗": "text-danger", "–": "text-subtle" };
const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };

/** The rows of a real check_change answer, the one /agents shows and a test keeps word for word. */
const ANSWER = EXAMPLE.answer
  .split("\n")
  .filter((line) => /^[✓✗–] /.test(line))
  .map((line) => ({ mark: line[0]!, text: line.slice(2) }));

function Row({ mark, text }: { mark: string; text: string }) {
  return (
    <li className="flex gap-3 py-2.5 text-sm [overflow-wrap:anywhere]">
      <span className={TONE[mark] ?? "text-subtle"}>{mark}</span>
      <span className={mark === "✗" ? "text-fg" : "text-muted"}>{text}</span>
    </li>
  );
}

function AgentMark() {
  return (
    <div className="agent-mark pointer-events-none absolute -top-4 -right-1 size-32 sm:-top-6 sm:-right-6 sm:size-64" aria-hidden>
      <svg viewBox="0 0 32 32" className="size-full text-fg drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)]">
        <defs>
          <mask id="agent-aperture">
            <rect width="32" height="32" fill="white" />
            <g className="agent-eyes">
              <rect className="agent-eye" x="11.2" y="8" width="2.5" height="5.4" rx="1.25" fill="black" />
              <rect className="agent-eye agent-eye-r" x="18.3" y="8" width="2.5" height="5.4" rx="1.25" fill="black" />
            </g>
            <polygon className="agent-iris" fill="black" points="16,15.6 19.4,17.5 19.4,21.2 16,23.1 12.6,21.2 12.6,17.5" />
          </mask>
        </defs>
        <polygon fill="currentColor" mask="url(#agent-aperture)" points="16,4 26.39,10 26.39,22 16,28 5.61,22 5.61,10" />
      </svg>
    </div>
  );
}

export function AgentsStory() {
  return (
    <section id="agents" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-5 sm:py-28 lg:grid-cols-2">
        <div className="relative">
          <div className="rounded-[28px] border border-border bg-surface px-6 py-8 pr-28 sm:min-h-72 sm:px-8 sm:py-10 sm:pr-44">
            <h2 className="max-w-[12rem] text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance sm:max-w-[14rem]">
              Your agent can ask too.
            </h2>
            <p className="mt-4 max-w-[13rem] text-sm leading-relaxed text-muted sm:max-w-[15rem] sm:text-base">
              Claude Code, Cursor or Grok Bot gets the same checks before it changes a file.
            </p>
            <Link to="/bot" search={{ tab: "agents" }} className="mt-6 inline-block text-sm text-fg sm:text-base">
              Connect an agent →
            </Link>
          </div>
          <AgentMark />
        </div>
        <Frame title="check_change">
          <ul className="divide-y divide-border">
            {ANSWER.map((row) => (
              <Row key={row.text} {...row} />
            ))}
          </ul>
        </Frame>
      </div>
    </section>
  );
}

export function AgentCheckStory() {
  return (
    <section id="agent-check" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-5 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 className="max-w-md text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
            Every pull request, checked.
          </h2>
          <p className="mt-5 max-w-sm text-lg text-muted">
            Aperture Agent Check runs them in GitHub Actions, on your runner, on its own or through
            Aperture Bot. A red check marks the line.
          </p>
          <Link to="/bot" search={{ tab: "check" }} className="mt-8 inline-block text-lg text-fg">
            Add it to a repository →
          </Link>
        </div>
        <Frame title=".github/workflows">
          <p className="font-mono text-xs text-muted [overflow-wrap:anywhere]">
            - uses: {ACTION_USES}
          </p>
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {RUN_EXAMPLE.rows.map((row) => (
              <Row
                key={row.label}
                mark={MARK[row.status] ?? "–"}
                text={`${row.label}: ${row.detail}`}
              />
            ))}
          </ul>
        </Frame>
      </div>
    </section>
  );
}
