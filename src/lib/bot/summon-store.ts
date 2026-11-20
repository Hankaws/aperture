import { create } from "zustand";
import type { EditorContext, EditorPeek } from "./editor-context";
import { CHAT_ID, newChatId } from "./my-bot";

/** The conversation the summoned bot carries on, in this browser, across pages and visits. */
const CHAT_KEY = "aperture-summon-chat";

/**
 * What the editor lends the summoned bot while it is open: what it shows,
 * and Composer. Registered by the editor, so the rest of the site never
 * loads the editor's code.
 */
export type EditorBridge = {
  /** What the editor shows now, read when a message is sent; null when it cannot say. */
  context: () => Promise<EditorContext | null>;
  /** Hands an instruction to Composer, which makes the change and checks it before Apply. */
  toComposer: (instruction: string) => void;
};

type SummonState = {
  open: boolean;
  /** Which of the person's chats it carries on; null until first opened. */
  chat: string | null;
  editor: EditorBridge | null;
  /** Which file and lines the editor shows, as they change. */
  peek: EditorPeek | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** A fresh conversation, kept with the others. */
  newChat: () => void;
  setEditor: (editor: EditorBridge | null) => void;
  setPeek: (peek: EditorPeek | null) => void;
};

function readChat(): string | null {
  try {
    const kept = window.localStorage.getItem(CHAT_KEY);
    return kept && CHAT_ID.test(kept) ? kept : null;
  } catch {
    return null;
  }
}

function keepChat(chat: string) {
  try {
    window.localStorage.setItem(CHAT_KEY, chat);
  } catch {
    // Storage blocked: a new one next visit.
  }
}

function chatFor(now: string | null): string {
  const chat = now ?? readChat() ?? newChatId();
  keepChat(chat);
  return chat;
}

/** Your bot over any page (Ctrl/⌘+J): `summon.tsx`. */
export const useSummon = create<SummonState>((set) => ({
  open: false,
  chat: null,
  editor: null,
  peek: null,
  setOpen: (open) => set((s) => (open ? { open, chat: chatFor(s.chat) } : { open })),
  toggle: () => set((s) => (s.open ? { open: false } : { open: true, chat: chatFor(s.chat) })),
  newChat: () => {
    const chat = newChatId();
    keepChat(chat);
    set({ chat });
  },
  setEditor: (editor) => set(editor ? { editor } : { editor: null, peek: null }),
  setPeek: (peek) => set({ peek }),
}));
