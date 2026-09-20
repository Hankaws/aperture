export function fileListOf(files: Record<string, string>): string[] {
  return Object.keys(files).sort();
}

export function keepFileList(prev: string[], files: Record<string, string>): string[] {
  const next = fileListOf(files);
  if (prev.length === next.length && prev.every((path, i) => path === next[i])) return prev;
  return next;
}

export function withFiles(files: Record<string, string>, prev: string[]) {
  return { files, fileList: keepFileList(prev, files) };
}
