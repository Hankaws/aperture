# Aperture Bot

**The coding bot that checks before it pushes.**

Comment `/aperture` and a task on an issue or a pull request. Aperture Bot plans the change, makes it, and runs [Aperture Agent Check](https://aperturesais.grok.me/bot?tab=check) on it: parses, imports, types with your packages' real types, and your own tests. It opens a pull request only when nothing is red. When it cannot get there, it says so on the thread, with the change it did not push, and pushes nothing.

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

## Check a pull request

Comment `/aperture check` on a pull request and the bot runs Aperture Agent Check on it, against its base, and replies with the report: each check, what is red, and the evidence. It changes nothing and does not call a model, so it needs no model key. Tests run in the same sandbox as the bot's own. The run fails when a check is red, so it can be a required check.

While it works, one comment on the thread says what it is doing and links the run; at the end that comment becomes its reply. [The Bot page](https://aperturesais.grok.me/bot) shows every task on a repo in one place, and can ask the bot and add this workflow for you.

Only people with write access to the repository can ask; anyone else's comment is ignored. Edited comments and other bots' comments are never commands.

## Standing jobs

Three more ways to ask, all optional, all on your runner:

- **The `aperture` label.** Add it to an issue and the bot does what the issue says, as if you had commented `/aperture`. Only a label added by someone with write access counts.
- **A schedule.** Set `scheduled` and give the workflow a `schedule`. `fix-ci` fixes whatever is red on the default branch: when the branch is green, or the bot's last fix is still waiting for review, it does nothing. Any other text is a task done each time, such as `Update links in docs/ that no longer resolve`. Each job reports on its own issue, which its pull requests fix.
- **Every pull request.** Add `pull_request` to the workflow's triggers and each push to a pull request from this repository is checked, as with `/aperture check`. The report is one comment, updated on each push. Drafts are checked once they are ready for review.

```yaml
on:
  issue_comment:
    types: [created]
  issues:
    types: [labeled]
  schedule:
    - cron: "17 3 * * *" # every night at 03:17 UTC
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  bot:
    if: >-
      (github.event_name == 'issue_comment' && startsWith(github.event.comment.body, '/aperture')) ||
      (github.event_name == 'issues' && github.event.label.name == 'aperture') ||
      github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository)
    # … the same steps as above, with:
    #     scheduled: fix-ci
```

The [Bot page](https://aperturesais.grok.me/bot) writes this for you.

## Its own name and avatar

With the workflow's token the bot posts as `github-actions[bot]`, and the pull requests it opens do not start your CI. Give it a GitHub App of yours and it posts, commits and opens pull requests as that app, with its avatar, and its pull requests run CI like anyone's.

1. Create a GitHub App (the [Bot page](https://aperturesais.grok.me/bot) prefills one): no webhook; Contents, Issues and Pull requests read and write; Checks, Commit statuses and Actions read. Upload [the avatar](https://aperturesais.grok.me/bot/aperture-bot.png) as its logo.
2. Generate a private key on the app's page, and install the app on the repository.
3. Add the app's ID as the variable `APERTURE_BOT_APP_ID` and the private key as the secret `APERTURE_BOT_PRIVATE_KEY`, then use them in the workflow:

```yaml
steps:
  - uses: actions/create-github-app-token@v1
    id: app
    with:
      app-id: ${{ vars.APERTURE_BOT_APP_ID }}
      private-key: ${{ secrets.APERTURE_BOT_PRIVATE_KEY }}
  - uses: actions/checkout@v4
    with:
      token: ${{ steps.app.outputs.token }}
  # … setup-node as above
  - uses: hankaws/aperture-bot@v1
    with:
      model-key: ${{ secrets.XAI_API_KEY }}
      github-token: ${{ steps.app.outputs.token }}
```

The bot names its commits after whoever its comments post as, so they show the app too.

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
| `model-key`         |                                      | The model provider's API key, from a secret. Required, but checks do not use it.                                                               |
| `provider`          | `grok`                               | `grok`, `openai`, `anthropic`, `gemini`, `deepseek` or `custom`.                                                                               |
| `base-url`          |                                      | For `custom`: an OpenAI-compatible endpoint.                                                                                                   |
| `model`             |                                      | For `custom`: the model to ask for.                                                                                                            |
| `github-token`      | the workflow's token                 | Comments, pushes and pull requests.                                                                                                            |
| `trigger`           | `/aperture`                          | The word a comment starts with.                                                                                                                |
| `label`             | `aperture`                           | The label that asks the bot to do what an issue says.                                                                                          |
| `scheduled`         |                                      | On the schedule: `fix-ci`, or a task to do each time. Empty: nothing.                                                                          |
| `test-script`       | `test`                               | The package.json script that runs the tests.                                                                                                   |
| `timeout-minutes`   | `10`                                 | How long one test run may take.                                                                                                                |
| `max-tokens`        | `1000000`                            | The token budget for one run.                                                                                                                  |
| `rounds`            | `2`                                  | How many times Agent Check may run before the bot gives up.                                                                                    |
| `install`           | `auto`                               | `npm ci --ignore-scripts` when there is a package-lock.json and no `node_modules`; `none` to install yourself in an earlier step (pnpm, Yarn). |
| `sandbox-image`     | `mirror.gcr.io/library/node:22-slim` | The Docker image tests run in.                                                                                                                 |
| `working-directory` | the repository root                  | The project's folder in a monorepo.                                                                                                            |

Outputs: `outcome` (`clear`, `red`, `stopped`, `no-change`, `declined`, `ignored` or `error`), `pull-request`, `commit`, and after a check `verdict` (`red` or `clear`).

## Good to know

- **CI on the bot's pull requests.** GitHub does not start workflows for pushes and pull requests made with the workflow's own token. Pass a fine-grained personal access token or a GitHub App token as `github-token` (contents, pull requests and issues: read and write) and your CI runs on them as usual. Agent Check has already run either way.
- **Linux runners.** The test sandbox needs Docker, which GitHub's Ubuntu runners have.
- **Your tests run on the bot's code.** That is the point, and why they run in the sandbox. Install scripts never run: packages are installed with `--ignore-scripts`.

## Source

Built from [`packages/aperture-bot`](https://github.com/Hankaws/aperture/tree/main/packages/aperture-bot) in Hankaws/aperture. MIT.
