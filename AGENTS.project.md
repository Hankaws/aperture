# Aperture — project instructions

Traps in this repo that typecheck cleanly and fail later. Each one cost a debug
cycle before it was written down.

## Imports in `src/lib` that tests reach

`npm test` runs `src/**/*.test.ts` under bare node (`--experimental-strip-types`),
which does **not** resolve the `@/` alias — only the bundler does. A module a
test imports, directly or transitively, must use a relative path **with the
`.ts` extension**:

```ts
import { planById } from "../billing/plans.ts";   // resolves in both
import { planById } from "@/lib/billing/plans";   // typechecks, dies in tests
```

`tsc --noEmit` passes either way, so the test suite is the only thing that
catches this. It has bitten `plans.ts`, `preview-check.ts` and `run.server.ts`.

Type-only imports are erased, so `import type { X } from "@/lib/…"` is fine.

## TypeScript node's stripper does not support

Type stripping removes types; it does not transform syntax that emits code.
Parameter properties are the one that keeps appearing:

```ts
constructor(private readonly x: T) {}        // fails at runtime
constructor(x: T) { this.x = x; }            // fine
```

Same class of problem: `enum`, decorators, namespaces.

## Never commit `.vercel/output` from a partial build

`npm run build` is `vite build` **plus** `copy-pglite-assets` **plus**
`db:migrate`. Running `vite build` alone produces an output tree with the pglite
wasm assets deleted. Verify a build if you like, then
`git checkout -- .vercel && git clean -fd .vercel` before committing.

## The demo deploy builds from source, not from `.vercel/output`

Vercel serves any committed `.vercel/output` as-is and skips the build
(`.vercelignore` does not change that), so the private `aperture-demo` Vercel
project does not deploy from Git. `.github/workflows/demo-deploy.yml` runs
`vercel build` (which rebuilds `.vercel/output` from source with the project's
env, including `VITE_AUTH_ENABLED=false`) and `vercel deploy --prebuilt` on
every push to `main`. The demo is sign-in-off, so every visitor is the same
dev user; keep Vercel Authentication on for all its deployments.

The agent's verify runs use Vercel Sandbox through `@vercel/sandbox`
(`src/lib/sandbox/vercel.server.ts`). A deployment opts in with
`APERTURE_SANDBOX=vercel-oidc` (signs in with the Vercel project's own OIDC
identity; no stored token), or sets `VERCEL_SANDBOX_TOKEN`, `VERCEL_TEAM_ID`
and `VERCEL_PROJECT_ID` off Vercel. Merely running on Vercel is not an opt-in.
`GET /api/sandbox-check` runs one real, billed sandbox end to end; it is a 404
unless `APERTURE_SANDBOX_CHECK=1`.

## Editor layout: resizable groups mount in the browser only

Every resizable split in the editor (`react-resizable-panels`) goes through
`usePanelLayout` in `src/lib/use-panel-layout.ts`, which saves dragged sizes
and hands them back as the Group's `defaultLayout`. Layout prefs (which panels
show, where the preview docks, swapped sidebars) live in `ui-store.ts`, parsed
by the tested `src/lib/layout-prefs.ts`. Two library behaviours shape this:

- It throws ("Panel constraints not found") if panels are reordered in the
  commit they first mount. So the workspace Group mounts after hydration, in
  the saved order; later swaps reorder in place, which keeps panel state.
- `setLayout` during the first commit updates its state without re-rendering
  the panels, then ignores the same layout set again. Use `defaultLayout` at
  mount, not an early `setLayout`.

## Tests are globbed

`npm test` takes `'scripts/**/*.test.mjs' 'src/**/*.test.ts'`. Do not reintroduce
a hardcoded file list — one previously hid 167 tests behind a `&&`
short-circuit, and new test files were silently never run.

One process runs both suites, so a failure in either is reported and neither is
skipped.

## Verification that CI cannot do

CI runs typecheck, lint and test. Some guarantees are not reachable that way and
were checked by hand; if you change the code beneath them, re-check the same way:

- **Workspace sync** — that a stale-revision write touches zero rows was proven
  by running the migration and the conditional update against PGLite directly.
- **Persistence end to end** — that work survives cleared site data was proven by
  driving a browser: edit, "Saved", clear storage, reload.
- **The preview Scripts toggle** — security-relevant, verified by clicking it.
- **`src/lib/sandbox/vercel.server.ts` has never run at all.** Its request shapes
  come from API docs, not from a successful call.

Unit tests and a green typecheck have repeatedly passed over real bugs in this
repo: a sync that never persisted its revision, a hash taken before seeding
rather than after, an adapter nobody has exercised. Run the thing.

## Auth and the database

Auth is **on** here, so `.grok/app-env.json` carries no `VITE_AUTH_ENABLED` and
the flag defaults on. Several `scripts/*.test.mjs` assert the Grok template's
shipped defaults; they are hermetic now, exercising the mechanism against a
fixture rather than this workspace's configuration. Keep them that way rather
than re-pinning them to whatever the repo currently holds.

Run locally with `VITE_AUTH_ENABLED=false` and no `DATABASE_URL` to get the dev
user and PGLite. Never set that flag false *and* a `DATABASE_URL` — the auth
layer throws on that combination by design.

## Search ranking has a benchmark — use it

`semantic_search` is measured, not assumed. Before and after any change to
tokenizing, chunking or scoring in `src/lib/indexer/` or `src/lib/parser/chunk.ts`:

```sh
node --experimental-strip-types scripts/retrieval-bench.ts             # DEV
node --experimental-strip-types scripts/retrieval-bench.ts --held-out  # final check only
```

Tune against DEV. Run HELD-OUT once, at the end, and do not change anything in
response to what it shows — a held-out set used to make a decision is no longer
held out. Queries are fixed; add new cases rather than rewording existing ones.

Tried and rejected, with numbers, so it is not rediscovered: chunking on Lezer
declaration boundaries with their doc comments attached. Neutral on retrieval
(three queries better, five worse, no pattern) and twice the index time, so it
was not shipped. Long doc comments seem to help conceptual queries and dilute
BM25 for code-term ones through length normalization.

## This repository is also edited outside Grok

Work reaches `main` from two places: Grok's export, and pull requests made
elsewhere. Your workspace may not include everything already on `main`.

- **Do not delete files under `src/`, `scripts/`, `migrations/` or `.github/`
  unless the user asked for that file to go.** A file you do not recognise is
  more likely recent work from outside this workspace than something unused.
- The **Export guard** workflow fails any Grok export that deletes those files,
  and prints the `git revert` that restores them. A red Export guard after an
  export means work was dropped. It is not something to route around.
- It also fails if `main` was force-pushed, since that can remove commits
  outright where a revert cannot reach them.

What the guard cannot see: a line changed inside a file that both Grok and
another contributor edited. For those files, check `main`'s version before
exporting over it.
