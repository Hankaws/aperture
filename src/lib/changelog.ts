/**
 * Reads CHANGELOG.md for the /changelog page and the release notes, so neither
 * can disagree with the file. The format is the file's own: `## Unreleased`,
 * `## YYYY-MM-DD`, or `## X.Y.Z - YYYY-MM-DD` for the day a version was
 * released; `### Added | Changed | Fixed`; and `- ` items that may wrap onto
 * indented lines. Inline text allows **bold**, `code` and [links](https://…) only.
 *
 * Pure: tests import it directly.
 */

/** The group headings the file uses, in the order release notes list them. */
export const GROUPS = ["Added", "Changed", "Fixed", "Removed", "Security"];

export type ChangeGroup = { title: string; items: string[] };
export type ChangeSection = { title: string; groups: ChangeGroup[] };
export type Changelog = { intro: string; sections: ChangeSection[] };

export function parseChangelog(markdown: string): Changelog {
  const sections: ChangeSection[] = [];
  const intro: string[] = [];
  let section: ChangeSection | null = null;
  let group: ChangeGroup | null = null;
  let item: string[] | null = null;
  const flush = () => {
    if (item && group) group.items.push(item.join(" "));
    item = null;
  };
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (/^# /.test(line)) continue;
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      flush();
      section = { title: h2[1]!.trim(), groups: [] };
      sections.push(section);
      group = null;
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3 && section) {
      flush();
      group = { title: h3[1]!.trim(), items: [] };
      section.groups.push(group);
      continue;
    }
    const bullet = /^- (.*)$/.exec(line);
    if (bullet && group) {
      flush();
      item = [bullet[1]!.trim()];
      continue;
    }
    if (item && /^\s+\S/.test(line)) {
      item.push(line.trim());
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (!section) intro.push(line.trim());
  }
  flush();
  return { intro: intro.join(" "), sections };
}

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

/** The inline pieces of one line. A link that is not https stays plain text. */
export function inlineParts(text: string): Inline[] {
  const parts: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > at) parts.push({ kind: "text", text: text.slice(at, match.index) });
    if (match[1] !== undefined) parts.push({ kind: "bold", text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: "code", text: match[2] });
    else if (/^https:\/\//.test(match[4]!))
      parts.push({ kind: "link", text: match[3]!, href: match[4]! });
    else parts.push({ kind: "text", text: match[3]! });
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ kind: "text", text: text.slice(at) });
  return parts;
}

export type Heading = { version: string | null; date: string | null };

/** The version and date a section heading names; both null for Unreleased. */
export function parseHeading(title: string): Heading {
  const match = /^(?:(\d+\.\d+\.\d+) - )?(\d{4}-\d{2}-\d{2})$/.exec(title);
  return match ? { version: match[1] ?? null, date: match[2]! } : { version: null, date: null };
}

/** "2026-10-05" as "5 October 2026", "0.2.0 - 2026-10-05" as "0.2.0 · 5 October 2026"; any other heading as it is. */
export function sectionLabel(title: string): string {
  const { version, date: day } = parseHeading(title);
  if (!day) return title;
  const label = dateLabel(day);
  return version ? `${version} · ${label}` : label;
}

function dateLabel(day: string): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)!;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${Number(date[3])} ${months[Number(date[2]) - 1]} ${date[1]}`;
}

/** The newest released version, or null before the first release. */
export function latestVersion(log: Changelog): string | null {
  for (const section of log.sections) {
    const { version } = parseHeading(section.title);
    if (version) return version;
  }
  return null;
}

/**
 * The notes for one release, as Markdown: every line from the section that
 * names `version` down to the previous release, grouped as the file groups
 * them. Null when no section names that version.
 */
export function releaseNotes(log: Changelog, version: string): string | null {
  const start = log.sections.findIndex(
    (section) => parseHeading(section.title).version === version,
  );
  if (start < 0) return null;
  const groups = new Map<string, string[]>();
  for (const [i, section] of log.sections.slice(start).entries()) {
    if (i > 0 && parseHeading(section.title).version) break;
    for (const group of section.groups)
      groups.set(group.title, [...(groups.get(group.title) ?? []), ...group.items]);
  }
  // A group the list does not name goes last.
  const order = (title: string) => (GROUPS.includes(title) ? GROUPS.indexOf(title) : GROUPS.length);
  return [...groups]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([title, items]) => [`### ${title}`, "", ...items.map((item) => `- ${item}`)].join("\n"))
    .join("\n\n");
}
