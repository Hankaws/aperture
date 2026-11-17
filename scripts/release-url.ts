/**
 * Prints the link that publishes a release on GitHub in one click: the "new
 * release" form with its tag, commit, title and notes (`docs/releases/X.Y.Z.md`)
 * filled in. Open it, read it over, and choose Publish release.
 *
 *   npm run -s release-url            # the newest version
 *   npm run -s release-url -- 0.15.0
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { latestVersion, parseChangelog } from "../src/lib/changelog.ts";
import { newReleaseUrl, RELEASE_REPO, releaseCommit } from "../src/lib/release-url.ts";

const root = new URL("..", import.meta.url);
const git = (args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/** The link, or why there is none; the exit code says which. */
function main(): number {
  const log = parseChangelog(readFileSync(new URL("CHANGELOG.md", root), "utf8"));
  const version = process.argv[2]?.replace(/^v/, "") ?? latestVersion(log);
  if (!version) {
    console.error("CHANGELOG.md names no version yet.");
    return 1;
  }

  const notesFile = new URL(`docs/releases/${version}.md`, root);
  if (!existsSync(notesFile)) {
    console.error(`docs/releases/${version}.md is missing. Save the release notes there first.`);
    return 1;
  }

  // Already published: say where, rather than a form GitHub would refuse.
  let tagged = "";
  try {
    tagged = git(["ls-remote", "--tags", "origin", `refs/tags/v${version}`]).trim();
  } catch {
    // Offline: GitHub says so itself if the tag exists.
  }
  if (tagged) {
    console.log(
      `v${version} is already tagged. Its release: https://github.com/${RELEASE_REPO}/releases/tag/v${version}`,
    );
    return 0;
  }

  try {
    git(["fetch", "-q", "origin", "main"]);
  } catch {
    // Offline: what this clone knows of main will do.
  }
  let ref = "origin/main";
  try {
    git(["rev-parse", "--verify", "-q", ref]);
  } catch {
    ref = "main";
  }
  const target = releaseCommit(git, version, ref);
  if (!target) {
    console.error(`${version} is not on main yet. Merge its release pull request first.`);
    return 1;
  }

  const { url, withNotes } = newReleaseUrl({
    version,
    target,
    notes: readFileSync(notesFile, "utf8"),
  });
  console.log(url);
  if (!withNotes)
    console.error(
      `The notes are too long for a link: paste docs/releases/${version}.md into the form.`,
    );
  return 0;
}

process.exitCode = main();
