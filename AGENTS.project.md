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
- A cleanly staged edit ends a build turn (`editTurnStop` in `cost.ts`), so
  nothing a tape does after its edits ever runs. A tape ticks its plan off in
  the same round as its edits; otherwise the recap reads the plan as untouched.
  `replay.test.ts` checks this with `runTurn(…, { settle: true })`, which ends
  the turn the way the loop does.
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
  - The replay model calls `run_script("test")` after staging a fix when the
    turn goes on (an edit's own check is red, so it did not settle). It
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

## The landing page must not download the editor

Every route is code-split, `/app` included. The editor is most of the client
code: with `/app` unsplit (a `splitBehavior` exception in `vite.config.ts`, or
`codeSplitGroupings: []` on the route), every page downloaded about 1.7 MB of
JavaScript; split, the landing page needs about 0.5 MB. `scripts/e2e-demo.mjs`
fails above 800 KB, so do not bring either setting back.

## Server function inputs are schemas

Every `createServerFn` takes its input through a zod schema in
`src/lib/security/inputs.ts`, never `.validator((input: T) => input)`: a
TypeScript type says what the editor sends, not what reaches the endpoint. The
agent request is a loose object, so a new `AgentInput` field passes through
before its schema line exists; give it one anyway.

## Themes and the editor's colours

`cursor` and `claude` are the dark themes, `light` the light one, `system`
follows the OS (`src/lib/appearance.ts`; the head script `THEME_BOOT_SCRIPT`
applies the same choice before React loads, and `appearance.test.ts` checks
the two agree). The editor and syntax colours are CSS variables (`ED` and
`SYN` in `src/lib/editor/theme.ts`) that fall back to the dark hex values, so
a theme recolours the editor by setting `--ed-*` and `--syn-*`; the light block
in `styles.css` does. Use `ED`/`SYN`, not `EDITOR`/`SYNTAX`, in editor styles,
or that colour stays dark in the light theme. Text colours clear 4.5:1 on the
surfaces they sit on; check a new one before adding it.

## End to end in CI

`scripts/e2e-demo.mjs` runs the replay demo in Chromium against a production
build (CI job "end to end (replay demo)"): landing size and console, plan →
editing the plan → Build it → recap → the agent board → checks → Apply →
Revert, a type error's
margin dot and F7, and the phone layout.

F8 belongs to review hunks (ide-shell's window handler); F7 to check
problems inside the editor (`src/lib/editor/marks.ts`). Don't bind either key
to anything else. Locally:
`VITE_AUTH_ENABLED=false npm run build`, then `APERTURE_MODEL=replay
VITE_AUTH_ENABLED=false npm run preview -- --port 8095`, then
`node scripts/e2e-demo.mjs http://127.0.0.1:8095`.

## The benchmark must stay true

`src/lib/bench/` runs the cases in `cases.ts` through the editor's own
`changeChecks`, with the real compiler and the browser's test runner run in
Node, and `/benchmark` shows `results.json`. `bench.test.ts` recomputes the
results and fails when they differ: a change to any check that changes what is
caught means running `npm run bench` and committing the new `results.json`, so
the page never claims more than the checks do. Add a case when a check learns
something new, and keep the cases it misses: they are part of the claim.

## Types is real tsc, in a worker

`tsc-core.ts` runs the compiler on an in-memory project (tested in Node with
the real `typescript` package); `tsc.worker.ts` runs it off the main thread,
loading each standard-library file as its own chunk (`worker.format: "es"` in
`vite.config.ts` makes that possible: an IIFE worker inlines all 99 of them).
`tsc.ts` is the client: it checks the changed files and their direct importers,
before and after the change, and `checks.ts` turns that into the Types row
(new errors red, old ones amber). Packages, Node and test-runner globals, and
implicit `any` are not reported: the editor has no `node_modules`, so they
would fail every project. The compiler is warmed when a Composer turn starts
(`warmTypecheck` in `run.ts`). The light check (`type-check.ts`) still runs in
the agent's own turn on the server and stands in when tsc cannot run.

## The agent loop runs in two places

`src/lib/agent/loop.ts` is the loop, with no server imports: what it needs from
where it runs comes in a `LoopHost` (model calls, a sandbox script runner, MCP
tools). `loop.server.ts` passes the server's; `local-run.ts` passes a model
client for Ollama or LM Studio on `localhost` (`local-model.ts`) and nothing
else, and runs the loop in the browser tab when the model source is `local`.
Keep `loop.ts` free of `*.server` imports, `process`, and Node built-ins, or the
browser build breaks or ships server code. The local model's address lives in
the browser's storage (`aperture-local-model`); the server refuses the `local`
source (`LOCAL_RUNS_IN_BROWSER`) for anything it would have to run itself.
`local-model.ts` only accepts loopback addresses, so the page cannot be used
to probe the network.

## Runs and the agent board

A run is a request and every turn that answers it. `submitAgent` stamps each
turn's `runId` with `runIdFor` (`src/lib/workspace/board.ts`): Build it joins
the plan's run; the editor's own turns (`automatic`) and turns kept to a copy
join the run they answer; other follow-ups (Iterate, Fix this) join the latest
run only while it still has a staged change; anything else starts a run.
Chats saved before runs had ids are grouped by `groupRuns`. A new place that
adds chat messages must set `runId` too (see `openJobInComposer`), or the
message joins whatever run came before it.

The board (`agent-board.tsx`, Ctrl/Cmd+J) stores nothing: it reads the chat
and the jobs the Composer panel loaded (`ui-store.boardJobs`).

## Background runs

`background.ts` holds the state and the rules (pure, tested);
`background-runner.ts` runs them in the tab. A run is a fresh Composer turn
(`agentPayload(..., { files: snapshot, fresh: true, phase: "skip" })`)
streamed through `openAgentStream`, the same path `submitAgent` uses, so every
model source works. It never touches the thread, `agentRunning` or the open
files.

- `checkInBackground` runs the strip's checks without the strip. The page
  render needs the editor, so the Preview row says it renders when opened.
- A red result gets the one automatic fix (not under replay).
- `openBackgroundRun` rebases the edits onto the current files with
  `mergeThree` (`merge3.ts`), forks a copy when another change is pending,
  and adds the user and assistant messages with their own `runId`.
- Runs are saved in `localStorage` (`aperture-background-runs`) per workspace
  name; one that was working when the page closed is restored as stopped.

The server jobs in `src/lib/jobs` remain for external agents (ACP) only.

## Pull request checks

`githubChecks` reads a commit's check runs and commit statuses; for at most
three failed checks it adds failure annotations and the end of the Actions
job log (`ci.ts` parses and trims, with tests built from real GitHub
responses). The job log is fetched from the redirect GitHub gives, only on
`*.actions.githubusercontent.com` or `*.blob.core.windows.net`, without the
token. The status bar badge (`pr-checks.tsx`) polls every 30 seconds only
while checks run and the tab is visible. "Fix with Composer" is refused while
a change is staged or local edits are unpushed, so the fix starts from what CI
ran. Nothing in this loop runs without a click.

## Runtime evidence for a fix

`runner/stack.ts` turns what a run saw into evidence an agent can act on.

- **Tests.** The runtime records the first five failures in full (`details`:
  message and stack). `bundle.ts` returns `lines`, where each module's code
  starts in the bundle. `mapStack` reads a stack line back as file:line;
  sucrase keeps line numbers, and the worker's one-line prelude is the offset.
- **Pages.** Scripts are inlined with `data-from`, so `mapDocLine` maps a
  document line to the script file. The page's own inline code maps to
  nothing rather than to a shifted line.
- **Fix prompt.** `CheckRow.evidence` carries it. `lookPrompt` sends every red
  row and their evidence (`LOOK_EVIDENCE_LIMIT`); amber rows send none. "Send
  back" uses the same prompt through `checkHint.prompt`.
- **Live preview.** Errors in the live preview go into every Composer turn as
  `AgentInput.runtime`.

Verified in Chromium: an error in an inlined script maps to the exact line and
function.

## Hooks and rules for some files

`hooks.ts` parses `.aperture/hooks.json`; `hook-runner.ts` runs a hook with
the browser test runner (`runTestsInBrowser(files, { script })`), so a hook has
the runner's limits and is "not run", never a pass, when it needs a real Node.

- **Stage hooks** are rows in `changeChecks` (`hookRow`, id `hook:<id>`).
  They are judged like the tests: a failure the applied files already have is
  amber. `useStageHooks` in `check-results.tsx` reads the hooks from the
  *applied* `hooks.json`, never the staged one, so a change cannot disable
  its own judge.
- **Save hooks** run on Ctrl/Cmd+S (`runSaveHooks` in `hooks-badge.tsx`) and
  show in the status bar.
- **Scoped rules.** `.aperture/rules/*.md` (`scoped-rules.ts`) reach the agent
  through `RuleLoader` in `loop.ts`. Rules for the files the turn starts on
  (the active file, the selection, `@` mentions, focus paths and pending
  edits) go into the system prompt. A rule for a file the agent reaches later
  is appended to that `read_file` or `propose_edit` result, once. The paths
  given go back on the message as `rules`.

Each rule is cut at `RULE_LIMIT.chars`. Past the total budget, a whole rule is
left out, so a later rule is never cut off halfway. The project-wide rules file (`findRules`: `.aperture.md`,
`AGENTS.md`…) is unchanged and still goes into every turn.

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
