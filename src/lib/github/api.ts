import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { filesFromZipBuffer, MAX_ZIP_BYTES, type ImportResult } from "@/lib/workspace/project-files";
import { parseGithubUrl } from "./parse";

export type GithubImportResult = (ImportResult & { ok: true }) | { ok: false; error: string };

const GITHUB_HOSTS = new Set(["api.github.com", "codeload.github.com", "github.com"]);

async function fetchPinned(url: string, headers: Record<string, string>, hops = 0): Promise<Response> {
  if (hops > 4) throw new Error("Too many redirects from GitHub.");
  const parsed = new URL(url);
  if (!GITHUB_HOSTS.has(parsed.hostname)) {
    throw new Error("Unexpected download host.");
  }
  const res = await fetch(url, { headers, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error("GitHub redirect was empty.");
    return fetchPinned(new URL(loc, url).toString(), headers, hops + 1);
  }
  return res;
}

async function readCapped(res: Response, cap: number): Promise<ArrayBuffer> {
  const len = Number(res.headers.get("content-length") ?? "0");
  if (len > cap) {
    throw new Error("Repo archive is too large. Drop a folder instead.");
  }
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let used = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    used += value.byteLength;
    if (used > cap) throw new Error("Repo archive is too large. Drop a folder instead.");
    chunks.push(value);
  }
  const out = new Uint8Array(used);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

export const importGithubRepo = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<GithubImportResult> => {
    const parsed = parseGithubUrl(data.url);
    if (!parsed) {
      return { ok: false, error: "Use owner/repo or a github.com URL." };
    }
    const zipUrl = parsed.ref
      ? `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball/${encodeURIComponent(parsed.ref)}`
      : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball`;
    let res: Response;
    try {
      res = await fetchPinned(zipUrl, {
        Accept: "application/vnd.github+json",
        "User-Agent": "aperture-editor",
        "X-GitHub-Api-Version": "2022-11-28",
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach GitHub." };
    }
    if (res.status === 404) {
      return { ok: false, error: "Repo not found. Only public GitHub repositories work here." };
    }
    if (res.status === 403) {
      return { ok: false, error: "GitHub rate limit. Wait a bit, or drop a folder / zip instead." };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub returned ${res.status}.` };
    }
    try {
      const buf = await readCapped(res, MAX_ZIP_BYTES);
      const imported = await filesFromZipBuffer(buf, parsed.repo);
      if (Object.keys(imported.files).length === 0) {
        return { ok: false, error: "No text files found in that repo (after skipping node_modules and binaries)." };
      }
      return { ok: true, ...imported, name: parsed.repo };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not unpack the repo." };
    }
  });
