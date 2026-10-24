import assert from "node:assert/strict";
import test from "node:test";
import { redactSecrets, sanitizeFileMap } from "./redact.ts";

const CODE = "src/a.ts";

const MUST_REDACT: Array<[line: string, path: string | undefined, secret: string]> = [
  ['const apiKey = "sk-live-abcdefghijklmnop1234";', CODE, "sk-live-abcdefghijklmnop1234"],
  ["  password: 'correct horse battery'", CODE, "correct horse battery"],
  ['client_secret: "abc123def456"', CODE, "abc123def456"],
  ["secret_key = 'django-insecure-1234567890'", CODE, "django-insecure-1234567890"],
  ['export AUTH_TOKEN="tok_1234567890abcdef"', CODE, "tok_1234567890abcdef"],
  [
    'headers: { Authorization: "Bearer abcdefghijklmnopqrstuvwxyz0123" }',
    CODE,
    "abcdefghijklmnopqrstuvwxyz0123",
  ],
  [
    "fetch(url, { headers: { Authorization: `Bearer ${token}` }, auth: 'Bearer abcdefghijklmnopqrstuvwxyz0123' })",
    CODE,
    "abcdefghijklmnopqrstuvwxyz0123",
  ],
  ['const t = "ghp_abcdefghijklmnopqrstuvwxyz0123";', CODE, "ghp_abcdefghijklmnopqrstuvwxyz0123"],
  ['  "password": "hunter2hunter2",', "config.json", "hunter2hunter2"],
  ["PASSWORD=hunter2hunter2", ".env.example", "hunter2hunter2"],
  ["DB_PASSWORD=pa55w0rd!", ".env.example", "pa55w0rd!"],
  ["      POSTGRES_PASSWORD: s3cretpass", "docker-compose.yml", "s3cretpass"],
  ["log in with password: hunter2hunter2", undefined, "hunter2hunter2"],
];

const MUST_KEEP = [
  "{setup.secret === null && !setup.isAdmin",
  "const secret = setup.workflow?.secret ?? PROVIDER_SECRET[provider];",
  "const headers = { Authorization: `Bearer ${token}` };",
  'placeholder="Bearer token, optional"',
  "  password: string;",
  'const [form, setForm] = useState({ email: "", password: "" });',
  'apiKey: decryptSecret(row.custom_key) ?? "",',
  'const password = form.get("password");',
  'autoComplete={mode === "up" ? "new-password" : "current-password"}',
  "const auth = useAuth();",
  "if (isSecret = true) {}",
  '"Protected by this deployment\'s sign-in secret: if that changes, keys have to be added again."',
  "if (workflow?.secret) secret = names.includes(workflow.secret);",
  "clientSecret: grokClientSecret as string,",
  '  "sign-in-secret": "Protected by this deployment\'s sign-in secret: if that changes, keys have to be added again.",',
  'export const APP_KEY_SECRET = "APERTURE_BOT_PRIVATE_KEY";',
];

test("secrets are hidden", () => {
  for (const [line, path, secret] of MUST_REDACT) {
    const out = redactSecrets(line, path);
    assert.ok(!out.includes(secret), `${line} -> ${out}`);
    assert.match(out, /\[redacted\]/, line);
  }
});

test("ordinary code is left as it is", () => {
  for (const line of MUST_KEEP) assert.equal(redactSecrets(line, CODE), line);
});

test("a quoted secret keeps its quotes, so the line still parses", () => {
  assert.equal(redactSecrets('password: "hunter2hunter2"', CODE), 'password: "[redacted]"');
  assert.equal(
    redactSecrets("const apiKey = 'abcdefgh123';", CODE),
    "const apiKey = '[redacted]';",
  );
});

test("in code, a bare value is an expression; elsewhere it may be the secret", () => {
  assert.equal(redactSecrets("password = hunter2hunter2", CODE), "password = hunter2hunter2");
  assert.equal(redactSecrets("password = hunter2hunter2", "app.ini"), "password = [redacted]");
  assert.equal(redactSecrets("PASSWORD=${DB_PASSWORD}", ".env.example"), "PASSWORD=${DB_PASSWORD}");
  assert.equal(redactSecrets("secret: true", "config.yml"), "secret: true");
});

test("a private key block is hidden whole", () => {
  const pem =
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----";
  assert.equal(redactSecrets(`const k = \`${pem}\`;`, CODE), "const k = `[redacted private key]`;");
});

test("redacting twice gives the same text as once", () => {
  for (const [line, path] of MUST_REDACT) {
    const once = redactSecrets(line, path);
    assert.equal(redactSecrets(once, path), once, line);
  }
});

test("sanitizeFileMap drops secret files and redacts by each file's kind", () => {
  const out = sanitizeFileMap({
    ".env": "TOKEN=abcdefgh",
    "src/a.ts": "const password = readPassword();\nconst apiKey = 'abcdefgh123';",
    "app.ini": "password = hunter2hunter2",
  });
  assert.deepEqual(Object.keys(out).sort(), ["app.ini", "src/a.ts"]);
  assert.equal(out["src/a.ts"], "const password = readPassword();\nconst apiKey = '[redacted]';");
  assert.equal(out["app.ini"], "password = [redacted]");
});
