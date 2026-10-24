import assert from "node:assert/strict";
import test from "node:test";
import { TAB_PREFIX_CHARS, TAB_SUFFIX_CHARS, tabContext } from "./tab-context.ts";

test("a key near the cursor is redacted before Tab sends it", () => {
  const context = tabContext(
    "src/config.ts",
    'const apiKey = "sk-live-abcdefghijklmnop1234";\nconst x = ',
    ";",
  );
  assert.ok(context);
  assert.doesNotMatch(context.prefix, /sk-live-abcdefghijklmnop1234/);
  assert.match(context.prefix, /\[redacted\]/);
});

test("plain code goes out as it is", () => {
  const code = "function add(a, b) {\n  return a + b;\n}\n";
  assert.deepEqual(tabContext("src/add.ts", code, "\nexport { add };"), {
    prefix: code,
    suffix: "\nexport { add };",
  });
});

test("only the window around the cursor is sent: the end of the prefix, the start of the suffix", () => {
  const prefix = "a".repeat(4000) + "b".repeat(1000);
  const suffix = "c".repeat(400) + "d".repeat(600);
  const context = tabContext("src/long.ts", prefix, suffix)!;
  assert.equal(context.prefix.length, TAB_PREFIX_CHARS);
  assert.ok(context.prefix.endsWith("b".repeat(1000)));
  assert.equal(context.suffix, "c".repeat(TAB_SUFFIX_CHARS));
});

test("a private key cut by the window sends nothing; a whole one is redacted", () => {
  const cut = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\nconst x = ";
  assert.equal(tabContext("src/keys.ts", cut, ""), null);
  const whole =
    "const pem = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----`;\nconst y = ";
  const context = tabContext("src/keys.ts", whole, "");
  assert.ok(context);
  assert.match(context.prefix, /\[redacted private key\]/);
  assert.doesNotMatch(context.prefix, /MIIEvQIBADANBgkqhkiG9w0BAQEFAASC/);
});

test("a secret file sends nothing", () => {
  assert.equal(tabContext(".env", "TOKEN=abcdefgh", ""), null);
});
