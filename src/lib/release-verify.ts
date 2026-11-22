/**
 * Whether what is published matches what was meant to ship: Aperture's own
 * releases, and the two actions built from it (Aperture Agent Check and
 * Aperture Bot), whose bundles carry the checks.
 *
 * A release can be half done without anything failing: a tag made before its
 * build finished lands on the old commit, a release published by hand skips
 * the build, `v1` stays behind. Each of those ships old code to everyone on
 * `@v1`. These rules say so, in words a person can act on.
 *
 * Pure: the script (`scripts/release-verify.ts`) gathers the facts from git
 * and GitHub; tests import this directly.
 */

export type Level = "ok" | "warn" | "fail";
export type Finding = { level: Level; text: string };

/** Aperture itself: what the files say, and what GitHub has published. */
export type AppFacts = {
  /** package.json's version. */
  version: string;
  /** Every version with a heading in CHANGELOG.md, newest first. */
  changelog: string[];
  /** Published (not draft) releases, as tags. */
  published: string[];
  /** For each published tag, the version package.json says at that commit (null when it could not be read). */
  versionAtTag: Record<string, string | null>;
};

/** One action repository: its newest release, `v1`, and what the newest release was built from. */
export type ActionFacts = {
  name: string;
  repo: string;
  /** The newest published release: its tag and the commit the tag is on. */
  latest: { tag: string; commit: string } | null;
  /** Where the major tag points. */
  major: { tag: string; commit: string } | null;
  /** The message of the commit the newest release is on. */
  message: string | null;
  /** Bundled Aperture files that changed between the commit it was built from and Aperture's live release. Null: not compared. */
  staleFiles: string[] | null;
  /** The Aperture release it was compared with. */
  against: string | null;
};

const BUILT_FROM = /^Build dist from Hankaws\/aperture@([0-9a-f]{7,40})\b/;

/** The Aperture commit a build commit says it was built from. */
export function builtFrom(message: string | null): string | null {
  return message ? (BUILT_FROM.exec(message.trim())?.[1] ?? null) : null;
}

function semver(v: string): number[] {
  return v
    .replace(/^v/, "")
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
}

/** Newer first. */
export function compareVersions(a: string, b: string): number {
  const x = semver(a);
  const y = semver(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (y[i] ?? 0) - (x[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const short = (sha: string) => sha.slice(0, 7);

export function judgeApp(facts: AppFacts): Finding[] {
  const out: Finding[] = [];
  const published = new Set(facts.published.map((t) => t.replace(/^v/, "")));
  const newest = [...published].sort(compareVersions)[0];

  // A version that never went out. Skipped since the release before last is the slip this exists
  // for (0.28.0 out before 0.27.0); older gaps are history, said once, for the owner to fill or leave.
  const sorted = [...published].sort(compareVersions);
  const previous = sorted[1];
  const skipped = facts.changelog.filter(
    (v) => !published.has(v) && newest !== undefined && compareVersions(v, newest) > 0,
  );
  const recent = skipped.filter((v) => previous === undefined || compareVersions(v, previous) < 0);
  const older = skipped.filter((v) => !recent.includes(v));
  for (const v of recent)
    out.push({
      level: "fail",
      text: `Aperture ${v} was never published, though ${newest} was. Publish it: npm run -s release-url -- ${v}`,
    });
  if (older.length > 0)
    out.push({
      level: "warn",
      text: `Older Aperture versions in CHANGELOG.md were never published: ${[...older].sort(compareVersions).join(", ")}. Publish them with npm run -s release-url -- <version>, or leave them.`,
    });

  if (!published.has(facts.version)) {
    out.push({
      level: "warn",
      text: `Aperture ${facts.version} is merged but not published yet: npm run -s release-url -- ${facts.version}`,
    });
  }

  for (const tag of facts.published) {
    const want = tag.replace(/^v/, "");
    const at = facts.versionAtTag[tag];
    if (at !== undefined && at !== null && at !== want)
      out.push({
        level: "fail",
        text: `Aperture ${tag} is tagged on a commit whose package.json says ${at}: the tag is on the wrong commit.`,
      });
  }

  if (out.every((f) => f.level !== "fail"))
    out.unshift({
      level: "ok",
      text: `Aperture: ${newest ? `v${newest} is the newest release` : "no release yet"}${older.length === 0 ? ", and every version before it was published" : ""}.`,
    });
  return out;
}

export function judgeAction(facts: ActionFacts): Finding[] {
  const { name, latest, major } = facts;
  if (!latest) return [{ level: "warn", text: `${name}: no published release to check.` }];
  const out: Finding[] = [];
  const from = builtFrom(facts.message);

  if (!from) {
    out.push({
      level: "fail",
      text: `${name} ${latest.tag} is on ${short(latest.commit)}, which is not a build commit ("${(facts.message ?? "").split("\n")[0]!.slice(0, 80)}"). Its tag was made before the build finished, or by hand: move ${latest.tag} to the commit "Build from Aperture" made.`,
    });
  }
  if (!major) {
    out.push({
      level: "fail",
      text: `${name}: there is no v1 tag, so \`@v1\` workflows cannot run it.`,
    });
  } else if (major.commit !== latest.commit) {
    out.push({
      level: "fail",
      text: `${name}: ${major.tag} is on ${short(major.commit)}, not on ${latest.tag} (${short(latest.commit)}), so \`@${major.tag}\` workflows run an older build. Move it: git tag -f ${major.tag} ${latest.tag} && git push -f origin ${major.tag}`,
    });
  }
  if (from && facts.staleFiles && facts.staleFiles.length > 0) {
    const listed = facts.staleFiles.slice(0, 5).join(", ");
    const more = facts.staleFiles.length > 5 ? ` and ${facts.staleFiles.length - 5} more` : "";
    out.push({
      level: "fail",
      text: `${name} ${latest.tag} was built from aperture@${short(from)}, and ${facts.staleFiles.length} ${facts.staleFiles.length === 1 ? "file it bundles has" : "files it bundles have"} changed by ${facts.against ?? "the live release"}: ${listed}${more}. Run "Build from Aperture" with that release and publish the next version.`,
    });
  }

  if (out.length === 0)
    out.push({
      level: "ok",
      text: `${name}: ${latest.tag} is a build of aperture@${short(from!)}${facts.staleFiles ? `, current with ${facts.against}` : ""}, and ${major!.tag} is on it.`,
    });
  return out;
}

const MARK: Record<Level, string> = { ok: "✓", warn: "!", fail: "✗" };

export function report(findings: Finding[]): { text: string; failed: boolean } {
  return {
    text: findings.map((f) => `${MARK[f.level]} ${f.text}`).join("\n"),
    failed: findings.some((f) => f.level === "fail"),
  };
}
