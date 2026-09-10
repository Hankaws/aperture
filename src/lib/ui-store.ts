import { create } from "zustand";

export type MobilePane = "files" | "editor" | "agent";

type IdeUiState = {
  sidebarOpen: boolean;
  chatOpen: boolean;
  commandOpen: boolean;
  helpOpen: boolean;
  newFileOpen: boolean;
  githubOpen: boolean;
  inlineOpen: boolean;
  mobilePane: MobilePane;
  toggleSidebar: () => void;
  toggleChat: () => void;
  setCommandOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setNewFileOpen: (open: boolean) => void;
  setGithubOpen: (open: boolean) => void;
  setInlineOpen: (open: boolean) => void;
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
  mobilePane: "editor",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setNewFileOpen: (open) => set({ newFileOpen: open }),
  setGithubOpen: (open) => set({ githubOpen: open }),
  setInlineOpen: (open) => set({ inlineOpen: open }),
  setMobilePane: (pane) => set({ mobilePane: pane }),
}));
