import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Download, FileArchive, FileCode, FileJson, FileText, Folder, FolderOpen, Github, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, extOf } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import { pendingPathKey } from "@/lib/workspace/edits";
import { useIdeUi } from "@/lib/ui-store";
import { pickFolder, pickZip } from "@/lib/workspace/import-bridge";
import { downloadCurrentWorkspace } from "@/lib/workspace/download";
import { Button } from "@/components/ui/button";

type TreeNode = {
  name: string;
  path: string;
  children?: TreeNode[];
};

function fileIcon(path: string) {
  const ext = extOf(path);
  if (ext === "json") return FileJson;
  if (ext === "md") return FileText;
  return FileCode;
}

function buildTree(paths: string[]): TreeNode[] {
  type Mutable = { name: string; path: string; kids?: Map<string, Mutable> };
  const root = new Map<string, Mutable>();

  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let cursor = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let node = cursor.get(part);
      if (!node) {
        node = { name: part, path: acc, kids: isFile ? undefined : new Map() };
        cursor.set(part, node);
      } else if (!isFile && !node.kids) {
        node.kids = new Map();
      }
      if (!isFile) cursor = node.kids ?? (node.kids = new Map());
    });
  }

  const toArr = (map: Map<string, Mutable>): TreeNode[] => {
    const nodes: TreeNode[] = [...map.values()].map((n) => ({
      name: n.name,
      path: n.path,
      children: n.kids ? toArr(n.kids) : undefined,
    }));
    nodes.sort((a, b) => {
      const af = a.children ? 0 : 1;
      const bf = b.children ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  };

  return toArr(root);
}

function TreeItem({ node, depth, pending }: { node: TreeNode; depth: number; pending: Set<string> }) {
  const activePath = useWorkspace((s) => s.activePath);
  const openFile = useWorkspace((s) => s.openFile);
  const deleteFile = useWorkspace((s) => s.deleteFile);
  const [open, setOpen] = useState(depth < 1);
  const isFolder = Boolean(node.children);
  const active = activePath === node.path;
  const Icon = isFolder ? (open ? FolderOpen : Folder) : fileIcon(node.path);

  return (
    <div>
      <div
        className={cn(
          "group flex h-8 items-center gap-1 rounded-md pr-1 text-[13px]",
          active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/70 hover:text-fg",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => {
            if (isFolder) setOpen((v) => !v);
            else openFile(node.path);
          }}
        >
          {isFolder ? (
            <ChevronRight
              className={cn("size-3.5 shrink-0 text-subtle transition-transform duration-150", open && "rotate-90")}
            />
          ) : (
            <span className="w-3.5" />
          )}
          <Icon className="size-3.5 shrink-0" strokeWidth={1.6} />
          <span className="truncate">{node.name}</span>
          {pending.has(node.path) && (
            <span className="size-1.5 shrink-0 rounded-full bg-ok" aria-label="Staged diff" />
          )}
        </button>
        {!isFolder && (
          <button
            type="button"
            aria-label={`Delete ${node.name}`}
            className="flex size-7 items-center justify-center rounded-md text-subtle hover:text-danger md:opacity-0 md:group-hover:opacity-100"
            onClick={() => deleteFile(node.path)}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {isFolder && open && node.children?.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} pending={pending} />
      ))}
    </div>
  );
}

async function saveZip() {
  try {
    const result = await downloadCurrentWorkspace();
    toast.success(`Downloaded ${result.name} · ${result.count} files`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not download");
  }
}

function OpenMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const setGithubOpen = useIdeUi((s) => s.setGithubOpen);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as HTMLElement)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { label: "Open folder", icon: FolderOpen, run: () => pickFolder() },
    { label: "Open zip", icon: FileArchive, run: () => pickZip() },
    { label: "Open GitHub", icon: Github, run: () => setGithubOpen(true) },
    { label: "Download zip", icon: Download, run: () => void saveZip() },
  ];

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Open project"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FolderOpen className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-border bg-elevated py-1 shadow-[var(--shadow-float)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex h-10 w-full items-center gap-2 px-3 text-left text-[13px] text-fg hover:bg-bg"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              <item.icon className="size-3.5 text-subtle" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  const files = useWorkspace((s) => s.files);
  const name = useWorkspace((s) => s.name);
  const chunks = useWorkspace((s) => s.chunks);
  const pendingKey = useWorkspace((s) => pendingPathKey(s.messages));
  const pending = useMemo(() => new Set(pendingKey.split("|").filter(Boolean)), [pendingKey]);
  const setNewFileOpen = useIdeUi((s) => s.setNewFileOpen);
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-10 items-center justify-between gap-1 border-b border-border px-2">
        <p className="min-w-0 truncate px-1 text-sm font-medium tracking-tight">{name}</p>
        <div className="flex items-center">
          <OpenMenu />
          <Button variant="ghost" size="icon-sm" aria-label="New file" onClick={() => setNewFileOpen(true)}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <div className="aperture-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tree.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} pending={pending} />
        ))}
      </div>
      <div className="border-t border-border px-3 py-2 text-[11px] text-subtle">
        {Object.keys(files).length} files · {chunks.length} chunks
      </div>
    </div>
  );
}
