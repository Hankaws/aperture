import { create } from "zustand";
import { indexFiles } from "@/lib/indexer/search";
import { isSecretPath, safeRelPath } from "@/lib/security/redact";
import { DEMO_FILES, DEMO_WORKSPACE_NAME } from "./demo-repo";
import { checkpointLabel, pushCheckpoint, restoreFiles, snapshotPaths } from "./checkpoint";
import { dropHunk, hunksFromDiff, hunkLines } from "@/lib/agent/apply-edit";
import { hunkAnchorLines, hunkIndexAt } from "@/lib/editor/review-nav";
import { useIdeUi } from "@/lib/ui-store";
import { previewNotesForEdit } from "./preview-check";
import { fileListOf, keepFileList, withFiles } from "./file-list";
import { workspaceHash, type SyncState } from "./sync";
import { applyStackMemory } from "@/lib/agent/stack";
import { findRules } from "./rules";
import type { AgentMode, ChatMessage, Checkpoint, IndexedChunk, ProposedEdit } from "./types";

const STORAGE_KEY = "aperture-workspace-v2";

type Selection = {
  path: string;
  text: string;
  fromLine: number;
  toLine: number;
  empty: boolean;
} | null;

type WorkspaceState = {
  ready: boolean;
  name: string;
  files: Record<string, string>;
  fileList: string[];
  openTabs: string[];
  recentPaths: string[];
  activePath: string | null;
  previewPath: string | null;
  pinned: string[];
  dirtyPaths: string[];
  chunks: IndexedChunk[];
  indexing: boolean;
  messages: ChatMessage[];
  checkpoints: Checkpoint[];
  agentRunning: boolean;
  runningMode: AgentMode | null;
  /** Saved-copy revision this workspace is in step with; null if never synced. */
  revision: number | null;
  /** Content hash at that moment, so unsaved edits are detectable after a reload. */
  syncedHash: string | null;
  syncState: SyncState;
  selection: Selection;
  hydrate: () => void;
  loadDemo: () => void;
  loadProject: (name: string, files: Record<string, string>) => void;
  reindex: () => void;
  openFile: (path: string) => void;
  openPreview: (path: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  pinTab: (path: string) => void;
  writeFile: (path: string, content: string) => void;
  createFile: (path: string, content?: string) => void;
  deleteFile: (path: string) => void;
  setSelection: (selection: Selection) => void;
  addMessage: (message: ChatMessage) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setAgentRunning: (running: boolean, mode?: AgentMode | null) => void;
  applyEdit: (edit: ProposedEdit) => void;
  rejectEdit: (editId: string) => void;
  applyAllPending: () => void;
  rejectAllPending: () => void;
  dropHunkAt: (editId: string, line: number) => void;
  clearPendingNotes: (editId?: string) => void;
  undoCheckpoint: (id: string) => Checkpoint | null;
  undoLast: () => Checkpoint | null;
  clearChat: () => void;
  markSynced: (revision: number, hash: string) => void;
  adoptRemote: (name: string, files: Record<string, string>, revision: number) => void;
  setSyncState: (state: SyncState) => void;
  syncStackMemory: () => void;
};

type PersistShape = {
  name: string;
  files: Record<string, string>;
  openTabs: string[];
  recentPaths?: string[];
  activePath: string | null;
  previewPath?: string | null;
  pinned?: string[];
  dirtyPaths?: string[];
  messages: ChatMessage[];
  checkpoints?: Checkpoint[];
  revision?: number | null;
  syncedHash?: string | null;
};

function persist(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  const base: PersistShape = {
    name: state.name,
    files: state.files,
    openTabs: state.openTabs,
    recentPaths: state.recentPaths,
    activePath: state.activePath,
    previewPath: state.previewPath,
    pinned: state.pinned,
    dirtyPaths: state.dirtyPaths,
    messages: state.messages.slice(-40),
    revision: state.revision,
    syncedHash: state.syncedHash,
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
const previewForce = new Set<string>();
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

function orderTabs(tabs: string[], pinned: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of pinned) {
    if (tabs.includes(path) && !seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  }
  for (const path of tabs) {
    if (!seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  }
  return out;
}

function remember(recent: string[], path: string): string[] {
  return [path, ...recent.filter((p) => p !== path)].slice(0, 8);
}

function withPath(list: string[], path: string) {
  return list.includes(path) ? list : [...list, path];
}

function seedFiles(files: Record<string, string>, name: string) {
  return applyStackMemory(files, name);
}

const SEEDED_DEMO = seedFiles({ ...DEMO_FILES }, DEMO_WORKSPACE_NAME);

/**
 * Hash of an untouched editor, for deciding whether a local copy is worth
 * keeping. It must be taken after seeding: `applyStackMemory` rewrites the
 * rules file on the way in, so hashing `DEMO_FILES` would never match the
 * state a fresh editor is actually in.
 */
export const DEMO_SYNC_HASH = workspaceHash(DEMO_WORKSPACE_NAME, SEEDED_DEMO);

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
    let files = { ...get().files, [edit.path]: edit.newText };
    const rules = findRules(files);
    if (!rules || rules.path !== edit.path) files = applyStackMemory(files, get().name);
    const openTabs = get().openTabs.includes(edit.path) ? get().openTabs : [...get().openTabs, edit.path];
    const messages = get().messages.map((m) => ({
      ...m,
      edits: m.edits?.map((e) => (e.id === edit.id ? { ...e, status: "applied" as const } : e)),
    }));
    set({
      files,
      openTabs: orderTabs(openTabs, get().pinned),
      activePath: edit.path,
      previewPath: get().previewPath === edit.path ? null : get().previewPath,
      dirtyPaths: withPath(get().dirtyPaths, edit.path),
      chunks: buildIndex(files),
      messages,
      fileList: keepFileList(get().fileList, files),
    });
  }

  function restoreCheckpoint(id: string): Checkpoint | null {
    const ck = get().checkpoints.find((c) => c.id === id);
    if (!ck) return null;
    const files = restoreFiles(get().files, ck.before);
    const tabs = syncTabs(files, get().openTabs, get().activePath);
    const pinned = get().pinned.filter((p) => files[p] !== undefined);
    const prev = get().previewPath;
    const previewPath = prev && files[prev] !== undefined ? prev : null;
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
      pinned,
      previewPath,
      chunks: buildIndex(files),
      messages,
      fileList: keepFileList(get().fileList, files),
    });
    schedulePersist();
    return ck;
  }

  return {
    ready: true,
    name: DEMO_WORKSPACE_NAME,
    files: SEEDED_DEMO,
    fileList: fileListOf(SEEDED_DEMO),
    openTabs: ["src/store.ts", "src/index.ts"],
    recentPaths: ["src/store.ts", "src/index.ts"],
    activePath: "src/store.ts",
    previewPath: null,
    pinned: [],
    dirtyPaths: [],
    chunks: buildIndex(DEMO_FILES),
    indexing: false,
    messages: [],
    checkpoints: [],
    agentRunning: false,
    runningMode: null,
    selection: null,
    revision: null,
    syncedHash: null,
    syncState: "idle",

    hydrate: () => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistShape;
          const storedFiles = parsed.files && Object.keys(parsed.files).length > 0 ? parsed.files : null;
          const nextFiles = seedFiles(
            storedFiles ?? get().files,
            parsed.name || DEMO_WORKSPACE_NAME,
          );
          if (nextFiles && Object.keys(nextFiles).length > 0) {
            const nextTabs = parsed.openTabs?.length
              ? parsed.openTabs.filter((p) => nextFiles[p] !== undefined)
              : [Object.keys(nextFiles)[0]!];
            const nextActive =
              parsed.activePath && nextFiles[parsed.activePath] !== undefined
                ? parsed.activePath
                : nextTabs[0]!;
            const nextPreview =
              parsed.previewPath && nextFiles[parsed.previewPath] !== undefined ? parsed.previewPath : null;
            const nextPinned = (parsed.pinned ?? []).filter((p) => nextFiles[p] !== undefined);
            const nextDirty = (parsed.dirtyPaths ?? []).filter((p) => nextFiles[p] !== undefined);
            const nextRecent = (parsed.recentPaths ?? nextTabs).filter((p) => nextFiles[p] !== undefined);
            set({
              revision: parsed.revision ?? null,
              syncedHash: parsed.syncedHash ?? null,
              name: parsed.name || DEMO_WORKSPACE_NAME,
              files: nextFiles,
              fileList: fileListOf(nextFiles),
              openTabs: nextTabs,
              recentPaths: nextRecent.length ? nextRecent : nextTabs,
              activePath: nextActive,
              previewPath: nextPreview,
              pinned: nextPinned,
              dirtyPaths: nextDirty,
              messages: parsed.messages ?? [],
              checkpoints: parsed.checkpoints ?? [],
              chunks: buildIndex(nextFiles),
              indexing: false,
              agentRunning: false,
              runningMode: null,
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
      const files = applyStackMemory({ ...DEMO_FILES }, DEMO_WORKSPACE_NAME);
      set({
        name: DEMO_WORKSPACE_NAME,
        files,
        fileList: fileListOf(files),
        openTabs: ["src/store.ts", "src/index.ts"],
        recentPaths: ["src/store.ts", "src/index.ts"],
        activePath: "src/store.ts",
        previewPath: null,
        pinned: [],
        dirtyPaths: [],
        chunks: buildIndex(files),
        messages: [],
        checkpoints: [],
        selection: null,
        agentRunning: false,
        runningMode: null,
      });
      schedulePersist();
    },

    loadProject: (name, incoming) => {
      const nextFiles = seedFiles(incoming, name);
      // Opening a different project detaches from whatever was saved: the next
      // save is a fresh write, not an edit on top of the old revision.
      const paths = Object.keys(nextFiles).sort();
      if (paths.length === 0) return;
      const preferred =
        paths.find((p) => /^(readme\.md|readme)$/i.test(p.split("/").pop() ?? "")) ??
        paths.find((p) => p === ".aperture.md") ??
        paths[0]!;
      set({
        indexing: true,
        revision: null,
        syncedHash: null,
        syncState: "idle",
        name,
        files: nextFiles,
        fileList: fileListOf(nextFiles),
        openTabs: [preferred],
        recentPaths: [preferred],
        activePath: preferred,
        previewPath: null,
        pinned: [],
        dirtyPaths: [],
        messages: [],
        checkpoints: [],
        selection: null,
        agentRunning: false,
        runningMode: null,
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
      const { files, openTabs, activePath, pinned, previewPath, recentPaths } = get();
      if (files[path] === undefined) return;
      const nextPreview = previewPath === path ? null : previewPath;
      const tabs = orderTabs(openTabs.includes(path) ? openTabs : [...openTabs, path], pinned);
      const recent = remember(recentPaths, path);
      if (activePath === path && openTabs.includes(path) && previewPath !== path) {
        set({ recentPaths: recent });
        schedulePersist();
        return;
      }
      set({ openTabs: tabs, activePath: path, previewPath: nextPreview, recentPaths: recent });
      schedulePersist();
    },

    openPreview: (path) => {
      const { files, openTabs, activePath, pinned, previewPath, recentPaths } = get();
      if (files[path] === undefined) return;
      const recent = remember(recentPaths, path);
      if (openTabs.includes(path) && previewPath !== path) {
        if (activePath === path) {
          set({ recentPaths: recent });
          schedulePersist();
          return;
        }
        set({ activePath: path, recentPaths: recent });
        schedulePersist();
        return;
      }
      if (previewPath === path) {
        set({ activePath: path, recentPaths: recent });
        schedulePersist();
        return;
      }
      const withoutOld = openTabs.filter((p) => p !== previewPath);
      const tabs = orderTabs(withoutOld.includes(path) ? withoutOld : [...withoutOld, path], pinned);
      set({ openTabs: tabs, activePath: path, previewPath: path, recentPaths: recent });
      schedulePersist();
    },

    closeTab: (path) => {
      const tabs = get().openTabs.filter((p) => p !== path);
      const active = get().activePath === path ? (tabs[tabs.length - 1] ?? null) : get().activePath;
      const pinned = get().pinned.filter((p) => p !== path);
      const previewPath = get().previewPath === path ? null : get().previewPath;
      set({ openTabs: tabs, activePath: active, pinned, previewPath });
      schedulePersist();
    },

    setActive: (path) => {
      set({ activePath: path, recentPaths: remember(get().recentPaths, path) });
      schedulePersist();
    },

    pinTab: (path) => {
      const { files, openTabs, pinned, previewPath } = get();
      if (files[path] === undefined) return;
      const isPinned = pinned.includes(path);
      const nextPinned = isPinned ? pinned.filter((p) => p !== path) : [...pinned, path];
      const tabs = orderTabs(openTabs.includes(path) ? openTabs : [...openTabs, path], nextPinned);
      set({
        pinned: nextPinned,
        openTabs: tabs,
        previewPath: previewPath === path ? null : previewPath,
        activePath: path,
      });
      schedulePersist();
    },

    writeFile: (path, content) => {
      if (isSecretPath(path)) return;
      if (get().files[path] === content) return;
      const files = { ...get().files, [path]: content };
      const previewPath = get().previewPath === path ? null : get().previewPath;
      set({
        ...withFiles(files, get().fileList),
        dirtyPaths: withPath(get().dirtyPaths, path),
        previewPath,
      });
      schedulePersist();
      scheduleReindex();
    },

    createFile: (path, content = "") => {
      const clean = safeRelPath(path);
      if (!clean || isSecretPath(clean)) return;
      let files = { ...get().files, [clean]: content };
      files = seedFiles(files, get().name);
      const openTabs = orderTabs(
        get().openTabs.includes(clean) ? get().openTabs : [...get().openTabs, clean],
        get().pinned,
      );
      set({
        files,
        fileList: keepFileList(get().fileList, files),
        openTabs,
        activePath: clean,
        previewPath: get().previewPath === clean ? null : get().previewPath,
        dirtyPaths: withPath(get().dirtyPaths, clean),
        chunks: buildIndex(files),
      });
      schedulePersist();
    },

    deleteFile: (path) => {
      const files = { ...get().files };
      delete files[path];
      const openTabs = get().openTabs.filter((p) => p !== path);
      const active = get().activePath === path ? (openTabs[openTabs.length - 1] ?? null) : get().activePath;
      const pinned = get().pinned.filter((p) => p !== path);
      const previewPath = get().previewPath === path ? null : get().previewPath;
      const dirtyPaths = get().dirtyPaths.filter((p) => p !== path);
      set({ files, fileList: keepFileList(get().fileList, files), openTabs, activePath: active, pinned, previewPath, dirtyPaths, chunks: buildIndex(files) });
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
        prev.toLine === selection.toLine &&
        prev.empty === selection.empty
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

    setAgentRunning: (running, mode) =>
      set({ agentRunning: running, runningMode: running ? (mode ?? get().runningMode) : null }),

    applyEdit: (edit) => {
      if (edit.notes?.length) return;
      if (!previewForce.has(edit.id)) {
        const live = useIdeUi.getState().previewErrors;
        const notes = previewNotesForEdit(edit, get().files, live);
        if (notes.length) {
          set({
            messages: get().messages.map((m) => ({
              ...m,
              edits: m.edits?.map((e) => (e.id === edit.id ? { ...e, notes } : e)),
            })),
          });
          schedulePersist();
          return;
        }
      }
      const message = get().messages.find((m) => m.edits?.some((e) => e.id === edit.id));
      if (message) ensureCheckpointForMessage(message.id);
      applyOne(edit);
      previewForce.delete(edit.id);
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
      const pending = get()
        .messages.flatMap((m) => m.edits ?? [])
        .filter((e) => e.status === "pending");
      if (pending.some((e) => (e.notes?.length ?? 0) > 0)) return;
      const live = useIdeUi.getState().previewErrors;
      const bounced: Record<string, ProposedEdit["notes"]> = {};
      for (const edit of pending) {
        if (previewForce.has(edit.id)) continue;
        const notes = previewNotesForEdit(edit, get().files, live);
        if (notes.length) bounced[edit.id] = notes;
      }
      if (Object.keys(bounced).length) {
        set({
          messages: get().messages.map((m) => ({
            ...m,
            edits: m.edits?.map((e) => (bounced[e.id] ? { ...e, notes: bounced[e.id] } : e)),
          })),
        });
        schedulePersist();
        return;
      }
      const pendingByMessage = get().messages.filter((m) => m.edits?.some((e) => e.status === "pending"));
      for (const message of pendingByMessage) ensureCheckpointForMessage(message.id);
      for (const edit of pending) {
        applyOne(edit);
        previewForce.delete(edit.id);
      }
      schedulePersist();
    },

    rejectAllPending: () => {
      set({
        messages: get().messages.map((m) => ({
          ...m,
          edits: m.edits?.map((e) => (e.status === "pending" ? { ...e, status: "rejected" as const } : e)),
        })),
      });
      schedulePersist();
    },

    dropHunkAt: (editId, line) => {
      const edit = get()
        .messages.flatMap((m) => m.edits ?? [])
        .find((e) => e.id === editId && e.status === "pending");
      if (!edit) return;
      const anchors = hunkAnchorLines(edit);
      const index = hunkIndexAt(anchors, line);
      const hunks = hunksFromDiff(edit.oldText, edit.newText);
      const hunk = hunks[index];
      if (!hunk) return;
      if (hunks.length <= 1) {
        get().rejectEdit(editId);
        return;
      }
      const nextText = dropHunk(edit.oldText, edit.newText, index);
      if (nextText === edit.oldText) {
        get().rejectEdit(editId);
        return;
      }
      const dropped = new Set(hunkLines(edit.oldText, hunk).map((text) => text.slice(0, 80)));
      const notes = (edit.notes ?? []).filter((note) => !dropped.has(note.excerpt));
      set({
        messages: get().messages.map((m) => ({
          ...m,
          edits: m.edits?.map((e) => (e.id === editId ? { ...e, newText: nextText, notes } : e)),
        })),
      });
      schedulePersist();
    },

    clearPendingNotes: (editId) => {
      for (const message of get().messages) {
        for (const edit of message.edits ?? []) {
          if (edit.status === "pending" && (!editId || edit.id === editId)) previewForce.add(edit.id);
        }
      }
      set({
        messages: get().messages.map((m) => ({
          ...m,
          edits: m.edits?.map((e) =>
            e.status === "pending" && (!editId || e.id === editId) ? { ...e, notes: [] } : e,
          ),
        })),
      });
      schedulePersist();
    },

    undoCheckpoint: (id) => restoreCheckpoint(id),

    undoLast: () => {
      const last = get().checkpoints[get().checkpoints.length - 1];
      if (!last) return null;
      return restoreCheckpoint(last.id);
    },

    markSynced: (revision, hash) => {
      set({ revision, syncedHash: hash, syncState: "saved" });
      schedulePersist();
    },

    adoptRemote: (name, files, revision) => {
      const seeded = seedFiles(files, name);
      const tabs = Object.keys(seeded).slice(0, 1);
      set({
        name,
        ...withFiles(seeded, get().fileList),
        openTabs: tabs,
        recentPaths: tabs,
        activePath: tabs[0] ?? null,
        previewPath: null,
        pinned: [],
        dirtyPaths: [],
        chunks: buildIndex(seeded),
        revision,
        syncedHash: workspaceHash(name, seeded),
        syncState: "saved",
      });
      schedulePersist();
    },

    setSyncState: (state) => set({ syncState: state }),

    clearChat: () => {
      set({ messages: [] });
      schedulePersist();
    },

    syncStackMemory: () => {
      const files = seedFiles(get().files, get().name);
      if (files === get().files) return;
      set({ ...withFiles(files, get().fileList) });
      schedulePersist();
    },
  };
});
