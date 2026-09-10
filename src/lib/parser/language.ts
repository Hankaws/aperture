import { extOf } from "@/lib/utils";
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

export function isCodeLanguage(lang: LanguageId) {
  return lang === "typescript" || lang === "javascript" || lang === "python";
}
