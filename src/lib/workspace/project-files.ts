import { extOf } from "@/lib/utils";
import { isSecretPath, safeRelPath } from "@/lib/security/redact";

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

export function assembleImport(
  entries: Array<{ path: string; bytes: Uint8Array }>,
  fallbackName = "workspace",
): ImportResult {
  const normalized = entries
    .map((e) => ({ ...e, path: e.path.replace(/\\/g, "/").replace(/^\//, "") }))
    .filter((e) => e.path && !e.path.endsWith("/"));
  const { cut, root } = stripCommonRoot(normalized.map((e) => e.path));
  const files: Record<string, string> = {};
  let skipped = 0;
  let truncated = false;
  let total = 0;

  for (const entry of normalized) {
    const path = safeRelPath(cut(entry.path));
    if (!path) {
      skipped += 1;
      continue;
    }
    if (skipPath(path) || isSecretPath(path)) {
      skipped += 1;
      continue;
    }
    if (files[path]) continue;
    if (Object.keys(files).length >= MAX_IMPORT_FILES) {
      truncated = true;
      skipped += 1;
      continue;
    }
    if (entry.bytes.byteLength > MAX_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    if (total + entry.bytes.byteLength > MAX_TOTAL_BYTES) {
      truncated = true;
      skipped += 1;
      continue;
    }
    if (isProbablyBinary(entry.bytes)) {
      skipped += 1;
      continue;
    }
    const text = decodeUtf8(entry.bytes);
    if (text === null) {
      skipped += 1;
      continue;
    }
    files[path] = text;
    total += entry.bytes.byteLength;
  }

  const name = fallbackName || root || "workspace";
  return { name, files, skipped, truncated };
}

export async function filesFromZipBuffer(buf: ArrayBuffer, fallbackName = "workspace"): Promise<ImportResult> {
  if (buf.byteLength > MAX_ZIP_BYTES) {
    return { name: fallbackName, files: {}, skipped: 0, truncated: true };
  }
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const packed: Array<{ path: string; bytes: Uint8Array }> = [];
  const names = Object.keys(zip.files);
  for (const relativePath of names) {
    const file = zip.files[relativePath];
    if (!file || file.dir) continue;
    const bytes = await file.async("uint8array");
    packed.push({ path: relativePath, bytes });
  }
  return assembleImport(packed, fallbackName);
}
