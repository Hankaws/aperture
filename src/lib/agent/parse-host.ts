/**
 * TypeScript's parser as the agent's tools want it (`ToolContext.loadParse`):
 * the second opinion that overrules a parse error the fast parser (Lezer) gets
 * wrong, so a valid edit is not held back by a false "parse error" note.
 *
 * - In the process (the server, the bot): the parser itself, loaded once.
 * - Elsewhere (a model on this machine: the tab's compiler worker): asked
 *   about the text an edit stages, and the answer kept, since a `ParseCheck`
 *   must answer at once. Text it was not asked about gets no opinion (null),
 *   which leaves Lezer's answer as it was.
 */
import type { ParseCheck } from "../workspace/ts-parse.ts";

export type ParseLoader = (path: string, text: string) => Promise<ParseCheck | undefined>;

/** Texts whose verdicts are kept for one run; past it the oldest go. */
const KEPT_VERDICTS = 40;

export function parseLoader(host: {
  parser?: () => Promise<ParseCheck>;
  parseAsync?: (path: string, text: string) => Promise<string[] | null>;
}): ParseLoader | undefined {
  if (host.parser) {
    const load = host.parser;
    let loading: Promise<ParseCheck | undefined> | undefined;
    return () => (loading ??= load().catch(() => undefined));
  }
  if (host.parseAsync) {
    const ask = host.parseAsync;
    const verdicts = new Map<string, string[] | null>();
    const key = (path: string, text: string) => `${path}\u0000${text}`;
    const check: ParseCheck = (path, text) => verdicts.get(key(path, text)) ?? null;
    return async (path, text) => {
      const k = key(path, text);
      if (!verdicts.has(k)) {
        const verdict = await ask(path, text).catch(() => null);
        verdicts.set(k, verdict);
        if (verdicts.size > KEPT_VERDICTS) verdicts.delete(verdicts.keys().next().value!);
      }
      return check;
    };
  }
  return undefined;
}
