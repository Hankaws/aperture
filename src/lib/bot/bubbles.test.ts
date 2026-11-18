import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addBubble,
  greetingFor,
  keepKnown,
  MAX_BOT_BUBBLES,
  NO_BUBBLES,
  PRIVATE_BUBBLE,
  readBubbles,
  removeBubble,
} from "./bubbles.ts";

const [A, B, C, D, E, Z] = ["a", "b", "c", "d", "e", "z"].map((x) => x.repeat(12));

test("a new bot's bubble comes first, and only the newest few stay", () => {
  let state = NO_BUBBLES;
  for (const id of [A!, B!, C!, D!]) state = addBubble(state, id);
  assert.deepEqual(state.ids, [D, C, B]);
  assert.equal(state.ids.length, MAX_BOT_BUBBLES);
  // Made again (or reopened): it moves to the front, not twice.
  assert.deepEqual(addBubble(state, B!).ids, [B, D, C]);
  // Aperture Bot's own bubble is always there, never one of these.
  assert.equal(addBubble(state, PRIVATE_BUBBLE), state);
  assert.equal(addBubble(state, "not an id!"), state);
});

test("closing a bubble, and a bot deleted elsewhere, take it away", () => {
  const state = { ids: [A!, B!, C!], greeted: true };
  assert.deepEqual(removeBubble(state, B!), { ids: [A, C], greeted: true });
  assert.deepEqual(keepKnown(state, [C!, A!, Z!]).ids, [A, C]);
  assert.equal(keepKnown(state, [A!, B!, C!]), state, "unchanged: the same object");
});

test("what storage held is read safely: anything odd is no bubbles", () => {
  assert.deepEqual(readBubbles({ ids: [A, A, 3, "b c", "short", D], greeted: true }), {
    ids: [A, D],
    greeted: true,
  });
  assert.deepEqual(readBubbles({ ids: [A, B, C, D, E] }).ids, [A, B, C]);
  for (const odd of [null, "x", 1, [], { ids: "a" }])
    assert.deepEqual(readBubbles(odd), NO_BUBBLES, JSON.stringify(odd));
});

test("a bubble says hello as it pops up", () => {
  assert.equal(greetingFor("Nova"), "Hi, I'm Nova! Tap me to chat, from any page.");
  assert.match(greetingFor(null), /^Hi! I'm Aperture Bot\. .*how to make your first bot\.$/);
});
