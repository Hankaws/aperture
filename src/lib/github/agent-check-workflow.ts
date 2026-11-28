/**
 * The Agent Check workflow, written for a given repository: the steps that
 * install its packages the way its lockfile says, and a link that opens
 * GitHub's new-file page in that repository with the workflow filled in.
 * The visitor reads it and commits it; nothing is written for them.
 *
 * Pure: the check page's server finds the package manager and the default
 * branch, this writes the file and the link.
 */
import { ACTION_USES } from "../../../packages/agent-check/src/run-example.ts";

export const AGENT_CHECK_WORKFLOW_PATH = ".github/workflows/aperture-agent-check.yml";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** How the repository installs its packages: null when there is no package.json at its root. */
export type Install = { manager: PackageManager; locked: boolean } | null;

const NPM_LOCKED: Install = { manager: "npm", locked: true };

/** Lockfiles at the root, in the order a manager is picked by: the first one there wins. */
export const LOCKFILES: ReadonlyArray<[path: string, manager: PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
];

/**
 * The repository's package manager, from its root package.json and the
 * lockfiles found beside it. package.json's `packageManager` names it when
 * set; else the lockfile does; a package.json with no lockfile is npm,
 * unlocked (`npm ci` would fail on it).
 */
export function installOf(packageJson: string | undefined, lockfiles: Iterable<string>): Install {
  if (packageJson === undefined) return null;
  const there = new Set(lockfiles);
  const locked = (manager: PackageManager) =>
    LOCKFILES.some(([path, by]) => by === manager && there.has(path));
  let named: string | undefined;
  try {
    const field = (JSON.parse(packageJson) as { packageManager?: unknown }).packageManager;
    if (typeof field === "string") named = /^(npm|pnpm|yarn|bun)@/.exec(field)?.[1];
  } catch {
    // A package.json that does not parse still says the project uses packages.
  }
  if (named) {
    const manager = named as PackageManager;
    return { manager, locked: locked(manager) };
  }
  const found = LOCKFILES.find(([path]) => there.has(path));
  return found ? { manager: found[1], locked: true } : { manager: "npm", locked: false };
}

const WHY = "# for the tests, and your packages' real types";

function installSteps(install: NonNullable<Install>): string[] {
  const { manager, locked } = install;
  if (manager === "npm") return [`      - run: npm ${locked ? "ci" : "install"} ${WHY}`];
  if (manager === "bun")
    return [
      "      - uses: oven-sh/setup-bun@v2",
      `      - run: bun install${locked ? " --frozen-lockfile" : ""} ${WHY}`,
    ];
  // Corepack, in Node, brings the pnpm or yarn that package.json's packageManager names.
  const command =
    manager === "pnpm" ? `pnpm install${locked ? " --frozen-lockfile" : ""}` : "yarn install";
  return [`      - run: corepack enable # brings ${manager}`, `      - run: ${command} ${WHY}`];
}

/** The workflow file. Without a package.json there is nothing to install or test, so the tests are off. */
export function agentCheckWorkflow(install: Install = NPM_LOCKED): string {
  const lines = [
    `# ${AGENT_CHECK_WORKFLOW_PATH}`,
    "name: Aperture Agent Check",
    "on: pull_request",
    "",
    "jobs:",
    "  check:",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      contents: read",
    "      pull-requests: write # for the one comment with the result",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "        with:",
    "          fetch-depth: 0 # it compares against the pull request's base",
  ];
  if (install) {
    lines.push(
      "      - uses: actions/setup-node@v4",
      "        with:",
      "          node-version: 22",
      ...installSteps(install),
    );
  }
  lines.push(`      - uses: ${ACTION_USES}`, "        with:");
  if (!install) lines.push("          run-tests: false # no package.json at the root to test with");
  lines.push("          comment: true # one comment on the pull request, updated on each push");
  return lines.join("\n");
}

/** A branch name as GitHub allows it in a path; anything else is not linked to. */
const BRANCH = /^(?!\/|.*(?:\/\/|\.\.|@\{))[\w./-]{1,200}(?<![/.])$/;

/**
 * GitHub's new-file page in `owner/repo` on `branch`, with the workflow
 * filled in. GitHub asks there whether to commit to the branch or open a
 * pull request, and offers a fork to someone who cannot write to it.
 * Null when the branch is not known or not a name a link can carry.
 */
export function installUrl(
  repo: { owner: string; repo: string },
  branch: string | null,
  workflow: string,
): string | null {
  if (!branch || !BRANCH.test(branch)) return null;
  const path = branch.split("/").map(encodeURIComponent).join("/");
  const query = new URLSearchParams({
    filename: AGENT_CHECK_WORKFLOW_PATH,
    value: `${workflow.split("\n").slice(1).join("\n")}\n`,
  });
  return `https://github.com/${repo.owner}/${repo.repo}/new/${path}?${query.toString()}`;
}
