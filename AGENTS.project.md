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

## Build output is not committed

`.vercel/` is in `.gitignore`: the repository is open source, and 40 MB of
generated files in it helped nobody. `npm run build` is `vite build` **plus**
`copy-pglite-assets` **plus** `db:migrate`; running `vite build` alone produces
an output tree with the pglite wasm assets missing.

Grok App Builder's own publish used to deploy the committed `.vercel/output`.
It no longer can. If an export from Grok puts build output back, remove it
again rather than route around the ignore rule.

## The demo deploy builds from source

The private `aperture-demo` Vercel project does not deploy from Git; its Git
builds are skipped. `.github/workflows/demo-deploy.yml` runs `vercel build`
from source with the project's env (including `VITE_AUTH_ENABLED=false`), then
`vercel deploy --prebuilt`, on every push to `main`. Keep Vercel
Authentication on for its deployments until the repository is public.

## Sign-in off: one anonymous user per browser, one shared spending pool

With `VITE_AUTH_ENABLED=false`, `requireUserId` gives each browser its own
`visitor:<uuid>` id from an HttpOnly `aperture_visitor` cookie
(`src/lib/auth/visitor.ts`). Saved files, the thread, settings and the
visitor's own API keys are theirs alone. The `/app` route's `beforeLoad`
issues the cookie first, so the editor's parallel first requests share one id.

Anything the operator pays for is charged to one shared row, `dev-user`, via
`spendOwnerId`: the plan, hosted turns, Tab, session caps and sandbox runs.
In billing, `loadAccount` merges your own row (keys, model choice) with the
payer's row (plan, counters). A new place that reads the plan or a usage
counter must go through `spendOwnerId`. Otherwise clearing cookies hands out a
fresh allowance and the demo's cost has no bound.

Verified by hand, with two browsers against the dev server:

- B never sees A's applied edit, thread or model choice.
- A's work comes back from the server after `localStorage` is cleared.
- Clearing the cookie makes a new visitor.
- A setting the plan changes it for B.

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

## Replay model: the whole product with no API key

`APERTURE_MODEL=replay` makes every Composer run play back a recorded one
(`src/lib/agent/replay.ts`) instead of calling a model: reads, plan, staged
diffs, the loop's own verify step, apply. Use it for product work, end-to-end
tests and demos. The UI labels it "Replay model" and it costs nothing.

- Tapes cover the harbor-api demo's three known bugs; anything else gets a
  list of what is recorded. Add a tape by recording its `search` strings
  against `DEMO_FILES` exactly; `replay.test.ts` fails if one stops applying.
- harbor-api's `npm test` is Vitest, with one failing test per known bug
  (`tests/store.test.ts`, `tests/tasks.test.ts`). `runner.test.ts` checks that
  each tape's fix makes exactly its own test pass and leaves the other two
  failing as before. Keep that true when adding a bug or a tape: the demo's
  answers depend on it.
- The engine decides from what this turn has already done (tool calls and
  their results), never by counting steps, so loop nudges and verify
  failures don't derail it.
- It never claims tests passed: every result it states comes from a real run
  of the tests.
- Inline edits (Ctrl/⌘K) and Tab refuse in replay rather than paste prose.
- Try it: `APERTURE_MODEL=replay VITE_AUTH_ENABLED=false npm run dev`.

## Check results on every staged change

The review strip shows five checks for whatever is staged: **Parses**,
**Imports resolve**, **Types**, **Preview renders**, **Tests**. The rows come
from `changeChecks` in `src/lib/workspace/checks.ts` (pure and tested). A check
that did not run reads "not run" with the reason and never counts as a pass.

- **Types** is `typeIssues` in `type-check.ts`, run on changed TypeScript files
  that parse. It is not `tsc`: it reports only errors it can prove from the
  file's text (a literal against a primitive annotation, a returned literal, an
  argument count against a function declared in the same file, a name that is
  not declared, imported or a known global). Do not describe a pass as "the
  types check" in user-facing copy without saying it is this light check.
- **Preview renders** renders the *staged* page in a hidden
  `sandbox="allow-scripts"` frame (`renderProbeDocument` in `design-mode.ts`).
  The live preview shows applied files, so its errors say nothing about the
  change. Scripts run only when the preview's Scripts toggle is on. Resource
  errors are ignored because relative URLs never load in a srcdoc frame.
