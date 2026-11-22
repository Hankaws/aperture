/**
 * Checks that what is published is what was meant to ship: Aperture's
 * releases in order and on the right commits, and Aperture Agent Check and
 * Aperture Bot each released on a real build, with `v1` on it, built from
 * Aperture code as new as Aperture's live release. Rules and wording:
 * src/lib/release-verify.ts. Exits 1 when something is wrong.
 *
 *   npm run -s release:verify
 *
 * Reads public GitHub data; GITHUB_TOKEN, when set, only raises the rate limit.
 * Runs daily in CI (.github/workflows/release-verify.yml), so a half-done
 * release is reported within a day, not found by a user.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { parseChangelog, parseHeading } from "../src/lib/changelog.ts";
import {
  judgeAction,
  judgeApp,
  report,
  builtFrom,
  compareVersions,
  type ActionFacts,
  type Finding,
} from "../src/lib/release-verify.ts";

const APERTURE = "Hankaws/aperture";
const ACTIONS = [
  {
    name: "Aperture Agent Check",
    repo: "Hankaws/aperture-agent-check",
    entries: ["packages/agent-check/src/cli.ts"],
  },
  {
    name: "Aperture Bot",
    repo: "Hankaws/aperture-bot",
    entries: ["packages/aperture-bot/src/cli.ts", "packages/aperture-bot/src/action-entry.ts"],
  },
];

const root = fileURLToPath(new URL("..", import.meta.url));

async function gh<T>(path: string): Promise<T | null> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "aperture-release-verify",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/** The commit a tag is on, through an annotated tag object if there is one. */
async function tagCommit(repo: string, tag: string): Promise<string | null> {
  const ref = await gh<{ object: { type: string; sha: string } }>(
    `repos/${repo}/git/ref/tags/${tag}`,
  );
  if (!ref) return null;
  if (ref.object.type !== "tag") return ref.object.sha;
  const obj = await gh<{ object: { sha: string } }>(`repos/${repo}/git/tags/${ref.object.sha}`);
  return obj?.object.sha ?? null;
}

/** The Aperture files a bundle is made of, relative to the repository. */
async function bundleInputs(entries: string[]): Promise<Set<string>> {
  const bundle = await rolldown({
    input: entries.map((e) => `${root}${e}`),
    platform: "node",
    logLevel: "silent",
  });
  const out = await bundle.generate({ format: "cjs" });
  await bundle.close();
  const ids = out.output.flatMap((c) => (c.type === "chunk" ? c.moduleIds : []));
  return new Set(
    ids
      .filter((id) => id.startsWith(root) && !id.includes("/node_modules/"))
      .map((id) => id.slice(root.length)),
  );
}

async function appFindings(): Promise<{
  findings: Finding[];
  live: { tag: string; commit: string } | null;
}> {
  const version = (JSON.parse(readFileSync(`${root}package.json`, "utf8")) as { version: string })
    .version;
  const changelog = parseChangelog(readFileSync(`${root}CHANGELOG.md`, "utf8"))
    .sections.map((s) => parseHeading(s.title).version)
    .filter((v): v is string => v !== null);
  const releases =
    (await gh<Array<{ tag_name: string; draft: boolean }>>(
      `repos/${APERTURE}/releases?per_page=100`,
    )) ?? [];
  const published = releases.filter((r) => !r.draft).map((r) => r.tag_name);
  const newest = [...published].sort(compareVersions).slice(0, 3);
  const versionAtTag: Record<string, string | null> = {};
  for (const tag of newest) {
    const file = await gh<{ content: string }>(
      `repos/${APERTURE}/contents/package.json?ref=${tag}`,
    );
    versionAtTag[tag] = file
      ? ((JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) as { version?: string })
          .version ?? null)
      : null;
  }
  const liveTag = newest[0];
  const liveCommit = liveTag ? await tagCommit(APERTURE, liveTag) : null;
  return {
    findings: judgeApp({ version, changelog, published, versionAtTag }),
    live: liveTag && liveCommit ? { tag: liveTag, commit: liveCommit } : null,
  };
}

async function actionFindings(
  spec: (typeof ACTIONS)[number],
  live: { tag: string; commit: string } | null,
): Promise<Finding[]> {
  const latest = await gh<{ tag_name: string }>(`repos/${spec.repo}/releases/latest`);
  const latestCommit = latest ? await tagCommit(spec.repo, latest.tag_name) : null;
  const majorTag = latest?.tag_name.replace(/^(v\d+).*$/, "$1") ?? "v1";
  const majorCommit = await tagCommit(spec.repo, majorTag);
  const commit = latestCommit
    ? await gh<{ commit: { message: string } }>(`repos/${spec.repo}/commits/${latestCommit}`)
    : null;
  const message = commit?.commit.message ?? null;

  let staleFiles: string[] | null = null;
  const from = builtFrom(message);
  if (from && live) {
    const compare = await gh<{ status: string; files?: Array<{ filename: string }> }>(
      `repos/${APERTURE}/compare/${from}...${live.commit}`,
    );
    if (compare) {
      if (compare.status === "behind" || compare.status === "identical") staleFiles = [];
      else {
        const inputs = await bundleInputs(spec.entries);
        staleFiles = (compare.files ?? []).map((f) => f.filename).filter((f) => inputs.has(f));
      }
    }
  }
  const facts: ActionFacts = {
    name: spec.name,
    repo: spec.repo,
    latest: latest && latestCommit ? { tag: latest.tag_name, commit: latestCommit } : null,
    major: majorCommit ? { tag: majorTag, commit: majorCommit } : null,
    message,
    staleFiles,
    against: live?.tag ?? null,
  };
  return judgeAction(facts);
}

async function main(): Promise<number> {
  const app = await appFindings();
  const findings = [...app.findings];
  for (const spec of ACTIONS) findings.push(...(await actionFindings(spec, app.live)));
  const { text, failed } = report(findings);
  console.log(text);
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      `Could not check the releases: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  },
);
