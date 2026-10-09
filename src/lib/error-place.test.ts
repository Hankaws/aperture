import assert from "node:assert/strict";
import { test } from "node:test";
import { errorPlace } from "./error-place.ts";

const withStack = (stack: string) => Object.assign(new TypeError("l is not a function"), { stack });

test("the first frames, as function and file:line:column without the host", () => {
  const error = withStack(
    [
      "TypeError: l is not a function",
      "    at _e (https://aperturesais.grok.me/assets/bot-CVly78hs.js:1:23456)",
      "    at Ii (https://aperturesais.grok.me/assets/react-dom-AbC123.js:9:4567)",
      "    at https://aperturesais.grok.me/assets/react-dom-AbC123.js:9:999",
      "    at Xo (https://aperturesais.grok.me/assets/react-dom-AbC123.js:9:111)",
    ].join("\n"),
  );
  assert.deepEqual(errorPlace(error), [
    "_e bot-CVly78hs.js:1:23456",
    "Ii react-dom-AbC123.js:9:4567",
    "react-dom-AbC123.js:9:999",
  ]);
});

test("Safari's frames and a dev server's query strings read the same", () => {
  const error = withStack(
    "_e@https://aperturesais.grok.me/assets/bot-CVly78hs.js:1:23456\nhttp://127.0.0.1:8080/src/components/bot/bot-chat.tsx?t=17:12:5",
  );
  assert.deepEqual(errorPlace(error), ["_e bot-CVly78hs.js:1:23456", "bot-chat.tsx:12:5"]);
});

test("nothing to show without a stack", () => {
  assert.deepEqual(errorPlace("a string"), []);
  assert.deepEqual(errorPlace(withStack("TypeError: l is not a function")), []);
  assert.deepEqual(errorPlace(null), []);
});
