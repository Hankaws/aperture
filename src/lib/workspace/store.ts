import { create } from "zustand";
import { stampFiles, type GithubOrigin, type GithubSource } from "@/lib/github/roundtrip";
import { indexFiles } from "@/lib/indexer/search";
import { isSecretPath, safeRelPath } from "@/lib/security/redact";
import { DEMO_FILES, DEMO_WORKSPACE_NAME } from "./demo-repo";
import { checkpointLabel, pushCheckpoint, restoreFiles, snapshotPaths } from "./checkpoint";
import { commitMessage, editsAfterRevert } from "./commits";
import { LESSONS_PATH, lessonAfterKeep, lessonsForPrompt, removeLesson, upsertLesson } from "./lessons";
import { useIdeUi } from "@/lib/ui-store";
import { validCheckpoints, validFiles, validMessages } from "./persist";
import { copyLabel, keepSet, type RunCopy } from "./copies";
import { dropHunk, hunksFromDiff, hunkLines } from "@/lib/agent/apply-edit";
import { hunkAnchorLines, hunkIndexAt } from "@/lib/editor/review-nav";
import { previewNotesForEdit } from "./preview-check";
import { fileListOf, keepFileList, withFiles } from "./file-list";
import { workspaceHash, type SyncState } from "./sync";
import { applyStackMemory } from "@/lib/agent/stack";
import { findRules } from "./rules";
import type { AgentMode, ChatMessage, Checkpoint, IndexedChunk, LocalCommit, ProposedEdit } from "./types";

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
  commits: LocalCommit[];
  /** Composer runs that each have their own pending edits. */
  copies: RunCopy[];
  /** The copy the review strip is showing. Null when there is nothing to choose. */
  activeCopyId: string | null;
  agentRunning: boolean;
  runningMode: AgentMode | null;
  /** Saved-copy revision this workspace is in step with; null if never synced. */
  revision: number | null;
  /** Content hash at that moment, so unsaved edits are detectable after a reload. */
  syncedHash: string | null;
  syncState: SyncState;
  /** Set when this project was opened from GitHub, so changes can go back. */
  github: GithubOrigin | null;
  selection: Selection;
  hydrate: () => void;
  loadDemo: () => void;
  loadProject: (name: string, files: Record<string, string>, source?: GithubSource | null) => void;
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
  /** Snapshots files before a direct edit (Design Mode), so Undo can put them back. */
  checkpointFiles: (paths: string[], label: string) => string;
  undoLast: () => Checkpoint | null;
  revertCommit: (id: string) => LocalCommit | null;
  forkCopy: (label: string) => string;
  setActiveCopy: (id: string | null) => void;
  clearChat: () => void;
  recordLesson: (messageId: string, score: "up" | "down", note: string) => void;
  clearLesson: (messageId: string) => void;
  markSynced: (revision: number, hash: string) => void;
  adoptRemote: (name: string, files: Record<string, string>, revision: number) => void;
  setSyncState: (state: SyncState) => void;
  setGithub: (github: GithubOrigin | null) => void;
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
  commits?: LocalCommit[];
  copies?: RunCopy[];
  activeCopyId?: string | null;
  revision?: number | null;
  syncedHash?: string | null;
  github?: GithubOrigin | null;
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
    github: state.github,
  };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...base,
        checkpoints: state.checkpoints.slice(-6),
        commits: state.commits.slice(-20),
        copies: state.copies.slice(-6),
        activeCopyId: state.activeCopyId,
      }),
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
function schedulePersist(delay = 180) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist(useWorkspace.getState());
  }, delay);
}

/** Write the local copy now. Used when the tab is closing, so the last reply is not lost to the debounce. */
export function flushWorkspacePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persist(useWorkspace.getState());
}

function safeIndex(files: Record<string, string>): IndexedChunk[] {
  try {
    return buildIndex(files);
  } catch {
    return [];
  }
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

function validCommits(value: unknown): LocalCommit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is LocalCommit => {
      if (!row || typeof row !== "object") return false;
      const commit = row as LocalCommit;
      return typeof commit.id === "string" && typeof commit.message === "string" && Boolean(commit.before);
    })
    .slice(-20);
}

function validCopies(value: unknown): RunCopy[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is RunCopy => {
      if (!row || typeof row !== "object") return false;
      const copy = row as RunCopy;
      return typeof copy.id === "string" && typeof copy.label === "string";
    })
    .slice(-6);
}

