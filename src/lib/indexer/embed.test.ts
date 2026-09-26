import assert from "node:assert/strict";
import test from "node:test";
import { stem, tokenize } from "./embed.ts";

test("inflections fold onto one stem, applied the same to query and code", () => {
  const pairs = [
    ["keys", "key"], ["plans", "plan"], ["devices", "device"], ["turns", "turn"],
    ["saved", "save"], ["saving", "save"], ["typing", "type"], ["libraries", "library"],
    ["applied", "apply"], ["running", "run"], ["matches", "match"], ["files", "file"],
  ];
  for (const [a, b] of pairs) assert.equal(stem(a!), stem(b!), `${a} vs ${b}`);
});

test("a trailing s that is not a plural is left alone", () => {
  for (const word of ["class", "status", "analysis"]) {
    assert.equal(stem(word), word, word);
  }
});

test("short tokens are not stemmed", () => {
  assert.equal(stem("is"), "is");
  assert.equal(stem("api"), "api");
});

test("camelCase and snake_case both split", () => {
  assert.deepEqual(tokenize("redactSecrets"), ["redact", "secret"]);
  // Underscores used to survive, leaving `api_key` one opaque token.
  assert.deepEqual(tokenize("api_key"), ["api", "key"]);
});

test("question words, keywords and bare numbers carry no signal", () => {
  assert.deepEqual(tokenize("where does the function return 404"), []);
  assert.deepEqual(tokenize("how do we import profiles from db"), ["profil", "db"]);
});

test("known collision: settings and set share a stem", () => {
  // Recorded, not endorsed. If the stemmer changes, this should fail so the
  // change is a decision rather than an accident; see the note on `stem`.
  assert.equal(stem("settings"), stem("set"));
});
