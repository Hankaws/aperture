/**
 * Reads a public pull request for the check page (`public-check.ts` judges
 * it), with nothing from GitHub's API when it can: the pull request's page
 * for its title and state, its `.diff`, and files from
 * raw.githubusercontent.com at `refs/pull/N/head`. A server with no token
 * gets 60 API calls an hour, shared with whoever else is on its address,
 * so the API is only a fallback for the diff. Server-only.
 *
 * A result is kept for ten minutes per pull request, so a shared link
 * opened many times reads GitHub once.
 */
import { getRequest } from "@tanstack/react-start/server";
import type { CheckRow } from "@/lib/workspace/checks";
import { agentOf } from "@/lib/bot/scorecard";
import { verdictOf, type Verdict } from "./check-summary";
import { assemble, firstReads, importProbes, PUBLIC_LIMITS, publicRows } from "./public-check";
import { parseDiff } from "./pull-diff";
import { pullPageFacts, type PullLink } from "./pull-link";
import { tsParseCheck, type ParseCheck } from "@/lib/workspace/ts-parse";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const KEEP_MS = 10 * 60_000;
const KEEP_MAX = 200;
const CONCURRENCY = 12;
const DIFF_BYTES = 8_000_000;
const AGENT = "aperture-public-check";

export type PublicPull = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  /** The agent that wrote it, when one did. */
  agent: string | null;
  state: "open" | "closed" | "merged" | null;
  changedFiles: number;
};

export type PublicCheckResult =
  | {
      ok: true;
      pull: PublicPull;
      rows: CheckRow[];
      verdict: Verdict;
      notChecked: string[];
      /** What the result cannot see, in a sentence each. */
      notes: string[];
      checkedAt: string;
    }
  | { ok: false; error: string };

/** The caller's address, for a signed-out visitor's rate limit. Vercel sets the first `x-forwarded-for` entry. */
export function callerAddress(): string {
  try {
    const request = getRequest();
    const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || request?.headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: { "User-Agent": AGENT, ...headers },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return null;
  }
}

/** A body as text when it is no bigger than `max`, else null. */
async function textOf(res: Response | null, max: number): Promise<string | null> {
  if (!res || res.status !== 200) return null;
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > max) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > max || bytes.subarray(0, 8_000).includes(0)) return null;
  return new TextDecoder().decode(bytes);
}

type DiffGot = { text: string } | { error: "missing" | "limited" | "large" | "failed" };

async function readDiff(link: PullLink, token: string | null): Promise<DiffGot> {
  const { owner, repo, number } = link;
  const plain = await get(`https://github.com/${owner}/${repo}/pull/${number}.diff`);
  if (plain?.status === 200) {
    const text = await textOf(plain, DIFF_BYTES);
    return text === null ? { error: "large" } : { text };
  }
  // The diff host refused or could not be reached: the API serves the same diff.
  const api = await get(`${API}/repos/${owner}/${repo}/pulls/${number}`, {
    Accept: "application/vnd.github.diff",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (!api) return { error: "failed" };
  if (api.status === 200) {
    const text = await textOf(api, DIFF_BYTES);
    return text === null ? { error: "large" } : { text };
  }
  if (
    (api.status === 403 || api.status === 429) &&
    api.headers.get("x-ratelimit-remaining") === "0"
  )
    return { error: "limited" };
  if (api.status === 404 || plain?.status === 404) return { error: "missing" };
  if (api.status === 406 || api.status === 422) return { error: "large" };
  return { error: "failed" };
}

function rawUrl(link: PullLink, path: string): string {
  const file = path.split("/").map(encodeURIComponent).join("/");
  return `${RAW}/${link.owner}/${link.repo}/refs/pull/${link.number}/head/${file}`;
}

function readOne(link: PullLink, path: string): Promise<string | null> {
  return get(rawUrl(link, path)).then((res) => textOf(res, PUBLIC_LIMITS.fileBytes));
}

/** A script's text to judge it by; any other file only needs to be there (an image is imported, not read). */
const SCRIPT_PATH = /\.(?:[cm]?[jt]sx?|json)$/i;

/** What an import finds at `path`: the text, "" for a file that is there but not text (an image), or null. */
async function lookFor(link: PullLink, path: string): Promise<string | null> {
  const res = await get(rawUrl(link, path));
  if (!res || res.status !== 200) return null;
  if (SCRIPT_PATH.test(path)) return textOf(res, PUBLIC_LIMITS.fileBytes);
  await res.body?.cancel();
  return "";
}

/** Each path's text at the pull request's head; a path that is not there, or not text, is left out. */
async function readAll(link: PullLink, paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++]!;
      const text = await readOne(link, path);
      if (text !== null) out[path] = text;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, paths.length) }, worker));
  return out;
}

