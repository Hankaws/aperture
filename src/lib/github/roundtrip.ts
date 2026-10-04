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

/**
 * The mode to write a changed file with: the mode it had at the commit it came
 * from, so an executable script stays executable and a symlink stays a link.
 * A new file, or one GitHub's tree listing did not include, is a plain file.
 */
export function blobModes(entries: unknown): Map<string, string> {
  const modes = new Map<string, string>();
  if (!Array.isArray(entries)) return modes;
  for (const entry of entries) {
    const rec = entry as { path?: unknown; mode?: unknown; type?: unknown };
    if (rec.type !== "blob" || typeof rec.path !== "string") continue;
    if (rec.mode === "100755" || rec.mode === "120000") modes.set(rec.path, rec.mode);
  }
  return modes;
}

/** Accepts classic and fine-grained tokens. Rejects anything that is not a token. */
export function cleanGithubToken(raw: string): string | null {
  const token = raw.trim();
  if (token.length < 20 || token.length > 255) return null;
  if (!/^[A-Za-z0-9_]+$/.test(token)) return null;
  return token;
}

/**
 * Older versions kept the token in localStorage, where any script on the page
 * could read it. It is now only read once, moved to the account (encrypted),
 * and removed. Nothing writes it here any more.
 */
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

export function clearGithubToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}
