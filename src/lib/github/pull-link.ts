/**
 * A pull request link as people paste it: the page's URL (with or without
 * `/files`, `/commits`, a query or a `#` anchor), `owner/repo#12`, or
 * `owner/repo/pull/12`. Pure and tiny: the check page parses on every
 * keystroke, and the server parses again before it reads anything.
 */
export type PullLink = { owner: string; repo: string; number: number };

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export function parsePullLink(input: string): PullLink | null {
  let raw = input.trim();
  if (!raw) return null;
  raw = raw.replace(/^https?:\/\/(?:www\.)?github\.com\//i, "").replace(/^github\.com\//i, "");
  raw = raw.replace(/[?#](?!\d+$).*$/, "");
  const match =
    /^([^/\s#]+)\/([^/\s#]+)\/pulls?\/(\d+)(?:\/[\w./-]*)?\/?$/.exec(raw) ??
    /^([^/\s#]+)\/([^/\s#]+)#(\d+)$/.exec(raw);
  if (!match) return null;
  const [, owner, repo, digits] = match;
  if (!NAME.test(owner!) || !NAME.test(repo!)) return null;
  if ([owner, repo].some((part) => part === "." || part === "..")) return null;
  const number = Number(digits);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return { owner: owner!, repo: repo!.replace(/\.git$/, ""), number };
}

/** The link's form in the check page's address: `owner/repo/12`. */
export function pullLinkPath(link: PullLink): string {
  return `${link.owner}/${link.repo}/${link.number}`;
}

/** The pull request on GitHub. */
export function pullUrl(link: PullLink): string {
  return `https://github.com/${link.owner}/${link.repo}/pull/${link.number}`;
}

/** Reads the page address's `pr` back: `owner/repo/12`, or any form `parsePullLink` takes. */
export function pullLinkFromPath(value: string): PullLink | null {
  const path = /^([^/]+)\/([^/]+)\/(\d+)$/.exec(value.trim());
  if (path) return parsePullLink(`${path[1]}/${path[2]}#${path[3]}`);
  return parsePullLink(value);
}

export type PullFacts = {
  title: string;
  author: string;
  /** The repository as GitHub spells it, which the link may not. */
  owner: string;
  repo: string;
  state: "open" | "closed" | "merged" | null;
  /** The description: in full from the page's "Copy Markdown", else its opening from the summary. */
  body: string;
  /** The repository's default branch, from the page's data; the pull request's base when it says none. */
  defaultBranch: string | null;
};

function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * What the pull request's page says about it, read from its `<title>`
 * ("Title by author · Pull Request #12 · owner/repo · GitHub"), the summary
 * and the state in its data. Null when the page is not that pull request's.
 */
export function pullPageFacts(html: string, number: number): PullFacts | null {
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1];
  if (!title) return null;
  const parts = new RegExp(
    `^(.*) by (\\S+) · Pull Request #${number} · ([\\w.-]+)/([\\w.-]+)(?: · GitHub)?$`,
  ).exec(decode(title.trim()));
  if (!parts) return null;
  // A draft is an open pull request.
  const state = new RegExp(`"number":${number},[^{}]*?"state":"(OPEN|CLOSED|MERGED|DRAFT)"`).exec(
    html,
  )?.[1];
  // The whole description, as the page's "Copy Markdown" holds it; the summary is cut short,
  // which loses a footer such as "Generated with Claude Code".
  const markdown =
    /data-dd-action-name="pr\.description\.copy_markdown"[^>]*?\bvalue="([^"]*)"/.exec(html)?.[1] ??
    /\bvalue="([^"]*)"[^>]*?data-dd-action-name="pr\.description\.copy_markdown"/.exec(html)?.[1];
  const summary = /<meta property="og:description" content="([^"]*)"/.exec(html)?.[1];
  const body =
    markdown !== undefined
      ? decode(markdown)
      : summary !== undefined
        ? decode(decode(summary))
        : "";
  const branch =
    /"repository":\{[^{}]*?"defaultBranch":"([^"\\]{1,200})"/.exec(html)?.[1] ??
    /"baseBranch":"([^"\\]{1,200})"/.exec(html)?.[1];
  return {
    title: parts[1]!,
    author: parts[2]!,
    owner: parts[3]!,
    repo: parts[4]!,
    state: !state
      ? null
      : /^draft$/i.test(state)
        ? "open"
        : (state.toLowerCase() as "open" | "closed" | "merged"),
    // The summary is escaped twice: once as markdown text, once as an attribute.
    body,
    defaultBranch: branch ?? null,
  };
}
