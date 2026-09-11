import { create } from "zustand";
import { indexFiles } from "@/lib/indexer/search";
import { isSecretPath, safeRelPath } from "@/lib/security/redact";
import { DEMO_FILES, DEMO_WORKSPACE_NAME } from "./demo-repo";
import { checkpointLabel, pushCheckpoint, restoreFiles, snapshotPaths } from "./checkpoint";
import type { ChatMessage, Checkpoint, IndexedChunk, ProposedEdit } from "./types";

const STORAGE_KEY = "aperture-workspace-v1";

type Selection = {
  path: string;
  text: string;
  fromLine: number;
  toLine: number;
} | null;

type WorkspaceState = {
  ready: boolean;
  name: string;
  files: Record<string, string>;
  openTabs: string[];
  activePath: string | null;
  chunks: IndexedChunk[];
  indexing: boolean;
  messages: ChatMessage[];
  checkpoints: Checkpoint[];
  agentRunning: boolean;
  selection: Selection;
  hydrate: () => void;
  loadDemo: () => void;
  loadProject: (name: string, files: Record<string, string>) => void;
  reindex: () => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  writeFile: (path: string, content: string) => void;
  createFile: (path: string, content?: string) => void;
  deleteFile: (path: string) => void;
  setSelection: (selection: Selection) => void;
  addMessage: (message: ChatMessage) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setAgentRunning: (running: boolean) => void;
  applyEdit: (edit: ProposedEdit) => void;
  rejectEdit: (editId: string) => void;
  applyAllPending: () => void;
  undoCheckpoint: (id: string) => Checkpoint | null;
  undoLast: () => Checkpoint | null;
  clearChat: () => void;
};

type PersistShape = {
  name: string;
  files: Record<string, string>;
  openTabs: string[];
  activePath: string | null;
  messages: ChatMessage[];
  checkpoints?: Checkpoint[];
};

function persist(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  const base: PersistShape = {
    name: state.name,
    files: state.files,
    openTabs: state.openTabs,
    activePath: state.activePath,
    messages: state.messages.slice(-40),
  };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...base, checkpoints: state.checkpoints.slice(-6) }),
    );
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    } catch {
      // quota — ignore
    }
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persist(useWorkspace.getState()), 180);
}

let reindexTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReindex() {
  if (reindexTimer) clearTimeout(reindexTimer);
  reindexTimer = setTimeout(() => {
    useWorkspace.getState().reindex();
  }, 420);
}

function buildIndex(files: Record<string, string>): IndexedChunk[] {
  return indexFiles(files);
}

function syncTabs(files: Record<string, string>, openTabs: string[], activePath: string | null) {
  const tabs = openTabs.filter((p) => files[p] !== undefined);
  const active = activePath && files[activePath] !== undefined ? activePath : (tabs[tabs.length - 1] ?? null);
  return { openTabs: tabs, activePath: active };
}

