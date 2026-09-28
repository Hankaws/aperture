# Third-party notices

## Grok App Builder template

Aperture started as a project in Grok App Builder (xAI), and it still runs on
that template's scaffolding. Those files belong to the template, not to this
project. **The MIT License in `LICENSE` does not cover them.** Their terms are
xAI's.

Files that come from the template:

- `AGENTS.md`: instructions for Grok's build agent. Aperture's own notes are
  in `AGENTS.project.md`.
- `.grok/`: the template's skills, references and settings.
- `public/__grok/`: the install page and icons for the "Created with Grok"
  badge.
- `server/`: the PWA and share-card middleware.
- `scripts/grok-pwa-*`, `scripts/install-page.html`, `scripts/with-app-env.mjs`,
  `scripts/app-env-plugin.mjs`, `scripts/preview.mjs`,
  `scripts/browser-smoke*.mjs`, `scripts/browser-guard.mjs`,
  `scripts/brand-check*.mjs`, `scripts/preview-thumbnail.mjs`, `startup.sh`.
- The helpers the template pre-wires in `src/lib/` (`auth/`, `app-data/`,
  `db.ts`, `env.server.ts`, `og/`, `preview-host-bridge.ts`,
  `preview-embedder-origin.ts`, `error-component.tsx`) and the template's parts
  of `vite.config.ts`.

Aperture has since changed some of these files. Where a file mixes template
code with Aperture's own changes, only Aperture's changes fall under the MIT
License.

## npm dependencies

Every package in `package.json` keeps its own license. `npm ls --all` lists
them, and each package's own `LICENSE` file is in `node_modules/`.
