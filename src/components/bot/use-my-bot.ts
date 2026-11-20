import { useCallback, useEffect, useState } from "react";
import { clearSavedChat } from "@/lib/bot/chat-saved";
import {
  deleteMyChat,
  loadMyBot,
  pinMyChat,
  renameMyChat,
  saveMyBot,
  searchMyChats,
} from "@/lib/bot/my-bot.api";
import {
  CHAT_ID,
  cleanTitle,
  localChatKey,
  MAX_PINNED,
  myBotFrom,
  snippetOf,
  type ChatHit,
  type ChatMeta,
  type MyBot,
} from "@/lib/bot/my-bot";
import { loadChat } from "@/lib/bot/chat-saved";

/** This browser's copy of the person's bot and their list of chats: what shows at once, and all a visitor has. */
const BOT_KEY = "aperture-my-bot";
const CHATS_KEY = "aperture-my-chats";
/** Sent when the bot is named or changed, so its bubble shows it on every page. */
export const MY_BOT_EVENT = "aperture:my-bot";

/** The bot as this browser last saw it; null before it is named, or with storage blocked. */
export function readLocalBot(): MyBot | null {
  try {
    return myBotFrom(JSON.parse(window.localStorage.getItem(BOT_KEY) ?? "null"));
  } catch {
    return null;
  }
}

/** The bot as this browser knows it, kept in step when it is named or changed anywhere on the page. */
export function useLocalBot(): MyBot | null {
  const [bot, setBot] = useState<MyBot | null>(null);
  useEffect(() => {
    const read = () => setBot(readLocalBot());
    read();
    window.addEventListener(MY_BOT_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(MY_BOT_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return bot;
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or blocked storage: it lasts as long as the page.
  }
}

function readLocalChats(): ChatMeta[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHATS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((c: Record<string, unknown>) =>
      typeof c?.id === "string" &&
      CHAT_ID.test(c.id) &&
      typeof c.title === "string" &&
      typeof c.updatedAt === "string"
        ? [
            {
              id: c.id,
              title: c.title.slice(0, 80),
              updatedAt: c.updatedAt,
              ...(c.pinned === true ? { pinned: true } : {}),
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}

/**
 * A chat kept from elsewhere (the bot over a page): this browser's list gets
 * it, at the top, keeping a title and pin it already has. The account lists
 * it anyway; a visitor's list is this one.
 */
export function noteLocalChat(meta: ChatMeta) {
  const now = readLocalChats();
  const known = now.find((c) => c.id === meta.id);
  writeLocal(CHATS_KEY, [
    known ? { ...meta, title: known.title, pinned: known.pinned } : meta,
    ...now.filter((c) => c.id !== meta.id),
  ]);
}

/**
 * The person's own bot (`my-bot.ts`) and their chats with it: kept on the
 * account, and in this browser too, which is all a visitor has.
 */
export function useMyBot() {
  const [bot, setBot] = useState<MyBot | null>(null);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  /** Read: the account answered, or there is none to ask. */
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState(false);

  useEffect(() => {
    let cancel = false;
    setBot(readLocalBot());
    setChats(readLocalChats());
    void loadMyBot()
      .then((out) => {
        if (cancel || !out.ok) return;
        setAccount(true);
        // The account's wins: a bot named on another device shows here too.
        if (out.bot) {
          setBot(out.bot);
          writeLocal(BOT_KEY, out.bot);
        }
        setChats(out.chats);
        writeLocal(CHATS_KEY, out.chats);
      })
      .catch(() => {
        // Offline: this browser's copy stands.
      })
      .finally(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  /** Names the bot, or changes it; null when the account turned it down, with why. */
  const save = useCallback(
    async (next: MyBot): Promise<string | null> => {
      if (account) {
        const out = await saveMyBot({ data: next }).catch((e: unknown) => ({
          ok: false as const,
          error: e instanceof Error ? e.message : "Could not save your bot.",
        }));
        if (!out.ok) return out.error;
        next = out.bot;
      }
      setBot(next);
      writeLocal(BOT_KEY, next);
      window.dispatchEvent(new CustomEvent(MY_BOT_EVENT));
      return null;
    },
    [account],
  );

  /** A chat was kept: it goes to the top of the list, keeping the title it has (a rename stays). */
  const noteChat = useCallback((meta: ChatMeta) => {
    setChats((now) => {
      const known = now.find((c) => c.id === meta.id);
      const next = [
        known ? { ...meta, title: known.title, pinned: known.pinned } : meta,
        ...now.filter((c) => c.id !== meta.id),
      ];
      writeLocal(CHATS_KEY, next);
      return next;
    });
  }, []);

  /** Deletes a chat for good, here and on the account. */
  const removeChat = useCallback(async (id: string) => {
    setChats((now) => {
      const next = now.filter((c) => c.id !== id);
      writeLocal(CHATS_KEY, next);
      return next;
    });
    clearSavedChat(localChatKey(id));
    await deleteMyChat({ data: { chat: id } }).catch(() => {});
  }, []);

  /** Pins a chat to the top of the list, or unpins it, here and on the account; the error when turned down. */
  const pinChat = useCallback(
    async (id: string, pinned: boolean): Promise<string | null> => {
      if (pinned && chats.filter((c) => c.pinned && c.id !== id).length >= MAX_PINNED)
        return `You can pin ${MAX_PINNED} chats. Unpin one first.`;
      const set = (to: boolean) =>
        setChats((now) => {
          const next = now.map((c) => (c.id === id ? { ...c, pinned: to || undefined } : c));
          writeLocal(CHATS_KEY, next);
          return next;
        });
      set(pinned);
      const out = await pinMyChat({ data: { chat: id, pinned } }).catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not pin it.",
      }));
      if (out.ok) return null;
      set(!pinned);
      return out.error;
    },
    [chats],
  );

  /** Renames a chat, here and on the account; the error when the account turned it down. */
  const renameChat = useCallback(async (id: string, raw: string): Promise<string | null> => {
    const title = cleanTitle(raw);
    if (!title) return "Give it a title with something in it.";
    const out = await renameMyChat({ data: { chat: id, title } }).catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "Could not rename it.",
    }));
    if (!out.ok) return out.error;
    setChats((now) => {
      const next = now.map((c) => (c.id === id ? { ...c, title } : c));
      writeLocal(CHATS_KEY, next);
      return next;
    });
    return null;
  }, []);

  /**
   * Chats with these words in the title or in what was said: the account's,
   * or, for a visitor, this browser's.
   */
  const search = useCallback(
    async (text: string): Promise<ChatHit[]> => {
      const words = text.trim();
      if (!words) return [];
      if (account) {
        const out = await searchMyChats({ data: { text: words } }).catch(() => null);
        if (out?.ok) return out.hits;
      }
      const lower = words.toLowerCase();
      return chats.flatMap((c) => {
        const snippet = snippetOf(loadChat(localChatKey(c.id)), words);
        if (snippet !== null) return [{ ...c, snippet }];
        return c.title.toLowerCase().includes(lower) ? [{ ...c, snippet: "" }] : [];
      });
    },
    [account, chats],
  );

  return { bot, chats, loaded, account, save, noteChat, removeChat, renameChat, pinChat, search };
}
