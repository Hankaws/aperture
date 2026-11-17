/**
 * The link that publishes a release in one click: GitHub's "new release" form
 * with the tag, the commit it goes on, the title and the notes filled in
 * (GitHub reads them from the query: `tag`, `target`, `title`, `body`). The
 * notes are `docs/releases/X.Y.Z.md`; the commit is the release's own merge,
 * so the tag lands there even when main has moved on since.
 * Pure, for tests; `scripts/release-url.ts` prints it.
 */

export const RELEASE_REPO = "Hankaws/aperture";

/** Longer links than this are refused by browsers or by GitHub: the notes then go in by hand. */
export const MAX_RELEASE_URL = 8_000;

export type ReleaseLink = {
  url: string;
  /** False when the notes did not fit in the link and have to be pasted. */
  withNotes: boolean;
};

export function newReleaseUrl({
  repo = RELEASE_REPO,
  version,
  target,
  notes,
}: {
  repo?: string;
  version: string;
  target: string;
  notes: string;
}): ReleaseLink {
  const base = `https://github.com/${repo}/releases/new`;
  const fields = { tag: `v${version}`, target, title: `Aperture ${version}` };
  const full = `${base}?${new URLSearchParams({ ...fields, body: notes.trim() })}`;
  if (full.length <= MAX_RELEASE_URL) return { url: full, withNotes: true };
  return { url: `${base}?${new URLSearchParams(fields)}`, withNotes: false };
}

/** Runs git with these arguments and returns what it printed. */
export type Git = (args: string[]) => string;

/**
 * The release's merge commit: the first commit on `ref`'s first-parent line
 * (one per merged pull request) whose `package.json` has that version. Null
 * when the release pull request has not merged into `ref` yet.
 */
export function releaseCommit(git: Git, version: string, ref: string): string | null {
  const out = git([
    "log",
    ref,
    "--first-parent",
    "--reverse",
    "--format=%H",
    `-S"version": "${version}"`,
    "--",
    "package.json",
  ]);
  return out.split("\n").find((line) => /^[0-9a-f]{40}$/.test(line.trim())) ?? null;
}
