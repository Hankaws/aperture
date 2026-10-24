import { extOf } from "../utils.ts";
import { isSecretPath, safeRelPath } from "../security/redact.ts";

export const MAX_IMPORT_FILES = 160;
export const MAX_FILE_BYTES = 200_000;
export const MAX_TOTAL_BYTES = 2_500_000;
export const MAX_ZIP_BYTES = 8_000_000;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "vendor",
  "__pycache__",
  ".turbo",
  ".vercel",
  ".cache",
  "out",
  ".output",
  "target",
  ".pnpm-store",
  "Pods",
  ".idea",
  ".vscode",
]);

const SKIP_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "mp4",
  "webm",
  "mov",
  "mp3",
  "wav",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "pdf",
  "zip",
  "gz",
  "tgz",
  "wasm",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "lockb",
  "psd",
  "sqlite",
  "db",
  "parquet",
]);

const KEEP_HIDDEN = new Set([
  ".aperture.md",
  ".cursorrules",
  ".gitignore",
  ".env.example",
  ".editorconfig",
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
]);

const KEEP_HIDDEN_DIRS = new Set([".cursor"]);

export type ImportResult = {
  name: string;
  files: Record<string, string>;
  skipped: number;
  truncated: boolean;
};

export function skipPath(path: string): boolean {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (SKIP_DIRS.has(part)) return true;
    const last = i === parts.length - 1;
    if (part.startsWith(".")) {
      if (!last) {
        if (KEEP_HIDDEN_DIRS.has(part)) continue;
        return true;
      }
      if (part === ".DS_Store" || (part.startsWith(".env") && part !== ".env.example")) return true;
      if (KEEP_HIDDEN.has(part)) continue;
      if (!/^\.(eslint|prettier|nvmrc|tool-versions)/.test(part)) return true;
    }
  }
  return SKIP_EXT.has(extOf(path));
}

export function isProbablyBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 800);
  let weird = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!;
    if (b === 0) return true;
    if (b < 8 || (b > 13 && b < 32 && b !== 27)) weird += 1;
  }
  return n > 0 && weird / n > 0.3;
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (text.includes("\uFFFD") && bytes.length > 40) {
      const replacements = (text.match(/\uFFFD/g) ?? []).length;
      if (replacements > 8) return null;
    }
    return text.replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
}

function stripCommonRoot(paths: string[]): { cut: (path: string) => string; root: string } {
  if (paths.length === 0) return { cut: (p) => p, root: "" };
  const first = paths[0]!.split("/").filter(Boolean)[0];
  if (!first) return { cut: (p) => p, root: "" };
  const shared = paths.every((p) => p === first || p.startsWith(`${first}/`));
  if (!shared) return { cut: (p) => p, root: "" };
  return {
    root: first,
    cut: (p) => (p.startsWith(`${first}/`) ? p.slice(first.length + 1) : p === first ? "" : p),
  };
}

type Assembly = { files: Record<string, string>; skipped: number; truncated: boolean; total: number };

/**
 * The import's rules for one entry whose bytes are not read yet: false when it
 * is left out (and counted), "dup" for a path already taken, true to read it.
 */
function admit(into: Assembly, path: string | null): boolean | "dup" {
  if (!path || skipPath(path) || isSecretPath(path)) {
    into.skipped += 1;
    return false;
  }
  if (into.files[path] !== undefined) return "dup";
  if (Object.keys(into.files).length >= MAX_IMPORT_FILES) {
    into.truncated = true;
    into.skipped += 1;
    return false;
  }
  return true;
}

/** The rules that need the bytes; keeps the file when they pass. */
function take(into: Assembly, path: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    into.skipped += 1;
    return;
  }
  if (into.total + bytes.byteLength > MAX_TOTAL_BYTES) {
    into.truncated = true;
    into.skipped += 1;
    return;
  }
  if (isProbablyBinary(bytes)) {
    into.skipped += 1;
    return;
  }
  const text = decodeUtf8(bytes);
  if (text === null) {
    into.skipped += 1;
    return;
  }
  into.files[path] = text;
  into.total += bytes.byteLength;
}

