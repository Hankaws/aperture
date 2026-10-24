import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "../security/redact.ts";
import { REDACTED_LINE_NOTE, restoreRedacted } from "./unredact.ts";
import type { ProposedEdit } from "../workspace/types.ts";

const KEY = 'const apiKey = "sk-live-abcdefghijklmnop1234";';
const real = `${KEY}\nexport function Login() {\n  return <button>Sign in</button>;\n}\n`;

function edit(oldText: string, newText: string, over: Partial<ProposedEdit> = {}): ProposedEdit {
  return {
    id: "e1",
    path: "src/login.tsx",
    oldText,
    newText,
    description: "Rename",
    status: "pending",
    ...over,
  };
}

test("an edit made on the redacted copy keeps the real line it did not touch", () => {
  const shown = redactSecrets(real);
  assert.notEqual(shown, real);
  const [out] = restoreRedacted([edit(shown, shown.replace("Sign in", "Log in"))], {
    "src/login.tsx": real,
  });
  assert.equal(out!.oldText, real);
  assert.equal(out!.newText, real.replace("Sign in", "Log in"));
  assert.ok(!out!.newText.includes("[redacted"));
  assert.equal(out!.notes, undefined);
});

test("two edits to one file both keep the real line", () => {
  const shown = redactSecrets(real);
  const first = shown.replace("Sign in", "Log in");
  const second = first.replace("Login()", "SignIn()");
  const out = restoreRedacted([edit(shown, first), edit(first, second, { id: "e2" })], {
    "src/login.tsx": real,
  });
  assert.equal(out[0]!.newText, real.replace("Sign in", "Log in"));
  assert.equal(out[1]!.oldText, out[0]!.newText);
  assert.equal(out[1]!.newText, real.replace("Sign in", "Log in").replace("Login()", "SignIn()"));
});

test("a follow-up's edit, folded onto a staged one, keeps the real line", () => {
  // The staged edit holds real text; the loop folds the follow-up into it, keeping its oldText.
  const staged = edit(real, real.replace("Sign in", "Log in"), { id: "p1" });
  const followed = redactSecrets(staged.newText).replace("Login()", "SignIn()");
  const [out] = restoreRedacted([edit(real, followed, { id: "e2" })], { "src/login.tsx": real }, [
    staged,
  ]);
  assert.equal(out!.oldText, real);
  assert.equal(out!.newText, real.replace("Sign in", "Log in").replace("Login()", "SignIn()"));
});

test("a staged edit sent back unchanged stays as it is", () => {
  const staged = edit(real, real.replace("Sign in", "Log in"), { id: "p1" });
  const [out] = restoreRedacted([staged], { "src/login.tsx": real }, [staged]);
  assert.equal(out!.newText, staged.newText);
  assert.equal(out!.notes, undefined);
});

test("an edit that rewrites the hidden line is blocked with a note on that line", () => {
  const shown = redactSecrets(real);
  const changed = shown.replace(
    /^const apiKey = .*$/m,
    'const apiKey = "[redacted]"; // rotate me',
  );
  const [out] = restoreRedacted([edit(shown, changed)], { "src/login.tsx": real });
  assert.equal(out!.newText, changed);
  assert.equal(out!.notes?.length, 1);
  assert.equal(out!.notes![0]!.text, REDACTED_LINE_NOTE);
  assert.equal(out!.notes![0]!.type, "add");
  assert.match(out!.notes![0]!.excerpt, /rotate me/);
  // Seen twice (a streamed update, then done), it still has one note.
  assert.equal(restoreRedacted(out ? [out] : [], { "src/login.tsx": real })[0]!.notes?.length, 1);
});

test("edits on files with nothing redacted, or changed for another reason, pass through", () => {
  const plain = "export const a = 1;\n";
  const same = edit(plain, "export const a = 2;\n", { path: "src/a.ts" });
  assert.equal(restoreRedacted([same], { "src/a.ts": plain })[0], same);
  const stale = edit("something else\n", "x\n");
  assert.equal(restoreRedacted([stale], { "src/login.tsx": real })[0], stale);
});

test("a new file and a removed file pass through", () => {
  const created = edit("", "export {};\n", { path: "src/new.ts" });
  const removed = edit(redactSecrets(real), "", { deleted: true });
  const out = restoreRedacted([created, removed], { "src/login.tsx": real });
  assert.equal(out[0], created);
  assert.equal(out[1], removed);
});

test("a private key block above an edit comes back whole", () => {
  const pem =
    'const pem = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----`;\n\nexport const label = "Sign in";\n';
  const shown = redactSecrets(pem);
  const [out] = restoreRedacted(
    [edit(shown, shown.replace("Sign in", "Log in"), { path: "src/k.ts" })],
    { "src/k.ts": pem },
  );
  assert.equal(out!.newText, pem.replace("Sign in", "Log in"));
});
