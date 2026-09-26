/**
 * The JavaScript/TypeScript parser, configured per file extension.
 *
 * Syntax checking, import resolution and search chunking all parse the same
 * files, and each had grown its own copy of this. One cache means a dialect is
 * configured once for the whole process.
 */
import { parser as jsParser } from "@lezer/javascript";

export type JsParser = ReturnType<typeof jsParser.configure>;

const parsers = new Map<string, JsParser>();

/** `ts` for .ts/.mts/.cts, `jsx` for .jsx, both for .tsx, neither for plain .js. */
export function dialectFor(path: string): string {
  const ts = /\.(m|c)?tsx?$/i.test(path);
  const jsx = /x$/i.test(path);
  return [ts ? "ts" : "", jsx ? "jsx" : ""].filter(Boolean).join(" ");
}

export function jsParserFor(path: string): JsParser {
  const dialect = dialectFor(path);
  let cached = parsers.get(dialect);
  if (!cached) {
    cached = jsParser.configure(dialect ? { dialect } : {});
    parsers.set(dialect, cached);
  }
  return cached;
}
