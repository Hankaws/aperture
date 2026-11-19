import assert from "node:assert/strict";
import { test } from "node:test";
import { liveText, readPrivateChat, type PrivateChatEvent } from "./private-chat-stream.ts";

/** A streamed answer as the server sends it, cut into chunks at awkward places. */
function streamed(events: PrivateChatEvent[], cut = 7): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += cut) controller.enqueue(bytes.slice(i, i + cut));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}

test("a streamed answer passes on its text as it comes, then the reply", async () => {
  const pieces: string[] = [];
  const out = await readPrivateChat(
    streamed([
      { type: "text", text: "Héllo, " },
      { type: "text", text: "wörld" },
      {
        type: "done",
        reply: "Héllo, wörld",
        memories: [{ id: "a", text: "Likes tea", status: "pending", at: "" }],
      },
    ]),
    (t) => pieces.push(t),
  );
  assert.deepEqual(pieces, ["Héllo, ", "wörld"]);
  assert.equal(out.ok, true);
  assert.equal(out.ok && out.reply, "Héllo, wörld");
  assert.equal(out.ok && out.memories.length, 1);
});

test("an error in the stream, a refusal, or a cut-off stream is never an answer", async () => {
  const none = () => {};
  assert.deepEqual(
    await readPrivateChat(
      streamed([
        { type: "text", text: "Half" },
        { type: "error", error: "Key refused" },
      ]),
      none,
    ),
    { ok: false, error: "Key refused" },
  );
  assert.deepEqual(await readPrivateChat(streamed([{ type: "text", text: "Half" }]), none), {
    ok: false,
    error: "The answer was cut off. Try again.",
  });
  assert.deepEqual(
    await readPrivateChat(
      Response.json({ error: "Sign in to talk to the bot." }, { status: 401 }),
      none,
    ),
    { ok: false, error: "Sign in to talk to the bot." },
  );
  assert.deepEqual(await readPrivateChat(new Response("Forbidden", { status: 403 }), none), {
    ok: false,
    error: "The bot could not answer (403).",
  });
});

test("an answer being written hides its memory lines and any half-written marker", () => {
  assert.equal(liveText("Noted. [[remember: Likes tea]]"), "Noted.");
  assert.equal(liveText("Done.\n[[ask: What next?]]\n[[ask: Wh"), "Done.");
  assert.equal(liveText("Noted.\n[[remember: Likes"), "Noted.");
  assert.equal(liveText("Go here:\n[[go:mod"), "Go here:");
  assert.equal(liveText("Go here:\n["), "Go here:");
  // A whole button marker stays, for the reply's own button.
  assert.equal(liveText("Go here:\n[[go:model-key]]"), "Go here:\n[[go:model-key]]");
  // Brackets in prose are left alone.
  assert.equal(liveText("Use arr[0] here"), "Use arr[0] here");
});
