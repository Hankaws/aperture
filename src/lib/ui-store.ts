import { create } from "zustand";
import type { DesignCapture } from "@/lib/workspace/design-mode";
import type { JobRecord } from "@/lib/jobs/types";
import { applyAppearance, readDensity, readTheme, type Density, type EditorTheme } from "@/lib/appearance";
import {
  DEFAULT_LAYOUT_PREFS,
  LAYOUT_PREFS_KEY,
  PANEL_SIZES_PREFIX,
  parseLayoutPrefs,
  type LayoutPrefs,
  type PreviewDock,
} from "@/lib/layout-prefs";

/** Real tsc on the staged change, for the margin: issues after and before, and parse errors after. */
export type TscFindings = {
  after: Record<string, string[]>;
  before: Record<string, string[]>;
  parse?: Record<string, string[]>;
};

const CREW_KEY = "aperture-crew";

function elementLabel(capture: DesignCapture): string {
  const id = capture.elementId ? `#${capture.elementId}` : "";
  const text = capture.text.replace(/\s+/g, " ").trim().slice(0, 60);
  return `${capture.tag}${id} ${capture.selector}${text ? ` "${text}"` : ""}`.replace(/\s+/g, " ").trim().slice(0, 180);
}

function readCrew(): string[] {
  if (typeof window === "undefined") return ["hosted"];
  try {
    const raw = window.localStorage.getItem(CREW_KEY);
    if (!raw) return ["hosted"];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) return ["hosted"];
    const ids = parsed.filter((x) => x.length > 0 && x.length < 80).slice(0, 6);
    return ids.length ? ids : ["hosted"];
  } catch {
    return ["hosted"];
  }
}

const RUN_SCRIPTS_KEY = "aperture-run-preview-scripts";

