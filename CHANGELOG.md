# Changelog

What changed in Aperture, newest first. Every pull request adds its line
under **Unreleased**; the site shows this file at `/changelog`. A heading
with a version number is the day that version was released, and its
release notes are every line from there down to the previous version.

## Unreleased

### Added

- Aperture Bot can post as a GitHub App of your own, with its own name and
  avatar, and the pull requests it opens then start your CI. The Bot page
  prefills the app on GitHub, links the avatar to upload, checks for its ID
  and key, and opens a pull request that switches the workflow to it. The
  private key stays on GitHub.
  ([#52](https://github.com/Hankaws/aperture/pull/52))
- Standing jobs for Aperture Bot. Add the `aperture` label to an issue and
  the bot does what it says. Give it a schedule and it fixes whatever is red
  on the default branch each night (quiet when it is green, or while its last
  fix waits for review), or does a task of yours each night or each Monday,
  on its own tracking issue. The Bot page shows a repository's jobs and opens
  a pull request that changes them, keeping the rest of the bot's settings.
  The bot also has a face on the page: the Aperture lens, which turns while
  it works, and an avatar image (`/bot/aperture-bot.png`) for a GitHub App.
  ([#51](https://github.com/Hankaws/aperture/pull/51))
- A chat with Aperture Bot on the Bot page. Ask about a repository ("what's
  broken right now?") and the bot reads its open issues and pull requests,
  any one thread, CI on the default branch and its own recent tasks, then
  answers. When work is wanted it proposes a task as a card; you send it, it
  is never sent for you, and the card then follows the task live. It uses
  your own model key from Settings, and the conversation stays in your
  browser.
  ([#49](https://github.com/Hankaws/aperture/pull/49))
- The Bot page, `/bot`: pick one of your repos, ask Aperture Bot for a
  change (on an open issue or pull request, or as a new issue), and follow
  every task as it plans, changes, checks and publishes, with its plan, its
  Agent Check rows, the pull request it opened or the change it did not push,
  and the tokens it used. It also checks a repo's setup and can open a pull
  request that adds the bot's workflow. It works with the GitHub token on
  your account and posts the same `/aperture` comment you would; the run,
  the model key and the code stay on GitHub. Aperture Bot now posts one
  comment when it starts, updates it at each step, and turns it into its
  reply, with a hidden summary the page reads.
  ([#47](https://github.com/Hankaws/aperture/pull/47))
- Aperture Bot as a GitHub Action. Someone with write access comments
  `/aperture <task>` on an issue or pull request; the bot makes the change,
  runs Aperture Agent Check with the tests in a sandbox, and only when nothing
  is red opens a pull request that fixes the issue, or pushes to the pull
  request. Otherwise it replies with what is still red and the change it did
  not push. It never runs a fork's code.
  ([#45](https://github.com/Hankaws/aperture/pull/45))
- The core of Aperture Bot, a coding bot for GitHub, and its command line,
  `aperture-bot run --task "…"`. The editor's agent plans and makes the
  change on a checkout, then Aperture Agent Check judges it against where it
  started, with the tests run in a container that has no network and no
  secrets. A red check goes back to the agent; a change still red is
  reported, never passed as done. It never writes workflows, secrets files or
  lockfiles, stops at a token budget, and reports the tokens it used.
  ([#44](https://github.com/Hankaws/aperture/pull/44))
- A page for Aperture Agent Check, `/agent-check`: the workflow to add, what
  it checks, a real run that a test keeps word for word, its settings, what
  leaves the runner, the benchmark numbers and a README badge. The landing
  page, the nav, the footer and `/agents` link to it.
  ([#43](https://github.com/Hankaws/aperture/pull/43))
- Aperture Agent Check, a command-line tool and GitHub Action that runs the
  editor's checks on a pull request: Parses, Imports resolve, Types (with the
  installed packages' real types) and the project's own tests, with
  annotations on the lines a red check names and a summary of the run. A
  failure the base already had is amber, a deleted file is checked through
  whatever imported it, and nothing leaves the runner. Aperture's own pull
  requests are checked by it.
  ([#42](https://github.com/Hankaws/aperture/pull/42))
- A page for connecting an agent, `/agents`: setup for Claude Code, Cursor
  and Grok Bot, the instruction to give the agent, and a real
  `check_change` answer that a test keeps word for word. The landing page
  links to it, and says what the checks catch without running tests, as a
  share of the benchmark's bad edits.
  ([#40](https://github.com/Hankaws/aperture/pull/40))
- Aperture is an MCP server. Make a token under Settings → Agents →
  Connect an agent, and Grok Bot, Claude Code, Cursor or any MCP client can
  call `check_change` at `/api/mcp`: Parses, Imports resolve, Types (the
  real compiler, new errors only) and test tampering, the editor's own
  verdicts, before it applies a change. Nothing the agent sends is run or
  kept. Free on every plan.
  ([#39](https://github.com/Hankaws/aperture/pull/39))
- A launch smoke test, `npm run smoke`, that walks the signed-in site the
  way a new visitor does against a production build: every public page on a
  laptop and a phone, sign-up, Composer playing recordings on the public demo
  host, the server refusing a paid plan, the project opening on a second
  device, and Composer on any other host asking for the visitor's own key
  rather than spending one on the server. CI runs it on every pull request.
  ([#38](https://github.com/Hankaws/aperture/pull/38))

### Changed

- The landing page, nav and footer are redesigned in Grok: the checks told as
  three short stories, a site search and a menu on small screens. The newer
  pages are part of it: two sections in the same style show a real
  `check_change` answer and a real Agent Check run, and Agents and Agent Check
  are in the menu, the search and the footer.
  ([#46](https://github.com/Hankaws/aperture/pull/46))
- Adding test paths to a test script that already names its own paths is
  no longer counted as tampering: more tests run, none fewer. A script that
  ran everything and gains a path filter still is.
  ([#42](https://github.com/Hankaws/aperture/pull/42))
- The Imports check reads `require()`. A CommonJS require of a file that
  does not exist, or of a package missing from package.json, is red before
  any test runs. A require inside `try` is left alone, and the names a
  require takes are not judged. On the benchmark, a mistyped require is now
  stopped by the Imports check, so agents calling `check_change` get 20 of
  the 33 bad edits stopped without running anything, up from 19.
  ([#41](https://github.com/Hankaws/aperture/pull/41))
- The benchmark has 48 cases instead of 30, across four projects instead of
  two: a React shop UI that imports through barrel files (Vitest) and a plain
  JavaScript command-line tool (Jest) join the first two. A new kind of
  mistake is counted: a test skipped, cut short or narrowed away to hide a
  bug. The page lists its one false alarm and says what plain JavaScript
  does not get.
  ([#35](https://github.com/Hankaws/aperture/pull/35))

### Fixed

- Parses no longer fails valid TypeScript it could not read: arrow
  functions with a type predicate (`(x): x is T =>`) now parse everywhere,
  and anything else it flags is settled by TypeScript's own parser wherever
  it is loaded: in Aperture Agent Check, Aperture Bot, the agent on the
  server and the editor's check results. Real parse errors now say what
  TypeScript says is wrong. Agent Check also stops calling an import of a
  file it does not read missing, such as `./logo.svg` or
  `../CHANGELOG.md?raw`.
  ([#48](https://github.com/Hankaws/aperture/pull/48))
- Parses no longer reports a JSX comment, `{/* … */}`, or empty braces in JSX
  as broken: the parser wanted an expression there, and its recovery could
  mark the lines after as broken too.
  ([#46](https://github.com/Hankaws/aperture/pull/46))
- Aperture Bot no longer fails with "fetch failed" after a long wait, such as
  pulling its sandbox image or running the tests: a request sent on a
  connection the server had closed in the meantime is sent once more, the
  image is pulled without blocking, and errors name fetch's hidden cause.
  ([#46](https://github.com/Hankaws/aperture/pull/46))
- Parses no longer reports `typeof import("./module")` as broken
  TypeScript. ([#44](https://github.com/Hankaws/aperture/pull/44))
- Parses no longer reports valid TypeScript as broken when it declares a
  module by name, `declare module "@tanstack/react-router" {` or
  `declare module "*.svg";`, as module augmentations and `.d.ts` files do.
  ([#43](https://github.com/Hankaws/aperture/pull/43))
- Aperture Agent Check no longer misses a failing `node --test` run when it
  is itself started from a test runner: the project's tests no longer inherit
  `NODE_TEST_CONTEXT`. ([#43](https://github.com/Hankaws/aperture/pull/43))
- An exported function whose body says `from "…"` in a string is no longer
  read as a re-export of a module that does not exist.
  ([#42](https://github.com/Hankaws/aperture/pull/42))
- The Parses check says "1 file parses", not "1 file parse".
  ([#40](https://github.com/Hankaws/aperture/pull/40))
- If someone made an account with your email and a password, the sign-in
  page now gives you a way out: a private report, after which that account
  is removed and you can sign in with Google or X.
  ([#36](https://github.com/Hankaws/aperture/pull/36))
- On the narrowest phones (320 pixels), the landing page's code demo no
  longer runs off the side of the screen.
  ([#36](https://github.com/Hankaws/aperture/pull/36))
- A command-line tool's own entry point may now exit cleanly: the Tests
  check no longer counts `process.exit(0)` in a file under `bin/` or listed
  as a `bin` in package.json as cutting the tests short.
  ([#35](https://github.com/Hankaws/aperture/pull/35))
- The Types check missed a caller that reaches a changed file through an
  `index.ts` that re-exports it. It now checks the files that depend on the
  change, nearest first, through re-exports and importers in turn.
  ([#34](https://github.com/Hankaws/aperture/pull/34))
- The Imports check now reads `export … from` too, so a re-export of a file
  or name that does not exist is caught.
  ([#34](https://github.com/Hankaws/aperture/pull/34))

### Removed

- The demo deploy workflow. It deployed to a private Vercel project, had no
  credentials to do it with, and so skipped on every push while showing a
  green tick. The site is published from Grok App Builder.
  ([#36](https://github.com/Hankaws/aperture/pull/36))

### Security

- Per-account limits on the server work a script could repeat in a loop:
  repository imports and sends to GitHub (6 a minute), saves (60), CI checks
  and MCP calls (30), and Composer sends through both of its entry points
  (24). Normal use stays well under each; past one, the editor says to wait
  a few seconds.
  ([#37](https://github.com/Hankaws/aperture/pull/37))
- Dependency updates for three advisories in packages Aperture uses through
  others: brace-expansion, fast-uri and source-map-js.
  ([#34](https://github.com/Hankaws/aperture/pull/34))

## 0.2.0 - 2026-10-06

### Added

- Version numbers. This changelog marks each release, the release notes on
  GitHub are built from it, and the site's footer shows the version.
  ([#30](https://github.com/Hankaws/aperture/pull/30))
- The first time the checks appear, one line says what they are: what green,
  red, amber and a dash mean, and that nothing has touched your files yet.
  ([#29](https://github.com/Hankaws/aperture/pull/29))
- The landing page shows the benchmark's numbers, read from the benchmark
  itself, and links every case.
  ([#29](https://github.com/Hankaws/aperture/pull/29))

### Changed

- The site and README say what Types is now: the TypeScript compiler, not a
  light check. The model section mentions a model on your own computer.
  ([#29](https://github.com/Hankaws/aperture/pull/29))
- On a phone, a first visit opens Composer and its demo tasks instead of a
  file. ([#29](https://github.com/Hankaws/aperture/pull/29))
- Touch screens start with the comfortable density.
  ([#29](https://github.com/Hankaws/aperture/pull/29))
- Signed out, the editor shows two sign-in links instead of three identical
  ones: the header's, and "Sign in to send" in Composer.
  ([#29](https://github.com/Hankaws/aperture/pull/29))
- The editor loads less up front: the zip library loads when you download.
  ([#29](https://github.com/Hankaws/aperture/pull/29))

### Fixed

- With **Scripts off**, a page's code could still run in the preview through
  markup such as `<svg/onload=…>`. The preview now carries a policy that lets
  only Aperture's own scripts run, so nothing of the page's does.
  ([#33](https://github.com/Hankaws/aperture/pull/33))
- Sending to GitHub could include secret files such as `.env`, for instance
  one a Composer edit created. They are now never sent, the send says which
  were left out, and the server refuses them too. Deleting one is still sent.
  ([#32](https://github.com/Hankaws/aperture/pull/32))
- The Tests check could be passed by the change it was checking: by skipping
  every test, by calling `process.exit(0)` before the tests finished, or by
  deleting, skipping or `.only`-ing tests, or rewriting the test script. Each
  now shows red and says what the change did, and a fix turn is told to fix
  the code instead. ([#31](https://github.com/Hankaws/aperture/pull/31))
- Someone could sign up with another person's email and a password, and when
  that person later signed in with Google or X they landed in that account.
  A sign-in now joins an existing account only if its email was confirmed;
  otherwise the sign-in page says why and nothing is joined.
  ([#30](https://github.com/Hankaws/aperture/pull/30))
- Signed out on a phone, the top bar no longer runs off the edge of the
  screen; Pricing is in the footer there.
  ([#30](https://github.com/Hankaws/aperture/pull/30))

## 2026-10-05

### Added

- A changelog, here and at `/changelog`.
  ([#28](https://github.com/Hankaws/aperture/pull/28))
- **Plan first** switch in Composer, on by default and remembered per
  browser, in place of the Plan / Build / Iterate buttons. Turn it off to
  have Composer edit straight away; nothing is applied until you Apply
  either way. ([#27](https://github.com/Hankaws/aperture/pull/27))
- A fix now starts from the evidence. When a check is red, the agent gets
  every new issue, a failing test's message with its stack mapped to your
  files and lines, and the code where it broke, not only one line.
  ([#24](https://github.com/Hankaws/aperture/pull/24))
- Script errors in the live preview point to the line of your script file
  that threw, and every Composer turn is told about them.
  ([#24](https://github.com/Hankaws/aperture/pull/24))
- A Security page: the threat model, the sandboxes, what the checks cannot
  catch, and how to report a vulnerability.
  ([#26](https://github.com/Hankaws/aperture/pull/26))

### Changed

- Composer's lessons (`.aperture/lessons.md`) stay out of what is sent to
  GitHub unless you tick them in, and never ride along with a CI fix.
  ([#27](https://github.com/Hankaws/aperture/pull/27))
- Privacy and Security are separate pages, and Privacy states plainly what
  passes through the server after sign-in.
  ([#26](https://github.com/Hankaws/aperture/pull/26))

### Fixed

- Background jobs on Pro could stall once the server had answered. They are
  now kept alive, and a job the server ended says so instead of showing
  "running" forever. ([#27](https://github.com/Hankaws/aperture/pull/27))
- After a send to GitHub, only what was sent is recorded as in the
  repository. ([#27](https://github.com/Hankaws/aperture/pull/27))
- A check replaced by a newer change could still finish and show its old
  result, such as type errors in the margin from an earlier change.
  ([#25](https://github.com/Hankaws/aperture/pull/25))
- A stopped background run could come back as ready, and one restored after
  a reload never aged out. ([#25](https://github.com/Hankaws/aperture/pull/25))
- Preview errors could point at the wrong line after a stylesheet changed.
  ([#25](https://github.com/Hankaws/aperture/pull/25))

## 2026-10-04

### Added

- **Background runs.** Send a task and keep working. Each runs on its own
  copy, is checked, gets one automatic fix if a check is red, and waits on
  the agent board for you to open it. Your edits made meanwhile are merged
  in. ([#23](https://github.com/Hankaws/aperture/pull/23))
- **Hooks.** `.aperture/hooks.json` runs project scripts on save and as a
  check on every staged change. ([#22](https://github.com/Hankaws/aperture/pull/22))
- **Rules for some files.** `.aperture/rules/*.md` with `files:` globs reach
  Composer only when a turn touches a matching file.
  ([#22](https://github.com/Hankaws/aperture/pull/22))
- A public benchmark of how often the checks stop a bad edit, with every case
  listed, misses included. ([#21](https://github.com/Hankaws/aperture/pull/21))
- The Types check runs the real TypeScript compiler, in a worker in your tab,
  across files. ([#20](https://github.com/Hankaws/aperture/pull/20))
- A model on your own computer (Ollama, LM Studio) from the hosted site; the
  agent loop runs in your tab. ([#19](https://github.com/Hankaws/aperture/pull/19))
- Editable plans: reword, reorder, remove or add steps before Build it.
  ([#18](https://github.com/Hankaws/aperture/pull/18))
- Check problems in the editor margin, with F7 to move between them.
  ([#18](https://github.com/Hankaws/aperture/pull/18))
- An agent board (Ctrl/Cmd+J) with every run by stage, and side-by-side
  compare of two staged runs. ([#18](https://github.com/Hankaws/aperture/pull/18))
- Pull requests driven to green: the status bar watches CI, and a failure can
  be sent to Composer with its annotations and log.
  ([#18](https://github.com/Hankaws/aperture/pull/18))
- Light and follow-system themes. ([#17](https://github.com/Hankaws/aperture/pull/17))
- Privacy and Terms pages, and account deletion in Settings.
  ([#5](https://github.com/Hankaws/aperture/pull/5),
  [#6](https://github.com/Hankaws/aperture/pull/6))
- Cmd/Ctrl-click a relative import to open that file.
  ([#12](https://github.com/Hankaws/aperture/pull/12))

### Changed

- The landing page no longer downloads the editor, and every server input is
  checked against a schema. ([#17](https://github.com/Hankaws/aperture/pull/17))
- An edit is staged only when the agent is sure of it (confidence 0.8 or
  more), and Apply stays off while any check is red or still running.
  ([#10](https://github.com/Hankaws/aperture/pull/10),
  [#12](https://github.com/Hankaws/aperture/pull/12))
- A check fails only for problems the change brought in; problems the file
  already had show amber and do not block Apply.
  ([#14](https://github.com/Hankaws/aperture/pull/14))
- The README and the site describe all five checks, and say what Types does.
  ([#8](https://github.com/Hankaws/aperture/pull/8))
- No shared Grok key: the demo plays recorded runs, and everywhere else uses
  your own key. ([#9](https://github.com/Hankaws/aperture/pull/9))
- A demo GIF and video at the top of the README.
  ([#11](https://github.com/Hankaws/aperture/pull/11),
  [#16](https://github.com/Hankaws/aperture/pull/16))

### Fixed

- The GitHub token is no longer kept in the browser's storage.
  ([#17](https://github.com/Hankaws/aperture/pull/17))
- An agent endpoint can no longer reach the server's own network, and every
  user-supplied endpoint is pinned to the address that was checked.
  ([#7](https://github.com/Hankaws/aperture/pull/7),
  [#13](https://github.com/Hankaws/aperture/pull/13))
- Revert refuses instead of discarding edits made after the commit.
  ([#15](https://github.com/Hankaws/aperture/pull/15))
- The light checks no longer misread ordinary code, and three GitHub
  round-trip bugs are fixed. ([#14](https://github.com/Hankaws/aperture/pull/14))
- The demo's recap no longer lists finished steps as left.
  ([#13](https://github.com/Hankaws/aperture/pull/13))
- The sign-in error log no longer records part of the session cookie.
  ([#6](https://github.com/Hankaws/aperture/pull/6))

## 2026-10-03

### Added

- A diff review in one short pass: a note is kept only for a likely bug, and
  can be posted on the pull request.
  ([#3](https://github.com/Hankaws/aperture/pull/3))
- Parse, imports and types run inside the agent's own turn, so a red check
  gets one more step before the turn ends.
  ([#4](https://github.com/Hankaws/aperture/pull/4))

### Changed

- The site leads with the checks, and the demo shows no prices.
  ([#1](https://github.com/Hankaws/aperture/pull/1))
- A send uses the key saved on your account, and stops if it is missing.
  ([#4](https://github.com/Hankaws/aperture/pull/4))

### Fixed

- A custom model endpoint no longer follows redirects, so it cannot bounce
  your key to another address. ([#2](https://github.com/Hankaws/aperture/pull/2))
