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
    types: [created, edited]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  bot:
    # Starts a runner only when the bot is asked: a comment or a ticked suggestion.
    if: >-
      (github.event_name == 'issue_comment' && github.event.action == 'created' && startsWith(github.event.comment.body, '/aperture'))
      || (github.event_name == 'issue_comment' && github.event.action == 'edited' && github.event.sender.type != 'Bot'
          && contains(github.event.comment.body, '<!-- aperture-bot ') && contains(github.event.comment.body, '- [x] '))
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

## Review a pull request

Comment `/aperture review` on a pull request and the bot reviews its changes: a GitHub review with a comment on the line of each likely bug, and a reply that lists them with their fixes to tick. Only what it is at least 80% sure is a bug is posted; when nothing is, it says so in one line. It reads the changes from git (a fork's too, never checked out or run), changes nothing, and uses the model key for one short call. A later review does not repeat a comment already on its line.

To review every push, see `pull-requests` under Standing jobs.

## Ask it a question

A comment that asks something is answered on the thread, and nothing is changed:

```
/aperture why does the checkout test fail on this branch?
/aperture explain what this pull request changes
```

It reads the code (on a pull request from this repository, at the pull request's head), the thread, a pull request's diff and the checks failing on it, and answers with the files and lines it found. A comment is a question when it ends with `?`, starts with a question word (why, what, how, explain, summarize, …) or starts with `ask`. "Can you add a dark mode?" is a request, so it is a task.

## Tick a suggestion

Every reply ends with what the bot would do next, as boxes:

```
**Next, I would suggest**
- [ ] Add a test for an empty cart
- [ ] Round half cents up
```

Tick one and the bot does it, as if you had commented `/aperture` and the task: a pull request when Agent Check is clear, or a reply that says why not. The line is then marked started, with a link to the run, so ticking it again does nothing. Only a suggestion the bot made counts, and only when the person who ticks it can write: its reply carries the list, hidden and signed with a key derived from `model-key`, for that thread only. A tick on a list without that signature (another bot's look-alike, a copy from another thread, or a reply from before v1.6) starts nothing, and the bot replies with the task for you to ask for with `/aperture` if you meant it. Changing `model-key` makes older suggestions untickable for the same reason. Read a suggestion before you tick it: one in a reply nobody asked for can come from what anyone wrote. Nothing the bot posts from others' words can @mention anyone. Ticking needs the workflow above, which listens for edited comments; an older one that listens only for new comments needs `types: [created, edited]` and its `if:` line.

## Talk it through

With `follow-threads: true`, you reply to the bot as you would to a colleague: no `/aperture`. Right after one of its replies, "yes" or "do the second one" does that suggestion, exactly as ticking its box would, and anything else ("why?", "what about half cents?") is answered on the thread, changing nothing, with the reply it follows in mind. Its answer can end with suggestions of its own, so the conversation goes on until you say yes. "Thanks" gets no answer.

It follows only whoever its reply answered (on threads it started itself, such as the daily brief, a new issue or red CI, anyone who can write), and never a comment that @mentions someone, which is meant for them. For the bot to see such comments, the workflow also runs on new comments from the repository's owner, members and collaborators; it leaves any that do not follow one of its replies within seconds:

```yaml
if: >-
  (github.event_name == 'issue_comment' && github.event.action == 'created' && startsWith(github.event.comment.body, '/aperture'))
  || (github.event_name == 'issue_comment' && github.event.action == 'created' && github.event.comment.user.type != 'Bot'
      && contains(fromJSON('["OWNER", "MEMBER", "COLLABORATOR"]'), github.event.comment.author_association))
```

"Follow its own threads" on the Bot page writes both for you.

## Post to Slack

Give the bot a Slack [incoming webhook](https://api.slack.com/messaging/webhooks) and the work it does unasked shows in that channel too: the daily brief (with the week's digest on Mondays), a red run it explained (and whether it is fixing it), and a pull request it opened without being asked. Each links back to GitHub. Add the webhook as the repository secret `SLACK_WEBHOOK_URL`, then:

```yaml
slack-webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

Only a Slack webhook address is posted to, and it is never written to the log. Words from GitHub and the model are posted as words: nothing in them can ping `@channel` or become a link. If Slack does not answer, the run goes on without it. "Post to Slack" on the Bot page writes the line for you.

## What it does

| Asked on                            | When Agent Check is clear                                                                                                   | Otherwise                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| An issue                            | A branch `aperture/<number>-<title>` and a pull request that fixes the issue, with the plan, the checks and the tokens used | A reply with what is still red and the change, not pushed |
| A pull request from this repository | A commit on its branch                                                                                                      | The same reply                                            |
| A pull request from a fork          | Nothing: it replies that it will not run a fork's code                                                                      |                                                           |

It works with the TypeScript compiler, as the editor does: it can list every place a name is used, through imports under another name, and rename a name everywhere the way F2 does. Its reply ends with what it changed and an "Elsewhere:" line from the compiler: the files and lines that still use a name the change touched, or that still import one it removed.

## Check a pull request

Comment `/aperture check` on a pull request and the bot runs Aperture Agent Check on it, against its base, and replies with the report: each check, what is red, and the evidence. It changes nothing and does not call a model, so it needs no model key. Tests run in the same sandbox as the bot's own. The run fails when a check is red, so it can be a required check.

While it works, one comment on the thread says what it is doing and links the run; at the end that comment becomes its reply. [The Bot page](https://aperturesais.grok.me/bot) shows every task on a repo in one place, and can ask the bot and add this workflow for you.

Only people with write access to the repository can ask; anyone else's comment is ignored. Other bots' comments are never commands, and an edited comment is only ever a ticked suggestion.

## Standing jobs

More ways to put the bot to work, all optional, all on your runner:

- **The `aperture` label.** Add it to an issue and the bot does what the issue says, as if you had commented `/aperture`. Only a label added by someone with write access counts.
- **A schedule.** Set `scheduled` and give the workflow a `schedule`. `fix-ci` fixes whatever is red on the default branch: when the branch is green, or the bot's last fix is still waiting for review, it does nothing. `look-over` is the daily brief, and changes nothing: on its own issue it posts what needs you (CI on the default branch, pull requests waiting for review, issues quiet for two weeks, read from GitHub) and up to five ideas from reading the code (likely bugs, untested paths, TODOs worth finishing, what an open issue asks), as boxes to tick. On Mondays (UTC) it also says what the bot did in the last seven days: pull requests opened and what became of them, likely bugs its reviews caught, what it answered and what it checked, counted from its own replies, with no model call. With `always-allow: brief` the bot also does the first idea from the code at once, without a tick: a pull request only when Agent Check is clear, and one at a time, so nothing new starts while the last one waits for review. An idea naming an issue (`Do what #12 asks`) still waits for a tick, since anyone can write an issue. Any other text is a task done each time, such as `Update links in docs/ that no longer resolve`. Each job reports on its own issue, which its pull requests fix.
- **Every pull request.** Add `pull_request` to the workflow's triggers and each push to a pull request from this repository is checked, as with `/aperture check`. The report is one comment, updated on each push. Drafts are checked once they are ready for review.
- **Review every pull request.** With `pull_request` in the triggers, set `pull-requests: review` (or `check, review` for both) and each push to a pull request from this repository is reviewed, as with `/aperture review`. The reply is one comment, updated on each push.
- **Every new issue.** Add `opened` to the `issues` types and the bot reads each new issue and the code, and replies with what it understands, where in the code it lives and how it would fix it, or asks for what is missing. Its first suggestion is the issue itself: tick it and the bot does it. It changes nothing on its own, so anyone's issue is read; at most `daily-limit` such replies a day, each spending at most 150,000 tokens whatever `max-tokens` allows, and they queue one at a time so a burst of issues cannot slip past the limit.
- **Red CI on the default branch.** Add `workflow_run` with your other workflows' names, and when one fails on the default branch the bot explains why on its own issue (`Aperture Bot: main is red`), once per red commit, with the fix to tick. The issue's body lists what fails, so a ticked fix reads it. These replies count toward `daily-limit` too. With `always-allow: red` the bot also fixes it at once, without a tick: a pull request, only when Agent Check is clear.

```yaml
on:
  issue_comment:
    types: [created, edited]
  issues:
    types: [opened, labeled]
  schedule:
    - cron: "17 3 * * *" # every night at 03:17 UTC
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_run:
    workflows: ["CI"] # your other workflows, by name
    types: [completed]

jobs:
  bot:
    if: >-
      (github.event_name == 'issue_comment' && github.event.action == 'created' && startsWith(github.event.comment.body, '/aperture')) ||
      (github.event_name == 'issue_comment' && github.event.action == 'edited' && github.event.sender.type != 'Bot' &&
        contains(github.event.comment.body, '<!-- aperture-bot ') && contains(github.event.comment.body, '- [x] ')) ||
      (github.event_name == 'issues' && github.event.action == 'opened' && github.event.sender.type != 'Bot') ||
      (github.event_name == 'issues' && github.event.label.name == 'aperture') ||
      github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) ||
      (github.event_name == 'workflow_run' && github.event.workflow_run.head_branch == github.event.repository.default_branch &&
        github.event.workflow_run.head_repository.full_name == github.repository &&
        contains(fromJSON('["failure", "timed_out"]'), github.event.workflow_run.conclusion))
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

| Input               | Default                              | What it does                                                                                                                                                   |
| ------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model-key`         |                                      | The model provider's API key, from a secret. Required, but checks do not use it.                                                                               |
| `provider`          | `grok`                               | `grok`, `openai`, `anthropic`, `gemini`, `deepseek` or `custom`.                                                                                               |
| `base-url`          |                                      | For `custom`: an OpenAI-compatible endpoint.                                                                                                                   |
| `model`             |                                      | For `custom`: the model to ask for.                                                                                                                            |
| `github-token`      | the workflow's token                 | Comments, pushes and pull requests.                                                                                                                            |
| `trigger`           | `/aperture`                          | The word a comment starts with.                                                                                                                                |
| `label`             | `aperture`                           | The label that asks the bot to do what an issue says.                                                                                                          |
| `scheduled`         |                                      | On the schedule: `fix-ci`, `look-over`, or a task to do each time. Empty: nothing.                                                                             |
| `test-script`       | `test`                               | The package.json script that runs the tests.                                                                                                                   |
| `timeout-minutes`   | `10`                                 | How long one test run may take.                                                                                                                                |
| `max-tokens`        | `1000000`                            | The token budget for one run.                                                                                                                                  |
| `rounds`            | `2`                                  | How many times Agent Check may run before the bot gives up.                                                                                                    |
| `pull-requests`     | `check`                              | What a push to a pull request starts: `check`, `review`, or `check, review`.                                                                                   |
| `always-allow`      |                                      | `red` fixes a workflow red on the default branch, and `brief` does the daily brief's first idea from the code, without waiting for a tick. Both: `red, brief`. |
| `follow-threads`    |                                      | `true`: a reply to one of the bot's replies needs no `/aperture` (see Talk it through).                                                                        |
| `slack-webhook`     |                                      | A Slack incoming webhook, from a secret: unasked work is posted there too (see Post to Slack).                                                                 |
| `daily-limit`       | `20`                                 | Replies nobody asked for (new issues, red runs) a day at most.                                                                                                 |
| `install`           | `auto`                               | `npm ci --ignore-scripts` when there is a package-lock.json and no `node_modules`; `none` to install yourself in an earlier step (pnpm, Yarn).                 |
| `sandbox-image`     | `mirror.gcr.io/library/node:22-slim` | The Docker image tests run in.                                                                                                                                 |
| `working-directory` | the repository root                  | The project's folder in a monorepo.                                                                                                                            |

Outputs: `outcome` (`clear`, `red`, `stopped`, `no-change`, `declined`, `ignored` or `error`), `pull-request`, `commit`, and after a check `verdict` (`red` or `clear`).

## Good to know

- **CI on the bot's pull requests.** GitHub does not start workflows for pushes and pull requests made with the workflow's own token. Pass a fine-grained personal access token or a GitHub App token as `github-token` (contents, pull requests and issues: read and write) and your CI runs on them as usual. Agent Check has already run either way.
- **Linux runners.** The test sandbox needs Docker, which GitHub's Ubuntu runners have.
- **Your tests run on the bot's code.** That is the point, and why they run in the sandbox. Install scripts never run: packages are installed with `--ignore-scripts`.

## Source

Built from [`packages/aperture-bot`](https://github.com/Hankaws/aperture/tree/main/packages/aperture-bot) in Hankaws/aperture. MIT.