function readRunScripts(): boolean {
  try {
    return window.localStorage.getItem(RUN_SCRIPTS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistCrew(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CREW_KEY, JSON.stringify(ids));
  } catch {
    // quota
  }
}

export type MobilePane = "files" | "editor" | "agent";

type IdeUiState = {
  sidebarOpen: boolean;
  chatOpen: boolean;
  commandOpen: boolean;
  helpOpen: boolean;
  newFileOpen: boolean;
  githubOpen: boolean;
  inlineOpen: boolean;
  historyOpen: boolean;
  /** Real `tsc` on the staged change, per file: with the change, and as the files are now. For the margin. */
  tscFindings: TscFindings | null;
  /** The agent board: every run in this workspace, by stage. */
  boardOpen: boolean;
  /** Background jobs as the Composer panel last loaded them, so the board can show them too. */
  boardJobs: JobRecord[];
  debug: boolean;
  designOpen: boolean;
  codePeek: boolean;
  previewDock: PreviewDock;
  swapSides: boolean;
  /** Bumped by `resetLayout` so resizable groups remount at their default sizes. */
  layoutEpoch: number;
  /** The server answers Composer from recorded runs (APERTURE_MODEL=replay), not a model. */
  aiReplay: boolean;
  captures: DesignCapture[];
  previewErrors: string[];
  runPreviewScripts: boolean;
  mobilePane: MobilePane;
  theme: EditorTheme;
  density: Density;
  composerUnread: boolean;
  /** What the staged checks say, so Composer can suggest Apply or Open. */
  checkHint: { state: "running" | "clear" | "failed"; path?: string; detail?: string; prompt?: string } | null;
  /** Why ghost text is not showing. Empty when a suggestion arrived or none was asked for. */
  tabNote: string | null;
  /** The last failing check the user opened. */
  lastCheck: { label: string; detail: string } | null;
  /** The last page element the user clicked in Design Mode. */
  lastElement: string | null;
  reveal: { path: string; line: number } | null;
  findTick: number;
  steerQueue: string[];
  crewIds: string[];
  toggleSidebar: () => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setNewFileOpen: (open: boolean) => void;
  setGithubOpen: (open: boolean) => void;
  setInlineOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setBoardOpen: (open: boolean) => void;
  setTscFindings: (findings: TscFindings | null) => void;
  setBoardJobs: (jobs: JobRecord[]) => void;
  setDebug: (on: boolean) => void;
  setDesignOpen: (open: boolean) => void;
  setCodePeek: (open: boolean) => void;
  setPreviewDock: (dock: PreviewDock) => void;
  setSwapSides: (swap: boolean) => void;
  resetLayout: () => void;
  addCapture: (capture: DesignCapture) => void;
  setPreviewErrors: (errors: string[]) => void;
  setRunPreviewScripts: (on: boolean) => void;
  updateCapture: (id: string, patch: Partial<DesignCapture>) => void;
  removeCapture: (id: string) => void;
  clearCaptures: () => void;
  setMobilePane: (pane: MobilePane) => void;
  setTheme: (theme: EditorTheme) => void;
  setDensity: (density: Density) => void;
  setComposerUnread: (on: boolean) => void;
  setCheckHint: (hint: { state: "running" | "clear" | "failed"; path?: string; detail?: string; prompt?: string } | null) => void;
  setTabNote: (note: string | null) => void;
  setLastCheck: (check: { label: string; detail: string } | null) => void;
  setReveal: (reveal: { path: string; line: number } | null) => void;
  requestFind: () => void;
  enqueueSteer: (text: string) => void;
  shiftSteer: () => string | undefined;
  dropSteer: (index: number) => void;
  clearSteer: () => void;
  toggleCrew: (id: string) => void;
  setCrew: (ids: string[]) => void;
};

export const useIdeUi = create<IdeUiState>((set) => ({
  sidebarOpen: true,
  chatOpen: true,
  commandOpen: false,
  helpOpen: false,
  newFileOpen: false,
  githubOpen: false,
  inlineOpen: false,
  historyOpen: false,
  boardOpen: false,
  tscFindings: null,
  boardJobs: [],
  debug: false,
  designOpen: false,
  codePeek: false,
  previewDock: DEFAULT_LAYOUT_PREFS.previewDock,
  swapSides: DEFAULT_LAYOUT_PREFS.swapSides,
  layoutEpoch: 0,
  aiReplay: false,
  captures: [],
  previewErrors: [],
  runPreviewScripts: false,
  mobilePane: "editor",
  theme: "cursor",
  density: "compact",
  composerUnread: false,
  checkHint: null,
  tabNote: null,
  lastCheck: null,
  lastElement: null,
  reveal: null,
  findTick: 0,
  steerQueue: [],
  crewIds: ["hosted"],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatOpen: (open) => set((s) => ({ chatOpen: open, composerUnread: open ? false : s.composerUnread })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setNewFileOpen: (open) => set({ newFileOpen: open }),
  setGithubOpen: (open) => set({ githubOpen: open }),
  setInlineOpen: (open) => set({ inlineOpen: open }),
  setHistoryOpen: (open) => set({ historyOpen: open }),
  setBoardOpen: (open) => set({ boardOpen: open }),
  setTscFindings: (tscFindings) => set({ tscFindings }),
  setBoardJobs: (jobs) => set({ boardJobs: jobs }),
  setRunPreviewScripts: (on) => {
    // Off by default and remembered per browser: turning it on is a deliberate
    // act, so it should not silently reset, nor silently follow a shared link.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(RUN_SCRIPTS_KEY, on ? "1" : "0");
      } catch {
        // quota
      }
    }
    set({ runPreviewScripts: on, previewErrors: [] });
  },
  setDebug: (on) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("aperture-debug", on ? "1" : "0");
      } catch {
        // quota
      }
    }
    set({ debug: on });
  },
  // The preview opens beside the code (or wherever the user docked it); it no
  // longer hides the file tree, which made the editor feel like it vanished.
  setDesignOpen: (open) =>
    set((s) => ({
      designOpen: open,
      codePeek: false,
      mobilePane: open ? "editor" : s.mobilePane,
    })),
  setCodePeek: (open) => set({ codePeek: open }),
  setPreviewDock: (dock) => set({ previewDock: dock, codePeek: false }),
  setSwapSides: (swap) => set({ swapSides: swap }),
  resetLayout: () => {
    if (typeof window !== "undefined") {
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key?.startsWith(PANEL_SIZES_PREFIX)) keys.push(key);
        }
        for (const key of keys) window.localStorage.removeItem(key);
      } catch {
        // storage unavailable: the in-memory reset below still applies
      }
    }
    set((s) => ({ ...DEFAULT_LAYOUT_PREFS, codePeek: false, layoutEpoch: s.layoutEpoch + 1 }));
  },
  addCapture: (capture) =>
    set((s) => ({
      captures: [...s.captures, capture].slice(-8),
      lastElement: elementLabel(capture),
    })),
  setPreviewErrors: (errors) =>
    set((s) => {
      const next = [...new Set(errors.map((row) => row.trim()).filter(Boolean))].slice(0, 6);
      if (s.previewErrors.length === next.length && s.previewErrors.every((row, i) => row === next[i])) return s;
      return { previewErrors: next };
    }),
  updateCapture: (id, patch) =>
    set((s) => ({
      captures: s.captures.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  removeCapture: (id) => set((s) => ({ captures: s.captures.filter((c) => c.id !== id) })),
  clearCaptures: () => set({ captures: [] }),
  setMobilePane: (pane) =>
    set((s) => {
      const unread = pane === "agent" ? false : s.composerUnread;
      if (s.mobilePane === pane && s.composerUnread === unread) return s;
      return { mobilePane: pane, composerUnread: unread };
    }),
  setTheme: (theme) => {
    set((s) => {
      applyAppearance(theme, s.density);
      return { theme };
    });
  },
  setDensity: (density) => {
    set((s) => {
      applyAppearance(s.theme, density);
      return { density };
    });
  },
  setComposerUnread: (on) => set({ composerUnread: on }),
  setCheckHint: (hint) =>
    set((s) => {
      if (
        s.checkHint?.state === hint?.state &&
        s.checkHint?.path === hint?.path &&
        s.checkHint?.detail === hint?.detail &&
        s.checkHint?.prompt === hint?.prompt
      )
        return s;
      return { checkHint: hint };
    }),
  setTabNote: (note) =>
    set((s) => (s.tabNote === note ? s : { tabNote: note })),
  setLastCheck: (check) => set({ lastCheck: check }),
  setReveal: (reveal) => set({ reveal }),
  requestFind: () => set((s) => ({ findTick: s.findTick + 1 })),
  enqueueSteer: (text) =>
    set((s) => {
      const line = text.trim();
      if (!line) return s;
      return { steerQueue: [...s.steerQueue, line].slice(-5) };
    }),
  shiftSteer: () => {
    let first: string | undefined;
    set((s) => {
      first = s.steerQueue[0];
      return { steerQueue: s.steerQueue.slice(1) };
    });
    return first;
  },
  dropSteer: (index) => set((s) => ({ steerQueue: s.steerQueue.filter((_, i) => i !== index) })),
  clearSteer: () => set({ steerQueue: [] }),
  toggleCrew: (id) =>
    set((s) => {
      const on = s.crewIds.includes(id);
      const crewIds = on ? s.crewIds.filter((x) => x !== id) : [...s.crewIds, id].slice(0, 6);
      const next = crewIds.length ? crewIds : ["hosted"];
      persistCrew(next);
      return { crewIds: next };
    }),
  setCrew: (ids) => {
    const crewIds = ids.slice(0, 6);
    persistCrew(crewIds);
    set({ crewIds: crewIds.length ? crewIds : ["hosted"] });
  },
}));

