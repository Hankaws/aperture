import { create } from "zustand";
import type { DesignCapture } from "@/lib/workspace/design-mode";

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
  captures: DesignCapture[];
  mobilePane: MobilePane;
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
  addCapture: (capture: DesignCapture) => void;
  updateCapture: (id: string, patch: Partial<DesignCapture>) => void;
  removeCapture: (id: string) => void;
  clearCaptures: () => void;
  setMobilePane: (pane: MobilePane) => void;
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
  captures: [],
  mobilePane: "editor",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),
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
  setDesignOpen: (open) => set((s) => ({ designOpen: open, mobilePane: open ? "editor" : s.mobilePane })),
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
  setMobilePane: (pane) => set({ mobilePane: pane }),
}));