function normalizeEntry(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\//, "");
}

export function assembleImport(
  entries: Array<{ path: string; bytes: Uint8Array }>,
  fallbackName = "workspace",
): ImportResult {
  const normalized = entries
    .map((e) => ({ ...e, path: normalizeEntry(e.path) }))
    .filter((e) => e.path && !e.path.endsWith("/"));
  const { cut, root } = stripCommonRoot(normalized.map((e) => e.path));
  const into: Assembly = { files: {}, skipped: 0, truncated: false, total: 0 };
  for (const entry of normalized) {
    const path = safeRelPath(cut(entry.path));
    if (admit(into, path) === true) take(into, path!, entry.bytes);
  }
  const name = fallbackName || root || "workspace";
  return { name, files: into.files, skipped: into.skipped, truncated: into.truncated };
}

/** Past this many bytes read from an archive, the rest is left out: the import keeps 2.5 MB at most. */
const MAX_ZIP_READ_BYTES = 4 * MAX_TOTAL_BYTES;

/** The size an entry's header records, before anything is unpacked. JSZip keeps it on a private field. */
function recordedSize(file: unknown): number | undefined {
  const size = (file as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}

/** An entry's bytes, or null once it passes `cap`: a header can understate what it holds. */
function readEntry(file: import("jszip").JSZipObject, cap: number): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let used = 0;
    let done = false;
    const stream = (
      file as unknown as {
        internalStream(type: "uint8array"): {
          on(event: "data", cb: (chunk: Uint8Array) => void): unknown;
          on(event: "end" | "error", cb: () => void): unknown;
          resume(): void;
          pause(): void;
        };
      }
    ).internalStream("uint8array");
    stream.on("data", (chunk) => {
      if (done) return;
      used += chunk.byteLength;
      if (used > cap) {
        done = true;
        stream.pause();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", () => {
      if (done) return;
      done = true;
      const out = new Uint8Array(used);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(out);
    });
    stream.on("error", () => {
      if (done) return;
      done = true;
      resolve(null);
    });
    stream.resume();
  });
}

/**
 * A zip's files, by the same rules as a folder. Each entry is judged by its
 * name and recorded size first, and only one the import could keep is
 * unpacked, with a cap: an 8 MB archive can hold gigabytes of what is thrown away.
 */
export async function filesFromZipBuffer(buf: ArrayBuffer, fallbackName = "workspace"): Promise<ImportResult> {
  if (buf.byteLength > MAX_ZIP_BYTES) {
    return { name: fallbackName, files: {}, skipped: 0, truncated: true };
  }
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((name) => {
    const file = zip.files[name];
    return file && !file.dir && normalizeEntry(name) && !normalizeEntry(name).endsWith("/");
  });
  const { cut, root } = stripCommonRoot(names.map(normalizeEntry));
  const into: Assembly = { files: {}, skipped: 0, truncated: false, total: 0 };
  let read = 0;
  for (const name of names) {
    const file = zip.files[name]!;
    const path = safeRelPath(cut(normalizeEntry(name)));
    if (admit(into, path) !== true) continue;
    const size = recordedSize(file);
    if (size !== undefined && size > MAX_FILE_BYTES) {
      into.skipped += 1;
      continue;
    }
    if (read > MAX_ZIP_READ_BYTES || (size !== undefined && into.total + size > MAX_TOTAL_BYTES)) {
      into.truncated = true;
      into.skipped += 1;
      continue;
    }
    const bytes = await readEntry(file, MAX_FILE_BYTES);
    if (!bytes) {
      into.skipped += 1;
      continue;
    }
    read += bytes.byteLength;
    take(into, path!, bytes);
  }
  const name = fallbackName || root || "workspace";
  return { name, files: into.files, skipped: into.skipped, truncated: into.truncated };
}
