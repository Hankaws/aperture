import { create } from "zustand";
import type { CodeRef } from "./code-refs";
import { IDLE_COMPOSER, type ComposerStatus } from "./composer-status";
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
  /**
   * What the editor shows now, read when a message is sent, with the files
   * the bot asked to read (`[[read: …]]`); null when it cannot say.
   */
  context: (asked?: string[]) => Promise<EditorContext | null>;
  /** Hands an instruction to Composer, which makes the change and checks it before Apply. */
  toComposer: (instruction: string) => void;
  /**
   * A place in the code an answer names (`code-refs.ts`), as a way to open it
   * in the editor at that line; null when the project has no such file.
   */
  open: (ref: CodeRef) => (() => void) | null;
  /** Applies Composer's checked change, as its own Apply does: only when every check passed. True when it did. */
  apply: () => boolean;
  /** Puts Composer's change away, as its own Discard does. */
  discard: () => void;
  /** Shows Composer, where the change and its checks are in full. */
  showComposer: () => void;
};

type SummonState = {
  open: boolean;
  /** Which of the person's chats it carries on; null until first opened. */
  chat: string | null;
  editor: EditorBridge | null;
  /** Which file and lines the editor shows, as they change. */
  peek: EditorPeek | null;
  /** What Composer is doing, for the change the bot handed it. */
  composer: ComposerStatus;
  /** Grown to fill the window, over the page it is on. */
  expanded: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** A fresh conversation, kept with the others. */
  newChat: () => void;
  /** Carries on one of the person's other conversations, a pinned one say. */
  setChat: (chat: string) => void;
  setEditor: (editor: EditorBridge | null) => void;
  setPeek: (peek: EditorPeek | null) => void;
  setComposer: (composer: ComposerStatus) => void;
  toggleExpanded: () => void;
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
  composer: IDLE_COMPOSER,
  expanded: false,
  setOpen: (open) => set((s) => (open ? { open, chat: chatFor(s.chat) } : { open })),
  toggle: () => set((s) => (s.open ? { open: false } : { open: true, chat: chatFor(s.chat) })),
  newChat: () => {
    const chat = newChatId();
    keepChat(chat);
    set({ chat });
  },
  setChat: (chat) => {
    if (!CHAT_ID.test(chat)) return;
    keepChat(chat);
    set({ chat });
  },
  setEditor: (editor) =>
    set(editor ? { editor } : { editor: null, peek: null, composer: IDLE_COMPOSER }),
  setPeek: (peek) => set({ peek }),
  setComposer: (composer) => set({ composer }),
  toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
}));
