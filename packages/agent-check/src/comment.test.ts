import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { CheckRow } from "../../../src/lib/workspace/checks.ts";
import { refusalNote, upsertComment } from "./comment.ts";
import { parseOptions, pullFromEvent } from "./main.ts";
import {
  badgeMarkdown,
  checkLink,
  commentMarkdown,
  COMMENT_MARKER,
  summaryMarkdown,
} from "./report.ts";

const pull = { repo: "acme/shop", number: 42 };
const meta = { changed: 3, deleted: 0, notChecked: [] };
const red: CheckRow[] = [
  { id: "parse", label: "Parses", status: "pass", detail: "3 files parse." },
  {
    id: "imports",
    label: "Imports resolve",
    status: "fail",
    detail: 'src/cart.ts: imports "./prices" | at line 1',
    evidence: "everything",
  },
];
const clear: CheckRow[] = [
  { id: "parse", label: "Parses", status: "pass", detail: "3 files parse." },
];

test("the badge says how it went and links the pull request on Aperture", () => {
  assert.equal(checkLink(pull), "https://aperturesais.grok.me/check?pr=acme/shop/42");
  assert.equal(
    badgeMarkdown("clear", pull),
    "[![Checked by Aperture: nothing red](https://aperturesais.grok.me/badges/agent-check-clear.svg)](https://aperturesais.grok.me/check?pr=acme/shop/42)",
  );
  // A push has no pull request: the badge links Aperture itself.
  assert.match(
    badgeMarkdown("red", null),
    /agent-check-red\.svg\)\]\(https:\/\/aperturesais\.grok\.me\)$/,
  );
  assert.match(
    summaryMarkdown(clear, meta, pull),
    /^### Aperture Agent Check\n\n\[!\[Checked by Aperture: nothing red\]/,
  );
  // A push, or the bot's reply, has no pull request to link: no badge.
  assert.match(
    summaryMarkdown(clear, meta),
    /^### Aperture Agent Check\n\nNothing red on 3 changed files\./,
  );
});

test("the comment carries its marker, the badge, the verdict, a row per check and both links", () => {
  const body = commentMarkdown(red, meta, pull, "https://github.com/acme/shop/actions/runs/7");
  const lines = body.split("\n");
  assert.equal(lines[0], COMMENT_MARKER);
  assert.match(lines[1]!, /^\[!\[Checked by Aperture: held back\]/);
  assert.match(body, /\*\*1 check red on 3 changed files\. Do not merge this as it is\.\*\*/);
  // A pipe in a detail does not break the table.
  assert.match(
    body,
    /\| ✗ \| Imports resolve \| src\/cart\.ts: imports "\.\/prices" \\\| at line 1 \|/,
  );
  assert.match(
    body,
    /\[Everything it found\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/7\) · \[Check any pull request on Aperture\]\(https:\/\/aperturesais\.grok\.me\/check\?pr=acme\/shop\/42\)\n$/,
  );
  assert.doesNotMatch(body, /everything$/m);
});

test("the pull request comes from the event; a push has none", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-check-event-"));
  const pr = join(dir, "pr.json");
  writeFileSync(
    pr,
    JSON.stringify({ pull_request: { number: 42 }, repository: { full_name: "acme/shop" } }),
  );
  const push = join(dir, "push.json");
  writeFileSync(push, JSON.stringify({ before: "abc", repository: { full_name: "acme/shop" } }));
  assert.deepEqual(pullFromEvent(pr), pull);
  assert.deepEqual(pullFromEvent(join(dir, "missing.json")), null);
  assert.equal(pullFromEvent(push), null);
  assert.equal(pullFromEvent(undefined), null);
});

test("the comment is off unless asked for, and takes the workflow's token", () => {
  const off = parseOptions([], { INPUT_BASE: "main" });
  assert.equal(off.comment, false);
  const on = parseOptions([], {
    INPUT_BASE: "main",
    INPUT_COMMENT: "true",
    "INPUT_GITHUB-TOKEN": "t0k",
  });
  assert.equal(on.comment, true);
  assert.equal(on.token, "t0k");
  assert.equal(parseOptions(["--comment"], { INPUT_BASE: "main" }).comment, true);
});

type Call = { url: string; method: string; body?: string };

function fakeGithub(existing: Array<{ id: number; body: string }>, status = 200) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    const call = {
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
    };
    calls.push(call);
    if (status !== 200) return new Response("{}", { status });
    if (call.method === "GET") return Response.json(existing);
    return Response.json({ id: 9 }, { status: call.method === "POST" ? 201 : 200 });
  }) as typeof fetch;
  return { calls, impl };
}

const target = { api: "https://api.github.com", token: "t0k", ...pull };

test("the first run posts the comment; later runs update the same one", async () => {
  const first = fakeGithub([{ id: 1, body: "Looks good to me" }]);
  assert.deepEqual(await upsertComment(target, `${COMMENT_MARKER}\nnew`, first.impl), {
    ok: true,
    action: "created",
  });
  assert.deepEqual(
    first.calls.map((c) => [c.method, c.url]),
    [
      ["GET", "https://api.github.com/repos/acme/shop/issues/42/comments?per_page=100&page=1"],
      ["POST", "https://api.github.com/repos/acme/shop/issues/42/comments"],
    ],
  );
  const later = fakeGithub([
    { id: 1, body: "Looks good to me" },
    { id: 5, body: `${COMMENT_MARKER}\nold` },
  ]);
  assert.deepEqual(await upsertComment(target, `${COMMENT_MARKER}\nnew`, later.impl), {
    ok: true,
    action: "updated",
  });
  assert.deepEqual(later.calls.at(-1), {
    url: "https://api.github.com/repos/acme/shop/issues/comments/5",
    method: "PATCH",
    body: JSON.stringify({ body: `${COMMENT_MARKER}\nnew` }),
  });
});

test("a refusal or a network failure says how to fix it and never throws", async () => {
  const refused = fakeGithub([], 403);
  const outcome = await upsertComment(target, "x", refused.impl);
  assert.equal(outcome.ok, false);
  assert.match(!outcome.ok ? outcome.note : "", /permissions: pull-requests: write/);
  assert.match(refusalNote(401), /did not accept the token/);
  const down = (async () => {
    throw new Error("getaddrinfo ENOTFOUND api.github.com");
  }) as unknown as typeof fetch;
  const failed = await upsertComment(target, "x", down);
  assert.deepEqual(failed, {
    ok: false,
    note: "Not posted: getaddrinfo ENOTFOUND api.github.com. The checks above are unaffected.",
  });
});
