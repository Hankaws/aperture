/**
 * TypeScript's standard library files on the server. They come through Vite's
 * glob, as in the browser's tsc worker, so they are inside the server bundle: a
 * deployed function has no node_modules to read them from.
 */
import type ts from "typescript";
import { loadLibFiles } from "./tsc-core";

const LIB_PREFIX = "/node_modules/typescript/lib/";
const libLoaders = import.meta.glob("/node_modules/typescript/lib/lib.*.d.ts", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

/** Each file loads once per process, whoever asks. */
export const serverLibTexts = new Map<string, string>();

export const loadServerLib = (name: string) => libLoaders[`${LIB_PREFIX}${name}`];

/** The library files `options` need. */
export function serverLibs(
  tsc: typeof ts,
  options: ts.CompilerOptions,
): Promise<Map<string, string>> {
  return loadLibFiles(tsc, options, serverLibTexts, loadServerLib);
}
