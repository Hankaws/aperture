import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Entry } from "./chat-saved.ts";
import type { Query } from "./memory-store.ts";
import {
  CHAT_ID,
  chatGroups,
  cleanTitle,
  likePattern,
  snippetOf,
  chatKey,
  chatOf,
  cleanBotName,
  FIRST_CHAT,
  greetingFor,
  localChatKey,
  myBotFrom,
  newChatId,
  suggestedBot,
  titleOf,
} from "./my-bot.ts";
import {
  deleteChat,
  getMyBot,
  listChats,
  renameChat,
  saveChat,
  saveMyBot,
  searchChats,
} from "./my-bot-store.ts";
import { privateSystem } from "./private-chat.ts";

test("a bot's name is cleaned, and a face that will not do falls back", () => {
  assert.equal(cleanBotName("  Nova   the\n Great!! "), "Nova the Great");
  assert.equal(cleanBotName("Ünal-Bot 2"), "Ünal-Bot 2");
  assert.equal(cleanBotName("<script>"), "script");
  assert.equal(cleanBotName("!!!"), null);
  assert.equal(cleanBotName(42), null);
  assert.equal(cleanBotName("x".repeat(50))?.length, 30);
  assert.deepEqual(myBotFrom({ name: "Nova", mascot: { color: "nope" } })?.mascot.color, "violet");
  assert.equal(myBotFrom({ name: "" }), null);
  // The same person is offered the same bot each time.
  assert.deepEqual(suggestedBot("user-1"), suggestedBot("user-1"));
});

