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

export function AgentsStory() {
  return (
    <section id="agents" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-5 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 className="max-w-md text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
            Your agent can ask too.
          </h2>
          <p className="mt-5 max-w-sm text-lg text-muted">
            Claude Code, Cursor or Grok Bot gets the same checks before it changes a file.
          </p>
          <Link to="/agents" className="mt-8 inline-block text-lg text-fg">
            Connect an agent →
          </Link>
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
            Aperture Agent Check runs them in GitHub Actions, on your runner. A red check marks the
            line.
          </p>
          <Link to="/agent-check" className="mt-8 inline-block text-lg text-fg">
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
