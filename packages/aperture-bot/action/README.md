# Aperture Bot

**The coding bot that checks before it pushes.**

Comment `/aperture` and a task on an issue or a pull request. Aperture Bot plans the change, makes it, and runs [Aperture Agent Check](https://aperturesais.grok.me/agent-check) on it: parses, imports, types with your packages' real types, and your own tests. It opens a pull request only when nothing is red. When it cannot get there, it says so on the thread, with the change it did not push, and pushes nothing.

It runs on your runner with your model key. There is no Aperture account, server or bill.

## Add it

1. Add your model provider's key as a repository secret: Settings, Secrets and variables, Actions, New repository secret. Name it `XAI_API_KEY` (or whatever you pass below).
2. Let workflows open pull requests: Settings, Actions, General, Workflow permissions, tick "Allow GitHub Actions to create and approve pull requests".
3. Add this workflow:

```yaml
# .github/workflows/aperture-bot.yml
name: Aperture Bot
on:
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  bot:
    # Starts a runner only for comments that ask the bot.
    if: startsWith(github.event.comment.body, '/aperture')
    runs-on: ubuntu-latest
    timeout-minutes: 45
    concurrency:
      group: aperture-bot-${{ github.event.issue.number }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: hankaws/aperture-bot@v1
        with:
          model-key: ${{ secrets.XAI_API_KEY }}
```

Then, on an issue:

```
/aperture Show prices in dollars, with two decimals
```

`/aperture` alone asks it to do what the issue says.

## What it does

| Asked on                            | When Agent Check is clear                                                                                                   | Otherwise                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| An issue                            | A branch `aperture/<number>-<title>` and a pull request that fixes the issue, with the plan, the checks and the tokens used | A reply with what is still red and the change, not pushed |
| A pull request from this repository | A commit on its branch                                                                                                      | The same reply                                            |
| A pull request from a fork          | Nothing: it replies that it will not run a fork's code                                                                      |                                                           |

Only people with write access to the repository can ask; anyone else's comment is ignored. Edited comments and other bots' comments are never commands.

## What it will not do

- **Run code next to a secret.** Your tests run on a copy of the project without `.git`, in a container with no network and none of the runner's environment: no model key, no GitHub token.
- **Touch** `.github/`, secrets files or lockfiles. Edits to them are refused and listed.
- **Merge or approve** anything.
- **Spend past its budget.** It stops before a model call once it has used `max-tokens`, and every pull request says what it used.

## What leaves the runner

The task, the thread and the files the agent reads go to the model provider you chose, as with any coding agent. Nothing goes to Aperture.

## Settings

| Input               | Default                              | What it does                                                                                                                                   |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `model-key`         |                                      | The model provider's API key, from a secret. Required.                                                                                         |
| `provider`          | `grok`                               | `grok`, `openai`, `anthropic`, `gemini`, `deepseek` or `custom`.                                                                               |
| `base-url`          |                                      | For `custom`: an OpenAI-compatible endpoint.                                                                                                   |
| `model`             |                                      | For `custom`: the model to ask for.                                                                                                            |
| `github-token`      | the workflow's token                 | Comments, pushes and pull requests.                                                                                                            |
| `trigger`           | `/aperture`                          | The word a comment starts with.                                                                                                                |
| `test-script`       | `test`                               | The package.json script that runs the tests.                                                                                                   |
| `timeout-minutes`   | `10`                                 | How long one test run may take.                                                                                                                |
| `max-tokens`        | `1000000`                            | The token budget for one run.                                                                                                                  |
| `rounds`            | `2`                                  | How many times Agent Check may run before the bot gives up.                                                                                    |
| `install`           | `auto`                               | `npm ci --ignore-scripts` when there is a package-lock.json and no `node_modules`; `none` to install yourself in an earlier step (pnpm, Yarn). |
| `sandbox-image`     | `mirror.gcr.io/library/node:22-slim` | The Docker image tests run in.                                                                                                                 |
| `working-directory` | the repository root                  | The project's folder in a monorepo.                                                                                                            |

Outputs: `outcome` (`clear`, `red`, `stopped`, `no-change`, `declined`, `ignored` or `error`), `pull-request` and `commit`.

## Good to know

- **CI on the bot's pull requests.** GitHub does not start workflows for pushes and pull requests made with the workflow's own token. Pass a fine-grained personal access token or a GitHub App token as `github-token` (contents, pull requests and issues: read and write) and your CI runs on them as usual. Agent Check has already run either way.
- **Linux runners.** The test sandbox needs Docker, which GitHub's Ubuntu runners have.
- **Your tests run on the bot's code.** That is the point, and why they run in the sandbox. Install scripts never run: packages are installed with `--ignore-scripts`.

## Source

Built from [`packages/aperture-bot`](https://github.com/Hankaws/aperture/tree/main/packages/aperture-bot) in Hankaws/aperture. MIT.
