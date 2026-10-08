import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_PERMISSIONS, appManifest, appName, newAppUrl } from "./app-manifest.ts";

test("the app is the owner's, private, without a webhook, and asks only for what the bot does", () => {
  const manifest = appManifest("acme", "https://aperturesais.grok.me");
  assert.deepEqual(manifest, {
    name: "acme Aperture Bot",
    url: "https://aperturesais.grok.me/bot",
    description: "Aperture Bot: the coding bot that checks before it pushes.",
    public: false,
    redirect_url: "https://aperturesais.grok.me/bot?app=created",
    hook_attributes: { url: "https://aperturesais.grok.me/bot", active: false },
    default_permissions: APP_PERMISSIONS,
    default_events: [],
  });
  assert.equal("workflows" in APP_PERMISSIONS, false, "it never writes workflows");
  assert.equal("administration" in APP_PERMISSIONS, false);
});

test("the name fits GitHub's limit, and the app is made where the repository lives", () => {
  assert.equal(appName("a-very-long-organization-name-indeed").length <= 34, true);
  assert.match(appName("a-very-long-organization-name-indeed"), / Aperture Bot$/);
  assert.equal(newAppUrl("ada", "User"), "https://github.com/settings/apps/new");
  assert.equal(
    newAppUrl("acme", "Organization"),
    "https://github.com/organizations/acme/settings/apps/new",
  );
});
