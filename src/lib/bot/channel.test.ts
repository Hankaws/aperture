import assert from "node:assert/strict";
import { test } from "node:test";
import { channel } from "./channel.ts";

test("a channel yields what is pushed, in order, waiting while empty, until closed", async () => {
  const ch = channel<number>();
  ch.push(1);
  const read = (async () => {
    const got: number[] = [];
    for await (const n of ch) got.push(n);
    return got;
  })();
  await new Promise((r) => setTimeout(r, 5));
  ch.push(2);
  ch.push(3);
  await new Promise((r) => setTimeout(r, 5));
  ch.close();
  // Pushed after closing: dropped.
  ch.push(4);
  assert.deepEqual(await read, [1, 2, 3]);
});

test("what was pushed before the close is still read after it", async () => {
  const ch = channel<string>();
  ch.push("a");
  ch.push("b");
  ch.close();
  const got: string[] = [];
  for await (const s of ch) got.push(s);
  assert.deepEqual(got, ["a", "b"]);
});
