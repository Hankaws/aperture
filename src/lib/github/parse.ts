export type GithubRef = { owner: string; repo: string; ref?: string };

export function parseGithubUrl(input: string): GithubRef | null {
  let raw = input.trim();
  if (!raw) return null;
  raw = raw.replace(/\.git$/, "");
  raw = raw.replace(/^git@github\.com:/, "https://github.com/");
  raw = raw.replace(/^https?:\/\/(www\.)?github\.com\//, "");
  raw = raw.replace(/^github\.com\//, "");
  const match = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/.*)?)?$/);
  if (!match) return null;
  const owner = match[1]!;
  const repo = match[2]!;
  if (owner === "." || owner === ".." || repo === "." || repo === "..") return null;
  const ref = match[3] ? decodeURIComponent(match[3]) : undefined;
  if (ref && (ref.includes("..") || ref.includes("\\"))) return null;
  return { owner, repo, ref };
}
