import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-BW7VTtXx.mjs";
import { r as filesFromZipBuffer, t as MAX_ZIP_BYTES } from "./project-files-B6R06HJh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-DHnqG98a.js
function parseGithubUrl(input) {
	let raw = input.trim();
	if (!raw) return null;
	raw = raw.replace(/\.git$/, "");
	raw = raw.replace(/^git@github\.com:/, "https://github.com/");
	raw = raw.replace(/^https?:\/\/(www\.)?github\.com\//, "");
	raw = raw.replace(/^github\.com\//, "");
	const match = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/.*)?)?$/);
	if (!match) return null;
	const owner = match[1];
	const repo = match[2];
	if (owner === "." || owner === ".." || repo === "." || repo === "..") return null;
	const ref = match[3] ? decodeURIComponent(match[3]) : void 0;
	if (ref && (ref.includes("..") || ref.includes("\\"))) return null;
	return {
		owner,
		repo,
		ref
	};
}
var GITHUB_HOSTS = /* @__PURE__ */ new Set([
	"api.github.com",
	"codeload.github.com",
	"github.com"
]);
async function fetchPinned(url, headers, hops = 0) {
	if (hops > 4) throw new Error("Too many redirects from GitHub.");
	const parsed = new URL(url);
	if (!GITHUB_HOSTS.has(parsed.hostname)) throw new Error("Unexpected download host.");
	const res = await fetch(url, {
		headers,
		redirect: "manual"
	});
	if (res.status >= 300 && res.status < 400) {
		const loc = res.headers.get("location");
		if (!loc) throw new Error("GitHub redirect was empty.");
		return fetchPinned(new URL(loc, url).toString(), headers, hops + 1);
	}
	return res;
}
async function readCapped(res, cap) {
	if (Number(res.headers.get("content-length") ?? "0") > cap) throw new Error("Repo archive is too large. Drop a folder instead.");
	if (!res.body) return res.arrayBuffer();
	const reader = res.body.getReader();
	const chunks = [];
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
var importGithubRepo_createServerFn_handler = createServerRpc({
	id: "a6dccb63260437501493951a47994e9dc8b7950c9e8ffbc0e2a79f328c3dc1e2",
	name: "importGithubRepo",
	filename: "src/lib/github/api.ts"
}, (opts) => importGithubRepo.__executeServer(opts));
var importGithubRepo = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(importGithubRepo_createServerFn_handler, async ({ data }) => {
	const parsed = parseGithubUrl(data.url);
	if (!parsed) return {
		ok: false,
		error: "Use owner/repo or a github.com URL."
	};
	const zipUrl = parsed.ref ? `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball/${encodeURIComponent(parsed.ref)}` : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball`;
	let res;
	try {
		res = await fetchPinned(zipUrl, {
			Accept: "application/vnd.github+json",
			"User-Agent": "aperture-editor",
			"X-GitHub-Api-Version": "2022-11-28"
		});
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Could not reach GitHub."
		};
	}
	if (res.status === 404) return {
		ok: false,
		error: "Repo not found. Only public GitHub repositories work here."
	};
	if (res.status === 403) return {
		ok: false,
		error: "GitHub rate limit. Wait a bit, or drop a folder / zip instead."
	};
	if (!res.ok) return {
		ok: false,
		error: `GitHub returned ${res.status}.`
	};
	try {
		const buf = await readCapped(res, MAX_ZIP_BYTES);
		const imported = await filesFromZipBuffer(buf, parsed.repo);
		if (Object.keys(imported.files).length === 0) return {
			ok: false,
			error: "No text files found in that repo (after skipping node_modules and binaries)."
		};
		return {
			ok: true,
			...imported,
			name: parsed.repo
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Could not unpack the repo."
		};
	}
});
//#endregion
export { importGithubRepo_createServerFn_handler };
