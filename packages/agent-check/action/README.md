# Aperture Agent Check

**Catches AI agents' mistakes in pull requests, before they merge.**

Copilot, Codex, Claude Code, Grok Bot and other agents now open pull requests on their own. Aperture Agent Check runs on every one of them, and on yours, and answers with the checks the [Aperture](https://aperturesais.grok.me) editor runs on every staged change:

- **Parses**: every changed file parses.
- **Imports resolve**: `import`, `export … from` and `require()` point at files that exist and packages in `package.json`, including in files that imported something the change deleted.
- **Types**: the real TypeScript compiler with your installed packages' types, before and after, so only errors this change brings in are red, in the changed files and in the files that use them.
- **Tests**: the project's own test script on this runner. If it fails, the base runs too, and a failure that was already there is reported as one, not blamed on the change. A change that skips, deletes, narrows or cuts short the tests is red even when what is left passes.

A red check puts an annotation on the line in the pull request's **Files changed** tab and fails the step; the run's summary lists everything.

## Use it

```yaml
# .github/workflows/aperture-agent-check.yml
name: Aperture Agent Check
on: pull_request

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # the check compares against the pull request's base
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci # only needed for the tests
      - uses: hankaws/aperture-agent-check@v1
```

Make it a required check in the branch's protection rules, and a red check blocks the merge.

| Input               | Default                 |                                              |
| ------------------- | ----------------------- | -------------------------------------------- |
| `run-tests`         | `true`                  | Run `npm run <test-script>`.                 |
| `test-script`       | `test`                  | The package.json script that runs the tests. |
| `timeout-minutes`   | `10`                    | How long one test run may take.              |
| `fail-on`           | `red`                   | `never` reports without failing the step.    |
| `base`              | the pull request's base | Branch, tag or commit to compare against.    |
| `working-directory` | repository root         | The project's folder in a monorepo.          |

Output: `verdict`, `red` or `clear`.

## What leaves the runner

Nothing. The checks run in this step: no token, no network, no account. Free.

**Use it on `pull_request`, not `pull_request_target`.** With tests on, it runs the pull request's code, as any test step does. Under `pull_request_target` that code would run with your repository's secrets.

## What it does not do

- It checks JavaScript and TypeScript (plus JSON, HTML and CSS for parsing). Other languages are listed as not checked.
- Types uses the installed packages' real types when the dependencies are installed before the step (the `npm ci` above), so it reports what your own `tsc` would. Without them, packages are typed loosely and a mistake only a package's types would show is not caught.
- A project over 5,000 files or 50 MB of source is not checked, and says so instead of passing.

## Badge

```markdown
[![Checked by Aperture Agent Check](https://img.shields.io/badge/checked%20by-Aperture%20Agent%20Check-7c3aed)](https://aperturesais.grok.me/bot?tab=check)
```

## How good is it

These are the checks the [Aperture benchmark](https://aperturesais.grok.me/benchmark) measures on 48 edits an agent might make. With the tests run, they stop 27 of the 27 mistakes a check can see. Without running anything, 20 of the 33 bad edits. 1 of the 15 correct edits is flagged.

The source is in [Hankaws/aperture](https://github.com/Hankaws/aperture/tree/main/packages/agent-check); `dist/` here is built from it.