export const useWorkspace = create<WorkspaceState>((set, get) => {
  function ensureCheckpointForMessage(messageId: string): string | null {
    const state = get();
    const message = state.messages.find((m) => m.id === messageId);
    if (!message?.edits?.length) return null;
    if (message.checkpointId) {
      const existing = state.checkpoints.find((c) => c.id === message.checkpointId);
      if (existing) return existing.id;
    }
    const pendingOrApplied = message.edits.filter((e) => e.status === "pending" || e.status === "applied");
    const paths = [...new Set(pendingOrApplied.map((e) => e.path))];
    if (paths.length === 0) return null;
    const idx = state.messages.findIndex((m) => m.id === messageId);
    const prev = idx > 0 ? state.messages[idx - 1] : null;
    const label = checkpointLabel(
      prev?.role === "user" ? prev.content : message.edits[0]?.description,
    );
    const id = `ck_${crypto.randomUUID()}`;
    const checkpoint: Checkpoint = {
      id,
      createdAt: Date.now(),
      label,
      messageId,
      before: snapshotPaths(state.files, paths),
    };
    set({
      checkpoints: pushCheckpoint(state.checkpoints, checkpoint),
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, checkpointId: id } : m)),
    });
    return id;
  }

  function applyOne(edit: ProposedEdit) {
    const files = { ...get().files, [edit.path]: edit.newText };
    const openTabs = get().openTabs.includes(edit.path) ? get().openTabs : [...get().openTabs, edit.path];
    const messages = get().messages.map((m) => ({
      ...m,
      edits: m.edits?.map((e) => (e.id === edit.id ? { ...e, status: "applied" as const } : e)),
    }));
    set({
      files,
      openTabs,
      activePath: edit.path,
      chunks: buildIndex(files),
      messages,
    });
  }

  function restoreCheckpoint(id: string): Checkpoint | null {
    const ck = get().checkpoints.find((c) => c.id === id);
    if (!ck) return null;
    const files = restoreFiles(get().files, ck.before);
    const tabs = syncTabs(files, get().openTabs, get().activePath);
    const messages = get().messages.map((m) => {
      if (m.id !== ck.messageId) return m;
      return {
        ...m,
        edits: m.edits?.map((e) => (e.status === "applied" ? { ...e, status: "pending" as const } : e)),
      };
    });
    set({
      files,
      ...tabs,
      chunks: buildIndex(files),
      messages,
    });
    schedulePersist();
    return ck;
  }

  return {
    ready: true,
    name: DEMO_WORKSPACE_NAME,
    files: { ...DEMO_FILES },
    openTabs: ["README.md", "src/store.ts"],
    activePath: "README.md",
    chunks: buildIndex(DEMO_FILES),
    indexing: false,
    messages: [],
    checkpoints: [],
    agentRunning: false,
    selection: null,

    hydrate: () => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistShape;
          const storedFiles = parsed.files && Object.keys(parsed.files).length > 0 ? parsed.files : null;
          const nextFiles = storedFiles ?? get().files;
          if (nextFiles && Object.keys(nextFiles).length > 0) {
            const nextTabs = parsed.openTabs?.length
              ? parsed.openTabs.filter((p) => nextFiles[p] !== undefined)
              : [Object.keys(nextFiles)[0]!];
            const nextActive =
              parsed.activePath && nextFiles[parsed.activePath] !== undefined
                ? parsed.activePath
                : nextTabs[0]!;
            set({
              name: parsed.name || DEMO_WORKSPACE_NAME,
              files: nextFiles,
              openTabs: nextTabs,
              activePath: nextActive,
              messages: parsed.messages ?? [],
              checkpoints: parsed.checkpoints ?? [],
              chunks: buildIndex(nextFiles),
              indexing: false,
              agentRunning: false,
            });
            return;
          }
        }
      } catch {
        // keep demo
      }
      const files = get().files;
      set({ chunks: buildIndex(files), indexing: false });
    },

    loadDemo: () => {
      set({
        name: DEMO_WORKSPACE_NAME,
        files: { ...DEMO_FILES },
        openTabs: ["README.md", "src/store.ts"],
        activePath: "README.md",
        chunks: buildIndex(DEMO_FILES),
        messages: [],
        checkpoints: [],
        selection: null,
        agentRunning: false,
      });
      schedulePersist();
    },

    loadProject: (name, nextFiles) => {
      const paths = Object.keys(nextFiles).sort();
      if (paths.length === 0) return;
      const preferred =
        paths.find((p) => /^(readme\.md|readme)$/i.test(p.split("/").pop() ?? "")) ??
        paths.find((p) => p === ".aperture.md") ??
        paths[0]!;
      set({
        indexing: true,
        name,
        files: nextFiles,
        openTabs: [preferred],
        activePath: preferred,
        messages: [],
        checkpoints: [],
        selection: null,
        agentRunning: false,
      });
      set({
        chunks: buildIndex(nextFiles),
        indexing: false,
      });
      schedulePersist();
    },

    reindex: () => {
      const files = get().files;
      set({ indexing: true });
      const chunks = buildIndex(files);
      set({ chunks, indexing: false });
    },

    openFile: (path) => {
      const { files, openTabs } = get();
      if (files[path] === undefined) return;
      const tabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
      set({ openTabs: tabs, activePath: path });
      schedulePersist();
    },

    closeTab: (path) => {
      const tabs = get().openTabs.filter((p) => p !== path);
      const active = get().activePath === path ? (tabs[tabs.length - 1] ?? null) : get().activePath;
      set({ openTabs: tabs, activePath: active });
      schedulePersist();
    },

    setActive: (path) => {
      set({ activePath: path });
      schedulePersist();
    },

    writeFile: (path, content) => {
      if (isSecretPath(path)) return;
      if (get().files[path] === content) return;
      const files = { ...get().files, [path]: content };
      set({ files });
      schedulePersist();
      scheduleReindex();
    },

    createFile: (path, content = "") => {
      const clean = safeRelPath(path);
      if (!clean || isSecretPath(clean)) return;
      const files = { ...get().files, [clean]: content };
      const openTabs = get().openTabs.includes(clean) ? get().openTabs : [...get().openTabs, clean];
      set({ files, openTabs, activePath: clean, chunks: buildIndex(files) });
      schedulePersist();
    },

    deleteFile: (path) => {
      const files = { ...get().files };
      delete files[path];
      const openTabs = get().openTabs.filter((p) => p !== path);
      const active = get().activePath === path ? (openTabs[openTabs.length - 1] ?? null) : get().activePath;
      set({ files, openTabs, activePath: active, chunks: buildIndex(files) });
      schedulePersist();
    },

    setSelection: (selection) => {
      const prev = get().selection;
      if (prev === selection) return;
      if (
        prev &&
        selection &&
        prev.path === selection.path &&
        prev.text === selection.text &&
        prev.fromLine === selection.fromLine &&
        prev.toLine === selection.toLine
      ) {
        return;
      }
      set({ selection });
    },

    addMessage: (message) => {
      set({ messages: [...get().messages, message] });
      schedulePersist();
    },

    patchMessage: (id, patch) => {
      set({
        messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      });
      schedulePersist();
    },

    setAgentRunning: (running) => set({ agentRunning: running }),

    applyEdit: (edit) => {
      const message = get().messages.find((m) => m.edits?.some((e) => e.id === edit.id));
      if (message) ensureCheckpointForMessage(message.id);
      applyOne(edit);
      schedulePersist();
    },

    rejectEdit: (editId) => {
      set({
        messages: get().messages.map((m) => ({
          ...m,
          edits: m.edits?.map((e) => (e.id === editId ? { ...e, status: "rejected" as const } : e)),
        })),
      });
      schedulePersist();
    },

    applyAllPending: () => {
      const pendingByMessage = get().messages.filter((m) => m.edits?.some((e) => e.status === "pending"));
      for (const message of pendingByMessage) ensureCheckpointForMessage(message.id);
      const pending = get()
        .messages.flatMap((m) => m.edits ?? [])
        .filter((e) => e.status === "pending");
      for (const edit of pending) applyOne(edit);
      schedulePersist();
    },

    undoCheckpoint: (id) => restoreCheckpoint(id),

    undoLast: () => {
      const last = get().checkpoints[get().checkpoints.length - 1];
      if (!last) return null;
      return restoreCheckpoint(last.id);
    },

    clearChat: () => {
      set({ messages: [] });
      schedulePersist();
    },
  };
});