function readLayoutPrefs(): LayoutPrefs {
  try {
    return parseLayoutPrefs(window.localStorage.getItem(LAYOUT_PREFS_KEY));
  } catch {
    return { ...DEFAULT_LAYOUT_PREFS };
  }
}

let layoutPersistence: (() => void) | null = null;

/** Save layout prefs whenever they change, however they were set (toggles, shortcuts, `setState`). */
function persistLayoutPrefs() {
  if (layoutPersistence) return;
  layoutPersistence = useIdeUi.subscribe((s, prev) => {
    if (
      s.sidebarOpen === prev.sidebarOpen &&
      s.chatOpen === prev.chatOpen &&
      s.previewDock === prev.previewDock &&
      s.swapSides === prev.swapSides
    ) {
      return;
    }
    const prefs: LayoutPrefs = {
      sidebarOpen: s.sidebarOpen,
      chatOpen: s.chatOpen,
      previewDock: s.previewDock,
      swapSides: s.swapSides,
    };
    try {
      window.localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // quota
    }
  });
}

export function hydrateAppearance() {
  const theme = readTheme();
  const density = readDensity();
  applyAppearance(theme, density);
  useIdeUi.setState({
    theme,
    density,
    crewIds: readCrew(),
    runPreviewScripts: readRunScripts(),
    ...readLayoutPrefs(),
  });
  persistLayoutPrefs();
}
