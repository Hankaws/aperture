import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { reencryptSecrets, SECRET_COLUMNS, type Query } from "./reencrypt.ts";
import { legacyKey, openSecret, sealSecret, secretsKey } from "./secret-box.ts";

const legacy = legacyKey("fixture-sign-in-secret");
const current = secretsKey("a-secrets-key-of-at-least-thirty-two-characters");
const previous = secretsKey("the-previous-secrets-key-also-thirty-two-plus-chars");
const keys = { legacy, current, previous };
const v1 = (plain: string) => sealSecret(plain, { legacy, current: null, previous: null });

// One database for the file: starting PGLite is most of the test's time.
let shared: Promise<{ pg: PGlite; query: Query }> | null = null;
function database() {
  shared ??= open();
  return shared;
}

async function open() {
  const pg = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  const query: Query = async (text, params) =>
    (await pg.query<Record<string, unknown>>(text, params)).rows;
  return { pg, query };
}

test("every saved secret moves under the secrets key; the unreadable one is left and counted", async () => {
  const { query } = await database();
  await query(
    `insert into user_settings (user_id, plan, usage_month, grok_key, openai_key, anthropic_key, gemini_key, deepseek_key, custom_key, github_token, mcp_json)
     values ($1, 'hobby', '2026-10', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      "user-a",
      v1("xai-grok-key-0001"),
      "sk-plaintext-from-before-encryption",
      v1("sk-ant-anthropic-0003"),
      sealSecret("AIza-gemini-0004", { legacy, current: previous, previous: null }),
      sealSecret("sk-deepseek-0005", { legacy, current, previous: null }),
      v1("custom-token-ending-in:ab:"),
      v1("ghp_github_token_0007"),
      v1(
        JSON.stringify([
          { id: "m1", name: "linear", url: "https://mcp.linear.app/mcp", token: "lin_0008" },
        ]),
      ),
    ],
  );
  const lost = sealSecret("sk-written-under-another-secret", {
    legacy: legacyKey("some-other-secret"),
    current: null,
    previous: null,
  });
  await query(
    `insert into user_settings (user_id, plan, usage_month, openai_key) values ('user-b', 'hobby', '2026-10', $1)`,
    [lost],
  );
  await query(
    `insert into user_agents (id, user_id, name, kind, endpoint, token_enc) values ('agent-1', 'user-a', 'Claude', 'acp', 'https://agent.example', $1)`,
    [v1("agent-token-0009")],
  );

  const first = await reencryptSecrets(query, keys);
  assert.deepEqual(first, { changed: 8, unreadable: 1 });

  const onlyCurrent = { legacy: legacyKey("a-rotated-sign-in-secret"), current, previous: null };
  const [a] = await query(`select * from user_settings where user_id = 'user-a'`, []);
  const [agent] = await query(`select token_enc from user_agents where id = 'agent-1'`, []);
  const read = (v: unknown) => openSecret(String(v), onlyCurrent);
  assert.equal(read(a!.grok_key), "xai-grok-key-0001");
  assert.equal(read(a!.openai_key), "sk-plaintext-from-before-encryption");
  assert.equal(read(a!.anthropic_key), "sk-ant-anthropic-0003");
  assert.equal(read(a!.gemini_key), "AIza-gemini-0004");
  assert.equal(read(a!.deepseek_key), "sk-deepseek-0005");
  assert.equal(read(a!.custom_key), "custom-token-ending-in:ab:");
  assert.equal(read(a!.github_token), "ghp_github_token_0007");
  assert.match(String(read(a!.mcp_json)), /lin_0008/);
  assert.equal(read(agent!.token_enc), "agent-token-0009");
  const [b] = await query(`select openai_key from user_settings where user_id = 'user-b'`, []);
  assert.equal(b!.openai_key, lost);

  assert.deepEqual(await reencryptSecrets(query, keys), { changed: 0, unreadable: 1 });
});

test("a value changed between the sweep's read and its write keeps the change", async () => {
  const { pg, query } = await database();
  await query(
    `insert into user_settings (user_id, plan, usage_month, grok_key) values ('user-c', 'hobby', '2026-10', $1)`,
    [v1("xai-old-key")],
  );
  const saved = sealSecret("xai-new-key-the-user-just-saved", { legacy, current, previous: null });
  // The user saves a new key right after the sweep reads the row.
  const racing: Query = async (text, params) => {
    const rows = await query(text, params);
    if (text.startsWith("select") && text.includes("grok_key") && rows.length > 0) {
      await query(`update user_settings set grok_key = $1 where user_id = 'user-c'`, [saved]);
    }
    return rows;
  };
  // user-b's unreadable openai_key from the first test is still counted.
  assert.deepEqual(await reencryptSecrets(racing, keys), { changed: 0, unreadable: 1 });
  const [row] = await query(`select grok_key from user_settings where user_id = 'user-c'`, []);
  assert.equal(row!.grok_key, saved);
  await pg.close();
});

test("the sweep covers every encrypted column the schema has", () => {
  const covered = new Set(SECRET_COLUMNS.map((c) => `${c.table}.${c.column}`));
  for (const name of [
    "grok_key",
    "openai_key",
    "anthropic_key",
    "gemini_key",
    "deepseek_key",
    "custom_key",
    "github_token",
    "mcp_json",
  ]) {
    assert.ok(covered.has(`user_settings.${name}`), name);
  }
  assert.ok(covered.has("user_agents.token_enc"));
});
