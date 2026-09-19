import { create } from "zustand";
import type { DesignCapture } from "@/lib/workspace/design-mode";
import { applyAppearance, readDensity, readTheme, type Density, type EditorTheme } from "@/lib/appearance";

const CREW_KEY = "aperture-crew";

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
  debug: boolean;
  designOpen: boolean;
  codePeek: boolean;
  captures: DesignCapture[];
  mobilePane: MobilePane;
  theme: EditorTheme;
  density: Density;
  composerUnread: boolean;
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
  setDebug: (on: boolean) => void;
  setDesignOpen: (open: boolean) => void;
  setCodePeek: (open: boolean) => void;
  addCapture: (capture: DesignCapture) => void;
  updateCapture: (id: string, patch: Partial<DesignCapture>) => void;
  removeCapture: (id: string) => void;
  clearCaptures: () => void;
  setMobilePane: (pane: MobilePane) => void;
  setTheme: (theme: EditorTheme) => void;
  setDensity: (density: Density) => void;
  setComposerUnread: (on: boolean) => void;
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
  debug: false,
  designOpen: false,
  codePeek: false,
  captures: [],
  mobilePane: "editor",
  theme: "cursor",
  density: "compact",
  composerUnread: false,
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
  setDesignOpen: (open) => set((s) => ({ designOpen: open, codePeek: open ? false : s.codePeek, mobilePane: open ? "editor" : s.mobilePane })),
  setCodePeek: (open) => set({ codePeek: open }),
  addCapture: (capture) =>
    set((s) => ({
      captures: [...s.captures, capture].slice(-8),
    })),
  updateCapture: (id, patch) =>
    set((s) => ({
      captures: s.captures.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  removeCapture: (id) => set((s) => ({ captures: s.captures.filter((c) => c.id !== id) })),
  clearCaptures: () => set({ captures: [] }),
  setMobilePane: (pane) => set((s) => ({ mobilePane: pane, composerUnread: pane === "agent" ? false : s.composerUnread })),
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

export function hydrateAppearance() {
  const theme = readTheme();
  const density = readDensity();
  applyAppearance(theme, density);
  useIdeUi.setState({ theme, density, crewIds: readCrew() });
}
