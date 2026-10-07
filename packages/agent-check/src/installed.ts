/**
 * The installed packages, for the compiler: `/node_modules/…` in its view is
 * `<project>/node_modules/…` on disk. With them, a package's real types are
 * used instead of `any`, so Types reports what the project's own `tsc` would.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { InstalledFiles } from "../../../src/lib/workspace/tsc-core.ts";

export function installedFiles(cwd: string): InstalledFiles | undefined {
  if (!existsSync(join(cwd, "node_modules"))) return undefined;
  const onDisk = (path: string) => join(cwd, path.slice(1));
  const kind = (path: string) => {
    try {
      return statSync(onDisk(path));
    } catch {
      return null;
    }
  };
  return {
    read: (path) => {
      try {
        return readFileSync(onDisk(path), "utf8");
      } catch {
        return undefined;
      }
    },
    isFile: (path) => kind(path)?.isFile() ?? false,
    isDirectory: (path) => kind(path)?.isDirectory() ?? false,
    folders: (path) => {
      try {
        return readdirSync(onDisk(path), { withFileTypes: true })
          .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
          .map((entry) => entry.name);
      } catch {
        return [];
      }
    },
  };
}
