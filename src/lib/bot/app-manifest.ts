/**
 * A GitHub App of the repository owner's own, for Aperture Bot to post as,
 * with its own name and avatar. GitHub's manifest flow prefills the app's
 * settings: the person confirms on GitHub, then generates its private key
 * there. Aperture never sees the key: the workflow reads it from a secret.
 */

/** GitHub caps an app's name at 34 characters. */
const MAX_NAME = 34;

export function appName(owner: string): string {
  const name = `${owner} Aperture Bot`;
  return name.length <= MAX_NAME ? name : `${owner.slice(0, MAX_NAME - 13)} Aperture Bot`;
}

/** Just what the bot does: comment, push a branch, open a pull request, read checks. */
export const APP_PERMISSIONS = {
  contents: "write",
  issues: "write",
  pull_requests: "write",
  metadata: "read",
  checks: "read",
  statuses: "read",
  actions: "read",
} as const;

export function appManifest(owner: string, site: string): Record<string, unknown> {
  return {
    name: appName(owner),
    url: `${site}/bot`,
    description: "Aperture Bot: the coding bot that checks before it pushes.",
    public: false,
    redirect_url: `${site}/bot?app=created`,
    // No webhook: the bot runs in the repository's workflow, not on a server.
    hook_attributes: { url: `${site}/bot`, active: false },
    default_permissions: APP_PERMISSIONS,
    default_events: [],
  };
}

/** Where GitHub creates an app from a manifest: under the person, or their organization. */
export function newAppUrl(owner: string, ownerType: string): string {
  return ownerType === "Organization"
    ? `https://github.com/organizations/${encodeURIComponent(owner)}/settings/apps/new`
    : "https://github.com/settings/apps/new";
}