- **Tests** is the agent's own verify run (`VerifyReport` on the message). The
  run only happens when the request carries a `userId`, since runs are counted
  per account. `/api/agent` passes it to the main loop and to every worker. If
  a route drops it, every change reads "Running is not available for this
  request."
- When the sandbox did not run, **Tests** comes from the browser test runner
  (`src/lib/runner/`). It runs `npm run test` in the tab, free, against the
  staged files. `plan.ts` reads the script and supports `node [flags] files`,
  `node --test [globs]`, `tsx`, `vitest` and `jest`. `config.ts` accepts a
  Vitest or Jest config only when every key in it is one the runner honours;
  an unknown key refuses. `bundle.ts` strips TypeScript with sucrase and
  resolves every import up front. `runtime.ts` provides `node:assert`,
  `node:test`, `node:path`, `node:util` and `process`. For Vitest and Jest
  runs, `runtime-framework.ts` adds the test API, `expect`, mocks and fake
  timers. Anything else (npm packages, `node:http`, jsdom, snapshots) reports
  "not run" with the reason; it never counts as a failure.
- In a Vitest or Jest run, `jest.mock` / `vi.mock` calls are hoisted by
  sucrase's `jest` transform. A top-level `vi.mock(` is rewritten to
  `jest.mock(` first, and the runtime points the global `jest` at `vi`. A
  module that imports something the browser cannot run compiles to a stub.
  The stub marks the whole run unsupported only if it is loaded, because a
  test that mocks the module never loads it.
- The code runs in a Worker inside a hidden `sandbox="allow-scripts"` frame
  whose CSP blocks all network, so agent-written code cannot call this app's
  API as the user. A run that passes 10 s is ended by removing the frame.
  `runner.test.ts` and `frameworks.test.ts` run the same bundles in a Node
  `vm` context: keep new runtime behaviour covered there.
- A failure is re-run against the applied files. If it failed the same way
  before, it shows amber ("Already failing before this change") and is not
  blamed on the change. A new failure on a fresh Composer change goes back to
  Composer once (`shouldAutoFix`); the message's `autoFixed` flag stops a second
  attempt.
- The agent loop works on applied files plus staged edits. A follow-up that
  edited the applied text instead would drop the change it follows up on.
- The agent's own `run_script` goes to the browser when it can
  (`agent/browser-handoff.ts`). Server instances share no memory, so the loop
  cannot wait mid-run for the tab. Instead the tab sends `browserRuns` with
  each Composer request, and `canHandOff` checks the script with
  `planBrowserRun`. The tool then answers that the run happens when the turn
  ends. The result carries `browserRun`, and the loop skips its own verify
  run. `run.ts` (`continueWithBrowserRun`) runs the script against the staged
  edits, re-runs a failure on the applied files to spot one that was already
  there, and sends the output as the next turn. That turn counts
  `browserRuns.used`: at `MAX_BROWSER_RUNS` (3) the tool falls back to the
  sandbox. A script the tab could not run goes in `browserRuns.unsupported`,
  so it is not handed off again.
  - Not while planning, and never for crew workers, whose results merge into
    one reply.
  - A handed-off message is marked `autoFixed`, so the automatic test fix
    does not answer the same run twice.
  - The report turn drops edits and a plan it returns unchanged
    (`withoutUnchanged`), and skips the recap when it changed nothing.
  - When the agent itself just ran the verify script in the sandbox on the
    same edits, the verify step reuses that run instead of paying for a
    second one.
  - The replay model calls `run_script("test")` after staging a fix. It
    answers the report turn from `parseContinuation`, repeating what the run
    said, pass or fail.
  - "Was it already failing" compares the two runs test by test
    (`runner/compare.ts`, using each run's `failures`), not by the first error
    line. With several failing tests, a fix for one changes the first error
    line, which must not blame the change for the rest. The report turn names
    the tests the edits fixed ("Now passing").
  - The report turn and the automatic fix are sent with `automatic: true`.
    The chat shows them as "Automatic", not "You".
- `runScript` returns `ran`. A run that never executed (no sandbox, no
  allowance, the sandbox would not start) is reported as not run. It is never
  handed to the agent as a failure to fix. A real failure gets one fix attempt.
  The fix gets one re-run, and only if the edits actually changed.

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
