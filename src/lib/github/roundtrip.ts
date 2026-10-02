/** Where an opened project came from, plus a stamp of each file at that moment. */
export type GithubOrigin = {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
  stamps: Record<string, string>;
  /** Default branch, so a feature branch can be merged back. */
  defaultBranch?: string;
  /** Pull request opened from this editor, if one is still open. */
  pull?: number;
};

/** Owner, repo, and the commit that was opened. Stamps are added on the client. */
export type GithubSource = Omit<GithubOrigin, "stamps">;

export type GithubChange = { path: string; content: string } | { path: string; deleted: true };

/** A short stamp, not a secret. Length is part of it so two different files rarely collide. */
export function fileStamp(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = Math.imul(h, 33) ^ text.charCodeAt(i);
  return `${(h >>> 0).toString(36)}.${text.length}`;
}

export function stampFiles(files: Record<string, string>): Record<string, string> {
  const stamps: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) stamps[path] = fileStamp(text);
  return stamps;
}

/** Files that differ from the commit that was opened. Unchanged files are left out. */
export function changesSince(stamps: Record<string, string>, files: Record<string, string>): GithubChange[] {
  const changes: GithubChange[] = [];
  for (const [path, text] of Object.entries(files)) {
    if (stamps[path] !== fileStamp(text)) changes.push({ path, content: text });
  }
  for (const path of Object.keys(stamps)) {
    if (!(path in files)) changes.push({ path, deleted: true });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}

/** Accepts classic and fine-grained tokens. Rejects anything that is not a token. */
export function cleanGithubToken(raw: string): string | null {
  const token = raw.trim();
  if (token.length < 20 || token.length > 255) return null;
  if (!/^[A-Za-z0-9_]+$/.test(token)) return null;
  return token;
}

const TOKEN_KEY = "aperture-github-token";

export function readGithubToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? cleanGithubToken(raw) : null;
  } catch {
    return null;
  }
}

export function writeGithubToken(raw: string): string | null {
  const token = cleanGithubToken(raw);
  if (!token || typeof window === "undefined") return null;
  window.localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function clearGithubToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}
