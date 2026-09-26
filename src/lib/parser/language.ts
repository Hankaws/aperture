import { extOf } from "../utils.ts";
import type { LanguageId } from "@/lib/workspace/types";

export function languageFromPath(path: string): LanguageId {
  const ext = extOf(path);
  if (ext === "ts" || ext === "tsx" || ext === "mts" || ext === "cts") return "typescript";
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "javascript";
  if (ext === "json") return "json";
  if (ext === "md" || ext === "mdx") return "markdown";
  if (ext === "py") return "python";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  return "text";
}

export function languageLabel(path: string): string {
  const lang = languageFromPath(path);
  if (lang === "typescript") return "TypeScript";
  if (lang === "javascript") return "JavaScript";
  if (lang === "markdown") return "Markdown";
  if (lang === "python") return "Python";
  if (lang === "html") return "HTML";
  if (lang === "css") return "CSS";
  if (lang === "json") return "JSON";
  return "";
}
