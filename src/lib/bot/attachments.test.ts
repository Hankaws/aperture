import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachedNote,
  FILE_LIMITS,
  fileName,
  isPicture,
  isTextFile,
  turnWithNote,
  validFiles,
  withFiles,
} from "./attachments.ts";
import { savedEntries } from "./chat-saved.ts";
import { titleOf } from "./my-bot.ts";
import { privateMessages } from "./private-chat.ts";

test("pictures and text files are told apart; anything else is neither", () => {
  assert.equal(isPicture("image/png"), true);
  assert.equal(isPicture("image/svg+xml"), false);
  assert.equal(isTextFile("notes.txt", "text/plain"), true);
  assert.equal(isTextFile("data.json", "application/json"), true);
  // No type from the browser: the name decides.
  assert.equal(isTextFile("app.tsx", ""), true);
  assert.equal(isTextFile("report.pdf", "application/pdf"), false);
  assert.equal(isTextFile("song.mp3", ""), false);
  assert.equal(fileName("  a\nb.txt "), "a b.txt");
  assert.equal(fileName("x".repeat(100)).length, 80);
});

test("text files are checked: how many, how long, alone and together", () => {
  assert.deepEqual(validFiles(undefined), { files: [] });
  assert.deepEqual(validFiles([{ name: "a.txt", text: "hi" }]), {
    files: [{ name: "a.txt", text: "hi" }],
  });
  assert.match(
    (validFiles(Array.from({ length: 4 }, () => ({ name: "a", text: "" }))) as { error: string })
      .error,
    /at most 3/,
  );
  assert.match(
    (
      validFiles([{ name: "big.txt", text: "x".repeat(FILE_LIMITS.chars + 1) }]) as {
        error: string;
      }
    ).error,
    /big\.txt is too long/,
  );
  const half = "x".repeat(FILE_LIMITS.chars);
  assert.match(
    (
      validFiles([
        { name: "a", text: half },
        { name: "b", text: half },
        { name: "c", text: "x" },
      ]) as { error: string }
    ).error,
    /too long together/,
  );
  assert.match((validFiles([{ name: 1 }]) as { error: string }).error, /could not be read/);
});

test("a file goes into its message fenced, so its own backticks cannot close it", () => {
  const text = withFiles("What does it do?", [{ name: "a.md", text: "Use ```js\nx()\n```" }]);
  assert.equal(text, 'What does it do?\n\nAttached file "a.md":\n````\nUse ```js\nx()\n```\n````');
  assert.equal(
    withFiles("", [{ name: "n.txt", text: "hi" }]).split("\n")[0],
    "Look at the attached file.",
  );
  assert.equal(withFiles("Hi", []), "Hi");
});

test("later turns say what came with a message; the newest carries it whole", () => {
  assert.equal(attachedNote([]), "");
  assert.equal(attachedNote(["a.png"]), "[They attached a.png]");
  assert.equal(attachedNote(["a.png", "b.txt"]), "[They attached 2 files: a.png, b.txt]");
  assert.equal(turnWithNote("Look", ["a.png"]), "Look\n[They attached a.png]");
  assert.equal(turnWithNote("", ["a.png"]), "[They attached a.png]");
  assert.equal(turnWithNote("Plain", undefined), "Plain");

  const image = { name: "a.png", mediaType: "image/png" as const, data: "AAAA" };
  const messages = privateMessages(
    [
      { role: "user", text: "Earlier\n[They attached old.png]" },
      { role: "assistant", text: "Seen." },
      { role: "user", text: "And this?\n[They attached a.png, n.txt]" },
    ],
    "2026-11-20",
    null,
    null,
    { images: [image], files: [{ name: "n.txt", text: "notes" }] },
  );
  const turns = messages.filter((m) => m.role !== "system");
  assert.equal(turns[0]!.images, undefined);
  assert.deepEqual(turns[2]!.images, [image]);
  assert.match(
    String(turns[2]!.content),
    /^And this\?\n\[They attached a\.png, n\.txt\]\n\nAttached file "n\.txt":\n```\nnotes\n```$/,
  );
  // Nothing attached: no message carries anything.
  const plain = privateMessages([{ role: "user", text: "Hi" }], "2026-11-20");
  assert.equal(plain.at(-1)!.images, undefined);
  assert.equal(plain.at(-1)!.content, "Hi");
});

test("what a message came with is kept by name, and names a chat begun with it", () => {
  const [entry] = savedEntries([
    { id: "1", role: "user", text: "", files: ["a.png", 7, "x".repeat(200)] },
  ]);
  assert.deepEqual(entry, { id: "1", role: "user", text: "", files: ["a.png", "x".repeat(120)] });
  assert.equal(titleOf([{ id: "1", role: "user", text: "", files: ["photo.png"] }]), "photo.png");
  assert.equal(
    titleOf([{ id: "1", role: "user", text: "What is this?", files: ["photo.png"] }]),
    "What is this?",
  );
});
