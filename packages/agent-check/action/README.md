# Aperture Agent Check

**Catches AI agents' mistakes in pull requests, before they merge.**

Copilot, Codex, Claude Code, Grok Bot and other agents now open pull requests on their own. Aperture Agent Check runs on every one of them, and on yours, and answers with the checks the [Aperture](https://aperturesais.grok.me) editor runs on every staged change:

- **Parses**: every changed file parses.
- **Imports resolve**: `import`, `export … from` and `require()` point at files that exist and packages in `package.json`, including in files that imported something the change deleted.
- **Types**: the real TypeScript compiler with your installed packages' types, before and after, so only errors this change brings in are red, in the changed files and in the files that use them.
- **Tests**: the project's own test script on this runner. If it fails, the base runs too, and a failure that was already there is reported as one, not blamed on the change. A change that skips, deletes, narrows or cuts short the tests is red even when what is left passes.
- **Safety**: red for a key or token written into the code (GitHub, AWS, xAI, OpenAI, Anthropic, Google, Slack, Stripe, a private key) or values written into a `.env` file, and for a check switched off: `// @ts-nocheck`, `strict` loosened in tsconfig, a lint or typecheck script emptied. Amber, to look at and not held, for a new dependency, one installed from a URL, an install script, an edited CI workflow, a lockfile that moved with no dependency change, and a new `@ts-ignore` or `eslint-disable`. Safety reads every changed text file, code or not, so a key in a workflow, a YAML config, a `.pem` or a Python script is red too. A key is never repeated, only its kind and line.
- **Project checks**: your project's own rules, in `.aperture/checks.json`: a pattern for one line, the files it applies to, the line it was made to catch, and what to write instead. Each line a pull request adds is read against them, code or not, so a mistake you have seen once is red every time after. The checks come from the base branch, so a pull request cannot remove one to get past it, and Safety says when one is removed or changed. In the Aperture editor, **Make it a check** under a red check asks Composer to write the check for that mistake, and a new check must catch its own example before it is kept.

A red check puts an annotation on the line in the pull request's **Files changed** tab and fails the step; the run's summary lists everything, under a badge that says how it went:

[![Checked by Aperture: nothing red](https://aperturesais.grok.me/badges/agent-check-clear.svg)](https://aperturesais.grok.me/check) [![Checked by Aperture: held back](https://aperturesais.grok.me/badges/agent-check-red.svg)](https://aperturesais.grok.me/check)

The badge links the pull request on [Aperture's public checker](https://aperturesais.grok.me/check), so anyone reviewing it can open it there.

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

### The result on the pull request itself

With `comment: true`, Agent Check keeps one comment on the pull request: the badge, the verdict and a line per check, updated in place on every push, so it never piles up. The job needs permission to write it:

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      # … as above
      - uses: hankaws/aperture-agent-check@v1
        with:
          comment: true
```

Without the permission, or on a pull request from a fork (whose token GitHub keeps read-only), the run says it could not post and the checks stand as they are.

| Input               | Default                 |                                              |
| ------------------- | ----------------------- | -------------------------------------------- |
| `run-tests`         | `true`                  | Run `npm run <test-script>`.                 |
| `test-script`       | `test`                  | The package.json script that runs the tests. |
| `timeout-minutes`   | `10`                    | How long one test run may take.              |
| `fail-on`           | `red`                   | `never` reports without failing the step.    |
| `base`              | the pull request's base | Branch, tag or commit to compare against.    |
| `working-directory` | repository root         | The project's folder in a monorepo.          |
| `baseline`          | `recompute`             | `cache` stores the base test result by commit and reuses it while that commit stays the base. |
| `baseline-dir`      | `.aperture/check-baseline` | Where the cache is written, when `baseline` is `cache`. |
| `comment`           | `false`                 | `true` keeps one comment on the pull request with the result. |
| `github-token`      | the workflow's token    | What the comment is posted with. |

Output: `verdict`, `red` or `clear`.

## What leaves the runner

Nothing, unless you turn on `comment`. The checks run in this step: no network, no account. Free. With `comment: true`, the one comment goes to GitHub's own API with the workflow's token, and nowhere else. The badge is a picture GitHub loads from aperturesais.grok.me when someone views the page, through GitHub's image proxy; the runner sends nothing for it.

**Use it on `pull_request`, not `pull_request_target`.** With tests on, it runs the pull request's code, as any test step does. Under `pull_request_target` that code would run with your repository's secrets.

## What it does not do

- It checks JavaScript and TypeScript (plus JSON, HTML and CSS for parsing). Other languages are listed as not checked.
- Types uses the installed packages' real types when the dependencies are installed before the step (the `npm ci` above), so it reports what your own `tsc` would. Without them, packages are typed loosely and a mistake only a package's types would show is not caught.
- A project over 5,000 files or 50 MB of source is not checked, and says so instead of passing.
- The base tests run again on every check. Set `baseline: cache` to keep that result for the base commit, which is the per-branch option when the base is not moving. The default stays `recompute`. A GitHub-hosted runner starts empty each time, so keep the folder between runs with `actions/cache`, before this step:

  ```yaml
  - uses: actions/cache@v4
    with:
      path: .aperture/check-baseline
      key: aperture-check-baseline-${{ github.event.pull_request.base.sha }}
  ```

## Badge

```markdown
[![Checked by Aperture Agent Check](https://img.shields.io/badge/checked%20by-Aperture%20Agent%20Check-7c3aed)](https://aperturesais.grok.me/bot?tab=check)
```

## How good is it

These are the checks the [Aperture benchmark](https://aperturesais.grok.me/benchmark) measures on 48 edits an agent might make. With the tests run, they stop 27 of the 27 mistakes a check can see. Without running anything, 20 of the 33 bad edits. 1 of the 15 correct edits is flagged.

The source is in [Hankaws/aperture](https://github.com/Hankaws/aperture/tree/main/packages/agent-check); `dist/` here is built from it.
