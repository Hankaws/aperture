/**
 * Prints the GitHub release notes for a version, built from CHANGELOG.md:
 * every line from that version's heading down to the previous release.
 *
 *   npm run release-notes            # the newest version
 *   npm run release-notes -- 0.2.0
 */
import { readFileSync } from "node:fs";
import { latestVersion, parseChangelog, releaseNotes } from "../src/lib/changelog.ts";

const log = parseChangelog(readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8"));
const version = process.argv[2] ?? latestVersion(log);
const notes = version ? releaseNotes(log, version) : null;
if (!version || !notes) {
  console.error(
    version
      ? `CHANGELOG.md has no "## ${version} - YYYY-MM-DD" heading.`
      : "CHANGELOG.md names no version yet.",
  );
  process.exit(1);
}
console.log(
  `${notes}\n\nEvery change, newest first: [CHANGELOG.md](https://github.com/Hankaws/aperture/blob/v${version}/CHANGELOG.md)`,
);
