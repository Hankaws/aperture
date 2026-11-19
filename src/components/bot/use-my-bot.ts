import { useCallback, useEffect, useState } from "react";
import { clearSavedChat } from "@/lib/bot/chat-saved";
import { deleteMyChat, loadMyBot, saveMyBot } from "@/lib/bot/my-bot.api";
import { CHAT_ID, localChatKey, myBotFrom, type ChatMeta, type MyBot } from "@/lib/bot/my-bot";

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
        ? [{ id: c.id, title: c.title.slice(0, 80), updatedAt: c.updatedAt }]
        : [],
    );
  } catch {
    return [];
  }
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

  /** A chat was kept: it goes to the top of the list. */
  const noteChat = useCallback((meta: ChatMeta) => {
    setChats((now) => {
      const next = [meta, ...now.filter((c) => c.id !== meta.id)];
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

  return { bot, chats, loaded, account, save, noteChat, removeChat };
}