/** The first of `candidates` that is there, in order: where resolution would find the import. */
async function firstThere(link: PullLink, candidates: string[]): Promise<[string, string] | null> {
  for (let i = 0; i < candidates.length; i += 4) {
    const batch = candidates.slice(i, i + 4);
    const texts = await Promise.all(batch.map((path) => lookFor(link, path)));
    const at = texts.findIndex((text) => text !== null);
    if (at !== -1) return [batch[at]!, texts[at]!];
  }
  return null;
}

let tsParser: Promise<ParseCheck | undefined> | undefined;
/** TypeScript's parser, loaded once and only when the fast parser reports an error: the compiler is large. */
function loadParser(): Promise<ParseCheck | undefined> {
  tsParser ??= import("typescript").then(
    (mod) => tsParseCheck(mod.default ?? mod),
    () => undefined,
  );
  return tsParser;
}

const kept = new Map<string, { at: number; result: PublicCheckResult }>();

export async function readAndCheck(
  asked: PullLink,
  token: string | null,
): Promise<PublicCheckResult> {
  const key = `${asked.owner}/${asked.repo}#${asked.number}`.toLowerCase();
  const now = Date.now();
  const hit = kept.get(key);
  if (hit && now - hit.at < KEEP_MS) return hit.result;

  const pageUrl = `https://github.com/${asked.owner}/${asked.repo}/pull/${asked.number}`;
  const readPage = () => get(pageUrl).then((res) => textOf(res, 5_000_000));
  const [first, diffGot] = await Promise.all([readPage(), readDiff(asked, token)]);
  // The page is only for the title, author and state: one more try when GitHub did not serve it.
  const page = first ?? (await readPage());
  const facts = page ? pullPageFacts(page, asked.number) : null;
  if ("error" in diffGot) {
    const error =
      diffGot.error === "missing"
        ? `GitHub shows no public pull request #${asked.number} in ${asked.owner}/${asked.repo}. Private repositories cannot be checked here: add Agent Check to them instead.`
        : diffGot.error === "large"
          ? "This pull request's diff is too big to read here. Agent Check reads any size in the repository's own CI."
          : diffGot.error === "limited"
            ? "GitHub is not serving this pull request's diff right now and its hourly limit for reads without a token is used up. Try again later."
            : "Could not read that pull request from GitHub. Try again in a moment.";
    return { ok: false, error };
  }
  const link: PullLink = facts
    ? { owner: facts.owner, repo: facts.repo, number: asked.number }
    : asked;

  const diff = parseDiff(diffGot.text);
  const assembled = assemble(diff, await readAll(link, firstReads(diff)));
  const probes = importProbes(assembled);
  const looked = probes.slice(0, PUBLIC_LIMITS.importProbes);
  const found = await Promise.all(looked.map((probe) => firstThere(link, probe.candidates)));
  for (const hit of found) if (hit) assembled.known[hit[0]] = hit[1];
  // A JavaScript module's types may be declared beside it (`server.js`, `server.d.ts`): read those too.
  const typings = found
    .map((hit) => hit && /\.(?:m|c)?jsx?$/.exec(hit[0]) && hit[0])
    .filter((path): path is string => Boolean(path))
    .map((path) =>
      path.replace(/\.(m|c)?jsx?$/, (_, kind: string | undefined) => `.d.${kind ?? ""}ts`),
    );
  Object.assign(assembled.known, await readAll(link, typings));
  const partial = probes.length > looked.length;
  let rows = publicRows({ diff, assembled, partial });
  // The fast parser lags behind TypeScript; before a parse error is called red, TypeScript's own parser must agree.
  if (rows.some((row) => row.id === "parse" && row.status === "fail")) {
    const parse = await loadParser();
    if (parse) rows = publicRows({ diff, assembled, partial, parse });
  }

  const notes: string[] = [];
  if (diff.length > PUBLIC_LIMITS.changedFiles)
    notes.push(
      `This page reads the first ${PUBLIC_LIMITS.changedFiles} of the ${diff.length} changed files.`,
    );
  if (partial)
    notes.push(
      `The change imports more files than this page looks for (${PUBLIC_LIMITS.importProbes}); the rest are not judged.`,
    );
  const result: PublicCheckResult = {
    ok: true,
    pull: {
      owner: link.owner,
      repo: link.repo,
      number: link.number,
      title: facts?.title.slice(0, 300) ?? `Pull request #${link.number}`,
      author: facts?.author ?? "",
      agent: facts ? agentOf({ author: facts.author, body: facts.body }) : null,
      state: facts?.state ?? null,
      changedFiles: diff.length,
    },
    rows,
    verdict: verdictOf(rows),
    notChecked: assembled.notChecked,
    notes,
    checkedAt: new Date(now).toISOString(),
  };
  if (kept.size >= KEEP_MAX) kept.delete(kept.keys().next().value!);
  kept.set(key, { at: now, result });
  return result;
}
