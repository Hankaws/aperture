import assert from "node:assert/strict";
import { test } from "node:test";
import { readCapped } from "./read-capped.ts";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://example.test/api/mcp", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);

test("a body within the cap reads whole, multi-byte text included", async () => {
  assert.equal(await readCapped(post('{"a":"héllo ✓"}'), 100), '{"a":"héllo ✓"}');
  assert.equal(await readCapped(post(""), 10), "");
});

test("a declared size over the cap is refused before anything is read", async () => {
  let pulled = false;
  // highWaterMark 0: the stream asks for data only when it is read.
  const body = new ReadableStream(
    {
      pull() {
        pulled = true;
      },
    },
    { highWaterMark: 0 },
  );
  assert.equal(await readCapped(post(body, { "content-length": "1000" }), 10), null);
  assert.equal(pulled, false);
});

test("a stream that runs past the cap stops there, whatever it declared", async () => {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent += 1;
      controller.enqueue(new Uint8Array(1024));
      if (sent > 1000) controller.close();
    },
  });
  assert.equal(await readCapped(post(body), 4096), null);
  // It stopped after the cap, not after the 1 MB the stream would have sent.
  assert.ok(sent < 20, `pulled ${sent} chunks`);
});
