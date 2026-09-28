# Contributing to Aperture

Thanks for helping. Small, focused pull requests get merged fastest.

## Set up

```sh
npm ci
APERTURE_MODEL=replay VITE_AUTH_ENABLED=false npm run dev
```

The replay model lets you exercise the whole Composer flow without an API key:
plan, Build it, staged diffs, checks and apply. Open
<http://localhost:8080/app>.

## Before you open a pull request

CI runs these, so run them locally first:

```sh
npm run typecheck
npm run lint
npm test
```

Then:

- **Read [`AGENTS.project.md`](AGENTS.project.md).** It lists the traps in
  this repo that type-check and then fail. The one that catches everyone:
  tests run under bare Node, which does not resolve the `@/` import alias. A
  module that a test reaches must import with a relative path ending in `.ts`.
- **Add a test next to what you change** (`foo.ts` → `foo.test.ts`). Tests
  are found by glob, with no list to update.
- **Run what you changed.** Unit tests have passed over real bugs here more
  than once. If you touched the UI, try it in the browser, ideally with the
  replay model. If you touched the in-browser test runner, extend
  `src/lib/runner/runner.test.ts`, which runs real bundles.
- **Keep checks honest.** Nothing may report "passed" unless a check actually
  ran and passed. "Not run", with the reason, is always the fallback.

## Recording a new replay

The replay model's recorded runs live in `src/lib/agent/replay.ts`, and each
covers one task on the demo project. To add one, record its `search` strings
against `DEMO_FILES` exactly. `replay.test.ts` fails if a recorded edit stops
applying.

## Licensing

By contributing you agree your contribution is licensed under the MIT License.
Don't send code you don't have the right to license that way. The Grok App
Builder template files listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) are not ours to relicense:
keep changes to them minimal.