function validGithub(value: GithubOrigin | null | undefined): value is GithubOrigin {
  if (!value || typeof value.owner !== "string" || typeof value.repo !== "string") return false;
  if (typeof value.branch !== "string" || typeof value.sha !== "string") return false;
  return Boolean(value.stamps) && typeof value.stamps === "object";
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

  function recordCommit(
    descriptions: string[],
    paths: string[],
    before: Record<string, string | null>,
    messageId: string | null,
    editIds: string[] = [],
    rejectedIds: string[] = [],
  ) {
    if (paths.length === 0) return;
    const commit: LocalCommit = {
      id: `cm_${crypto.randomUUID()}`,
      createdAt: Date.now(),
      message: commitMessage(descriptions),
      paths,
      before,
      messageId,
      ...(editIds.length > 0 ? { editIds } : {}),
      ...(rejectedIds.length > 0 ? { rejectedIds } : {}),
    };
    set({ commits: [...get().commits, commit].slice(-20) });
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

  function rememberFailedCheck(messageId: string | null, copyId?: string) {
    const hint = useIdeUi.getState().checkHint;
    const detail = hint?.detail ?? null;
    const edits = get().messages.flatMap((m) => m.edits ?? []);
    const grown = lessonAfterKeep(get().files[LESSONS_PATH] ?? "", detail, `lesson_keep_${messageId ?? "local"}`, {
      keepingLessons: false,
      alreadyPending: edits.some((edit) => edit.status === "pending" && edit.path === LESSONS_PATH),
    });
    if (!grown) return;
    if (edits.some((edit) => edit.id === grown.id)) return;
    const target =
      messageId && get().messages.some((m) => m.id === messageId)
        ? messageId
        : [...get().messages].reverse().find((m) => m.role === "assistant")?.id;
    if (!target) return;
    set({
      messages: get().messages.map((m) =>
        m.id === target ? { ...m, edits: [...(m.edits ?? []), { ...grown, status: "pending" as const, ...(copyId ? { copyId } : {}) }] } : m,
      ),
    });
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
    commits: [],
    copies: [],
    activeCopyId: null,
    agentRunning: false,
    runningMode: null,
    selection: null,
    revision: null,
    syncedHash: null,
    syncState: "idle",
    github: null,

    hydrate: () => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistShape;
          const storedFiles = validFiles(parsed.files);
          const nextFiles = seedFiles(storedFiles ?? get().files, parsed.name || DEMO_WORKSPACE_NAME);
          if (nextFiles && Object.keys(nextFiles).length > 0) {
            const nextTabs = Array.isArray(parsed.openTabs)
              ? parsed.openTabs.filter((p) => typeof p === "string" && nextFiles[p] !== undefined)
              : [Object.keys(nextFiles)[0]!];
            const tabs = nextTabs.length > 0 ? nextTabs : [Object.keys(nextFiles)[0]!];
            const nextActive =
              typeof parsed.activePath === "string" && nextFiles[parsed.activePath] !== undefined
                ? parsed.activePath
                : tabs[0]!;
            const nextPreview =
              typeof parsed.previewPath === "string" && nextFiles[parsed.previewPath] !== undefined
                ? parsed.previewPath
                : null;
            const nextPinned = (Array.isArray(parsed.pinned) ? parsed.pinned : []).filter(
              (p) => typeof p === "string" && nextFiles[p] !== undefined,
            );
            const nextDirty = (Array.isArray(parsed.dirtyPaths) ? parsed.dirtyPaths : []).filter(
              (p) => typeof p === "string" && nextFiles[p] !== undefined,
            );
            const nextRecent = (Array.isArray(parsed.recentPaths) ? parsed.recentPaths : tabs).filter(
              (p) => typeof p === "string" && nextFiles[p] !== undefined,
            );
            set({
              revision: typeof parsed.revision === "number" ? parsed.revision : null,
              syncedHash: typeof parsed.syncedHash === "string" ? parsed.syncedHash : null,
              name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : DEMO_WORKSPACE_NAME,
              files: nextFiles,
              fileList: fileListOf(nextFiles),
              openTabs: tabs,
              recentPaths: nextRecent.length ? nextRecent : tabs,
              activePath: nextActive,
              previewPath: nextPreview,
              pinned: nextPinned,
              dirtyPaths: nextDirty,
              messages: validMessages(parsed.messages),
              checkpoints: validCheckpoints(parsed.checkpoints),
              commits: validCommits(parsed.commits),
              copies: validCopies(parsed.copies),
              activeCopyId: typeof parsed.activeCopyId === "string" ? parsed.activeCopyId : null,
              chunks: safeIndex(nextFiles),
              indexing: false,
              agentRunning: false,
              runningMode: null,
              github: validGithub(parsed.github) ? parsed.github! : null,
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
        commits: [],
        copies: [],
        activeCopyId: null,
        selection: null,
        agentRunning: false,
        runningMode: null,
        github: null,
      });
      schedulePersist();
    },

    loadProject: (name, incoming, source) => {
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
        commits: [],
        copies: [],
        activeCopyId: null,
        selection: null,
        agentRunning: false,
        runningMode: null,
        github: source ? { ...source, stamps: stampFiles(nextFiles) } : null,
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
      const keys = Object.keys(patch);
      const chatter = keys.length > 0 && keys.every((key) => key === "status" || key === "content" || key === "traces");
      schedulePersist(chatter ? 1500 : 180);
    },

    setAgentRunning: (running, mode) =>
      set({ agentRunning: running, runningMode: running ? (mode ?? get().runningMode) : null }),

    applyEdit: (edit) => {
      const live = get().messages.flatMap((m) => m.edits ?? []).find((row) => row.id === edit.id);
      if (live && live.status !== "pending") return;
      if (edit.notes?.length) return;
      if (!previewForce.has(edit.id)) {
        // Only what the staged text itself shows (parse, markup, imports). The
        // live preview's errors belong to the applied page, so a fix for the
        // very error it would be blocked by could never be applied.
        const notes = previewNotesForEdit(edit, get().files);
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
      const before = snapshotPaths(get().files, [edit.path]);
      const rejectedIds = edit.copyId
        ? get()
            .messages.flatMap((m) => m.edits ?? [])
            .filter((row) => row.status === "pending" && row.path === edit.path && row.id !== edit.id && row.copyId !== edit.copyId)
            .map((row) => row.id)
        : [];
      applyOne(edit);
      if (rejectedIds.length > 0) {
        const drop = new Set(rejectedIds);
        set({
          messages: get().messages.map((m) => ({
            ...m,
            edits: m.edits?.map((row) => (drop.has(row.id) ? { ...row, status: "rejected" as const } : row)),
          })),
        });
      }
      recordCommit([edit.description], [edit.path], before, message?.id ?? null, [edit.id], rejectedIds);
      previewForce.delete(edit.id);
      if (edit.path !== LESSONS_PATH) rememberFailedCheck(message?.id ?? null, edit.copyId);
      schedulePersist();
    },

    rejectEdit: (editId) => {
      const live = get().messages.flatMap((m) => m.edits ?? []).find((row) => row.id === editId);
      if (live && live.status !== "pending") return;
      set({
        messages: get().messages.map((m) => ({
          ...m,
          edits: m.edits?.map((e) => (e.id === editId ? { ...e, status: "rejected" as const } : e)),
        })),
      });
      schedulePersist();
    },

    applyAllPending: () => {
      const flat = get().messages.flatMap((m) => m.edits ?? []);
      const { apply: pending, rejectIds } = keepSet(flat, get().activeCopyId);
      if (pending.length === 0) return;
      if (pending.some((e) => (e.notes?.length ?? 0) > 0)) return;
      const bounced: Record<string, ProposedEdit["notes"]> = {};
      for (const edit of pending) {
        if (previewForce.has(edit.id)) continue;
        // Static checks only; see applyEdit. The staged page's own render is in the check results.
        const notes = previewNotesForEdit(edit, get().files);
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
      const owned = new Set(pending.map((edit) => edit.id));
      const pendingByMessage = get().messages.filter((m) => m.edits?.some((e) => e.status === "pending" && owned.has(e.id)));
      for (const message of pendingByMessage) ensureCheckpointForMessage(message.id);
      const paths = [...new Set(pending.map((edit) => edit.path))];
      const before = snapshotPaths(get().files, paths);
      for (const edit of pending) {
        applyOne(edit);
        previewForce.delete(edit.id);
      }
      recordCommit(
        pending.map((edit) => edit.description),
        paths,
        before,
        [...get().messages].reverse().find((m) => m.edits?.some((e) => pending.some((p) => p.id === e.id)))?.id ?? null,
        pending.map((edit) => edit.id),
        rejectIds,
      );
      if (rejectIds.length > 0) {
        const drop = new Set(rejectIds);
        set({
          messages: get().messages.map((m) => ({
            ...m,
            edits: m.edits?.map((e) => (drop.has(e.id) && e.status === "pending" ? { ...e, status: "rejected" as const } : e)),
          })),
        });
      }
      if (!paths.every((path) => path === LESSONS_PATH)) {
        const owner = [...get().messages].reverse().find((m) => m.edits?.some((e) => pending.some((p) => p.id === e.id)));
        rememberFailedCheck(owner?.id ?? null, pending.find((edit) => edit.copyId)?.copyId);
      }
      schedulePersist();
    },

    rejectAllPending: () => {
      const { apply } = keepSet(
        get().messages.flatMap((m) => m.edits ?? []),
        get().activeCopyId,
      );
      const ids = new Set(apply.map((edit) => edit.id));
      set({
        messages: get().messages.map((m) => ({
          ...m,
          edits: m.edits?.map((e) => (e.status === "pending" && ids.has(e.id) ? { ...e, status: "rejected" as const } : e)),
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

    checkpointFiles: (paths, label) => {
      const id = `ck_${crypto.randomUUID()}`;
      const checkpoint: Checkpoint = {
        id,
        createdAt: Date.now(),
        label,
        messageId: null,
        before: snapshotPaths(get().files, paths),
      };
      set({ checkpoints: pushCheckpoint(get().checkpoints, checkpoint) });
      schedulePersist();
      return id;
    },

    undoLast: () => {
      const last = get().checkpoints[get().checkpoints.length - 1];
      if (!last) return null;
      return restoreCheckpoint(last.id);
    },

    revertCommit: (id) => {
      const list = get().commits;
      const last = list[list.length - 1];
      if (!last || last.id !== id) return null;
      const files = restoreFiles(get().files, last.before);
      const messages = get().messages.map((m) => ({
        ...m,
        edits: editsAfterRevert(m.edits, last, m.id),
      }));
      set({
        commits: list.slice(0, -1),
        messages,
        ...withFiles(files, get().fileList),
        dirtyPaths: [...new Set([...get().dirtyPaths, ...last.paths])],
      });
      schedulePersist();
      return last;
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
        github: null,
      });
      schedulePersist();
    },

    setSyncState: (state) => set({ syncState: state }),

    setGithub: (github) => {
      set({ github });
      schedulePersist();
    },

    forkCopy: (label) => {
      const id = `cp_${crypto.randomUUID()}`;
      const copies = [...get().copies];
      let messages = get().messages;
      const pending = messages.flatMap((m) => m.edits ?? []).some((e) => e.status === "pending" && !e.copyId);
      if (pending) {
        const legacy = `cp_${crypto.randomUUID()}`;
        copies.push({ id: legacy, label: "Earlier run", createdAt: Date.now() });
        messages = messages.map((m) => {
          if (!m.edits?.some((e) => e.status === "pending" && !e.copyId)) return m;
          return {
            ...m,
            copyId: m.copyId ?? legacy,
            edits: m.edits?.map((e) => (e.status === "pending" && !e.copyId ? { ...e, copyId: legacy } : e)),
          };
        });
      }
      copies.push({ id, label: copyLabel(label), createdAt: Date.now() });
      set({ copies: copies.slice(-6), messages, activeCopyId: id });
      schedulePersist();
      return id;
    },

    setActiveCopy: (id) => {
      if (get().activeCopyId === id) return;
      set({ activeCopyId: id });
      schedulePersist();
    },

    clearChat: () => {
      set({ messages: [] });
      schedulePersist();
    },

    recordLesson: (messageId, score, note) => {
      const message = get().messages.find((row) => row.id === messageId);
      if (!message || message.role !== "assistant") return;
      const line = (note.trim() || (score === "up" ? "Keep this approach." : "")).slice(0, 240);
      if (!line) return;
      const next = upsertLesson(get().files[LESSONS_PATH] ?? "", messageId, score, line);
      get().writeFile(LESSONS_PATH, next);
      get().patchMessage(messageId, { lesson: score });
    },

    clearLesson: (messageId) => {
      const current = get().files[LESSONS_PATH];
      if (current) {
        const next = removeLesson(current, messageId);
        if (lessonsForPrompt(next).trim()) get().writeFile(LESSONS_PATH, next);
        else get().deleteFile(LESSONS_PATH);
      }
      get().patchMessage(messageId, { lesson: undefined });
    },

    syncStackMemory: () => {
      const files = seedFiles(get().files, get().name);
      if (files === get().files) return;
      set({ ...withFiles(files, get().fileList) });
      schedulePersist();
    },
  };
});
