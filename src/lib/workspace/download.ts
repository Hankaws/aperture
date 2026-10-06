import { isSecretPath, safeRelPath } from "@/lib/security/redact";
import { useWorkspace } from "./store";

export function zipName(name: string): string {
  const slug = name
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "project"}.zip`;
}

export async function zipWorkspace(files: Record<string, string>): Promise<{ blob: Blob; count: number }> {
  // JSZip is only needed when someone downloads: it loads then, not with the editor.
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  let count = 0;
  for (const [path, content] of Object.entries(files)) {
    const clean = safeRelPath(path);
    if (!clean || isSecretPath(clean)) continue;
    zip.file(clean, content);
    count += 1;
  }
  if (count === 0) {
    throw new Error("Nothing to download.");
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, count };
}

export async function downloadWorkspace(name: string, files: Record<string, string>): Promise<number> {
  const { blob, count } = await zipWorkspace(files);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = zipName(name);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 4_000);
  return count;
}

export async function downloadCurrentWorkspace(): Promise<{ name: string; count: number }> {
  const { name, files } = useWorkspace.getState();
  const count = await downloadWorkspace(name, files);
  return { name, count };
}
