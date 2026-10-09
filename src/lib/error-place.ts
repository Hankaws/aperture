/**
 * Where an error was thrown, for the error screen: the first few stack frames
 * as `function file:line:column`, without the host. A minified message such
 * as "l is not a function" says nothing on its own; with the built file and
 * position it can be traced back to its source.
 */

const FRAME = /([^/\s()@]+\.(?:m?js|jsx|tsx?))(?:\?[^:\s)]*)?(:\d+:\d+)/;

export function errorPlace(error: unknown, max = 3): string[] {
  const stack = error instanceof Error && typeof error.stack === "string" ? error.stack : "";
  const out: string[] = [];
  for (const line of stack.split("\n")) {
    const at = FRAME.exec(line);
    if (!at) continue;
    // V8: "    at fn (https://host/assets/a.js:1:2)"; Safari and Firefox: "fn@https://host/assets/a.js:1:2".
    const fn =
      /^\s*at\s+(?:async\s+|new\s+)?([^\s(]+)\s+\(/.exec(line)?.[1] ??
      /^([^@\s]+)@/.exec(line)?.[1];
    const place = `${at[1]}${at[2]}`;
    out.push(fn ? `${fn} ${place}` : place);
    if (out.length >= max) break;
  }
  return out;
}