test("a bot named by its person is told its name", () => {
  assert.match(privateSystem("2026-11-19", "Nova"), /^You are Nova, the person's own assistant/);
  assert.match(privateSystem("2026-11-19"), /^You are Aperture Bot, /);
});

test("conversations are keyed from the person's own id, and only theirs are theirs", () => {
  const id = newChatId();
  assert.match(id, CHAT_ID);
  assert.equal(chatKey("ada", FIRST_CHAT), "private:ada");
  assert.equal(chatKey("ada", id), `private:ada:${id}`);
  assert.equal(chatOf("ada", `private:ada:${id}`), id);
  assert.equal(chatOf("ada", "private:ada"), FIRST_CHAT);
  assert.equal(chatOf("ada", `private:eve:${id}`), null);
  assert.equal(chatOf("ada", "private:ada:../x"), null);
  assert.equal(localChatKey(FIRST_CHAT), "private");
  assert.equal(localChatKey(id), `private:${id}`);
});

test("a chat is titled by its first question, and listed by day", () => {
  const entries: Entry[] = [
    { id: "1", role: "assistant", text: "Hi" },
    { id: "2", role: "user", text: "  **Plan** my\nweek  " },
    { id: "3", role: "user", text: "Later" },
  ];
  assert.equal(titleOf(entries), "Plan my week");
  assert.equal(titleOf([{ id: "1", role: "user", text: "x".repeat(80) }]).length, 60);
  assert.equal(titleOf([]), "");
  const now = new Date("2026-11-19T15:00:00").getTime();
  const at = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const groups = chatGroups(
    [
      { id: "a", title: "Old", updatedAt: at(24 * 30) },
      { id: "b", title: "Now", updatedAt: at(1) },
      { id: "c", title: "Last night", updatedAt: at(20) },
      { id: "d", title: "Monday", updatedAt: at(24 * 3) },
    ],
    now,
  );
  assert.deepEqual(
    groups.map((g) => [g.label, g.chats.map((c) => c.id)]),
    [
      ["Today", ["b"]],
      ["Yesterday", ["c"]],
      ["Previous 7 days", ["d"]],
      ["Older", ["a"]],
    ],
  );
  assert.equal(greetingFor(8), "Good morning");
  assert.equal(greetingFor(14), "Good afternoon");
  assert.equal(greetingFor(22), "Good evening");
  assert.equal(greetingFor(2), "Good evening");
});

async function database(): Promise<{ q: Query; close: () => Promise<void> }> {
  const pg = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  return {
    q: async (text, params) => (await pg.query<Record<string, unknown>>(text, params)).rows,
    close: () => pg.close(),
  };
}

test("each person's bot and chats are theirs alone, kept with their titles", async () => {
  const { q, close } = await database();
  try {
    assert.equal(await getMyBot(q, "ada"), null);
    await saveMyBot(q, "ada", {
      name: "Nova",
      mascot: { color: "teal", body: "drop", face: "wink" },
    });
    assert.deepEqual(await getMyBot(q, "ada"), {
      name: "Nova",
      mascot: { color: "teal", body: "drop", face: "wink" },
    });
    assert.equal(await saveMyBot(q, "ada", { name: "!!" }), null);
    assert.equal(await getMyBot(q, "eve"), null);

    const ask = (text: string): Entry[] => [{ id: text, role: "user", text }];
    // The private chat as it was before there were many: listed, its title from its question.
    await q(`insert into user_bot_chats (bot_id, user_id, entries) values ($1, $2, $3)`, [
      "private:ada",
      "ada",
      JSON.stringify(ask("From before")),
    ]);
    await saveChat(q, "ada", "aaaaaaaaaaaa", ask("Plan my week"));
    // Its title stays its first question's, whatever comes later.
    await saveChat(q, "ada", "aaaaaaaaaaaa", [...ask("Plan my week"), ...ask("And next week")]);
    await saveChat(q, "ada", "bbbbbbbbbbbb", []);
    await saveChat(q, "eve", "cccccccccccc", ask("Eve's"));
    // A team bot's chat is not one of these.
    await q(`insert into user_bot_chats (bot_id, user_id, entries) values ($1, $2, $3)`, [
      "abcdefabcdef",
      "ada",
      JSON.stringify(ask("Team")),
    ]);
    const listed = await listChats(q, "ada");
    assert.deepEqual(listed.map((c) => [c.id, c.title]).sort(), [
      ["aaaaaaaaaaaa", "Plan my week"],
      [FIRST_CHAT, "From before"],
    ]);
    // Eve cannot reach Ada's: her key is made from her own id.
    await saveChat(q, "eve", "aaaaaaaaaaaa", ask("Overwrite"));
    assert.equal(
      (await listChats(q, "ada")).find((c) => c.id === "aaaaaaaaaaaa")?.title,
      "Plan my week",
    );
    await deleteChat(q, "eve", "aaaaaaaaaaaa");
    assert.equal((await listChats(q, "ada")).length, 2);
    await deleteChat(q, "ada", "aaaaaaaaaaaa");
    assert.deepEqual(
      (await listChats(q, "ada")).map((c) => c.id),
      [FIRST_CHAT],
    );
  } finally {
    await close();
  }
});

test("a title as typed is one line, cut short, and never empty", () => {
  assert.equal(cleanTitle("  Week\n plan  "), "Week plan");
  assert.equal(cleanTitle("   "), null);
  assert.equal(cleanTitle(7), null);
  assert.equal(cleanTitle("x".repeat(90))?.length, 60);
  // What was typed is searched for as it is: its wildcards are plain.
  assert.equal(likePattern("50%_off\\"), "%50\\%\\_off\\\\%");
});

test("a search shows the words in a little of what was said", () => {
  const entries: Entry[] = [
    { id: "1", role: "user", text: "Plan my week" },
    {
      id: "2",
      role: "assistant",
      text: "Here is a plan. On **Wednesday** review progress with the whole team, then ship one thing on Friday.",
    },
  ];
  assert.equal(snippetOf(entries, "plan"), "Plan my week");
  assert.equal(
    snippetOf(entries, "wednesday"),
    "Here is a plan. On Wednesday review progress with the whole team, then ship…",
  );
  assert.equal(
    snippetOf(
      [
        {
          id: "3",
          role: "assistant",
          text: "Monday: clear the inbox and pick three goals. Wednesday: review it.",
        },
      ],
      "wednesday",
    ),
    "…pick three goals. Wednesday: review it.",
  );
  assert.equal(snippetOf(entries, "holiday"), null);
  assert.equal(snippetOf(entries, "  "), null);
});

test("chats are found by their words and renamed, and only their person's", async () => {
  const { q, close } = await database();
  try {
    const said = (user: string, bot: string): Entry[] => [
      { id: "u", role: "user", text: user },
      { id: "a", role: "assistant", text: bot },
    ];
    await saveChat(q, "ada", "aaaaaaaaaaaa", said("Plan my week", "Monday: inbox. Friday: ship."));
    await saveChat(
      q,
      "ada",
      "bbbbbbbbbbbb",
      said("Write an email", "Dear Grace, thanks for 50% off."),
    );
    await saveChat(q, "eve", "cccccccccccc", said("Eve's week", "Friday: rest."));

    const found = async (text: string) => (await searchChats(q, "ada", text)).map((h) => h.id);
    assert.deepEqual(await found("friday"), ["aaaaaaaaaaaa"]);
    assert.deepEqual(await found("EMAIL"), ["bbbbbbbbbbbb"]);
    // A wildcard is a character: "50%" finds the chat that says it, not every chat.
    assert.deepEqual(await found("50%"), ["bbbbbbbbbbbb"]);
    assert.deepEqual(await found("%"), ["bbbbbbbbbbbb"]);
    // Words in the stored data that are not what was said (its keys) find nothing.
    assert.deepEqual(await found("assistant"), []);
    assert.deepEqual(await found("   "), []);
    const [hit] = await searchChats(q, "ada", "inbox");
    assert.equal(hit!.snippet, "Monday: inbox. Friday: ship.");

    // Renamed: the new title stays, through the next save too, and is searched.
    assert.equal(await renameChat(q, "ada", "aaaaaaaaaaaa", "  Week   ahead "), true);
    await saveChat(q, "ada", "aaaaaaaaaaaa", said("Plan my week", "And Saturday."));
    assert.equal(
      (await listChats(q, "ada")).find((c) => c.id === "aaaaaaaaaaaa")?.title,
      "Week ahead",
    );
    assert.deepEqual(await found("ahead"), ["aaaaaaaaaaaa"]);
    // Not to nothing, and not someone else's.
    assert.equal(await renameChat(q, "ada", "aaaaaaaaaaaa", "   "), false);
    assert.equal(await renameChat(q, "eve", "aaaaaaaaaaaa", "Mine now"), false);
    assert.equal(
      (await listChats(q, "ada")).find((c) => c.id === "aaaaaaaaaaaa")?.title,
      "Week ahead",
    );
  } finally {
    await close();
  }
});
