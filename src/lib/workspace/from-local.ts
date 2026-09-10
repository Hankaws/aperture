import { assembleImport, filesFromZipBuffer, type ImportResult } from "./project-files";

function relativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (rel && rel.length > 0) return rel.replace(/\\/g, "/");
  return file.name;
}

async function walkEntry(entry: FileSystemEntry, acc: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    const path = entry.fullPath.replace(/^\//, "");
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    acc.push(file);
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const batch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  let chunk = await batch();
  while (chunk.length > 0) {
    for (const child of chunk) await walkEntry(child, acc);
    chunk = await batch();
  }
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const acc: File[] = [];
  const items = dt.items;
  if (items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === "function") {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i]!.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    if (entries.length > 0) {
      for (const entry of entries) await walkEntry(entry, acc);
      if (acc.length > 0) return acc;
    }
  }
  return Array.from(dt.files);
}

export async function importLocalFiles(list: File[], fallbackName?: string): Promise<ImportResult> {
  if (list.length === 1 && list[0]!.name.toLowerCase().endsWith(".zip")) {
    const buf = await list[0]!.arrayBuffer();
    const name = fallbackName || list[0]!.name.replace(/\.zip$/i, "");
    return filesFromZipBuffer(buf, name);
  }

  const entries: Array<{ path: string; bytes: Uint8Array }> = [];
  let root = fallbackName ?? "";
  for (const file of list) {
    const path = relativePath(file);
    if (!root) {
      const first = path.split("/")[0];
      if (first && path.includes("/")) root = first;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    entries.push({ path, bytes: buf });
  }
  return assembleImport(entries, root || fallbackName || "workspace");
}
