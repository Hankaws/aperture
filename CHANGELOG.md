# Changelog

What changed in Aperture, newest first. Every pull request adds its line
under **Unreleased**; the site shows this file at `/changelog`. A heading
with a version number is the day that version was released, and its
release notes are every line from there down to the previous version.

## Unreleased

### Added

- **Checked by Aperture, on the pull request.** Agent Check's run summary now opens with a badge, green "nothing red" or red "held back", that links the pull request on Aperture's public checker. With `comment: true` (and `pull-requests: write`), it also keeps one comment on the pull request with the badge, the verdict and a line per check, updated in place on every push so it never piles up. It is off by default, being the one thing the action sends anywhere, to GitHub's own API with the workflow's token; without the permission, or on a fork's pull request, the run says so and the checks stand. The Bot page's Check tab hands out the workflow with the comment on, saying what each line does ([#277](https://github.com/Hankaws/aperture/pull/277)).

### Changed

- The release check reads what an action's release was built from in the release's own notes, which "Build from Aperture" writes from the commit it built. A build that changes no file makes no commit, so its tag lands on the previous build commit, and reading that commit's message called Agent Check v1.9 and Aperture Bot v1.21, built from v0.34.0, stale on every daily run. A tag that is not on a build commit is still a failure ([#274](https://github.com/Hankaws/aperture/pull/274)).

## 0.34.0 - 2026-11-27

### Added

- **An agent scoreboard.** `/scoreboard` shows how agents' pull requests held up in 18 busy open-source projects over 90 days (dotnet/runtime, VS Code, PostHog, Sentry, Supabase, n8n, the Vercel AI SDK and more): for Copilot, the Claude GitHub app, Claude Code and people, how many merged, how many were reverted and how many needed a fix within 14 days, with each reverted or fixed pull request linked to GitHub and to its check on `/check`. It is read from each project's git history, so anyone can read it again with git alone (`npm run scoreboard`), and kept as a dated snapshot. The page says what it cannot see: an agent that commits as its person (Codex does) counts as that person, Claude Code is a person working with it, and fixes rarely name what they fix. Bots that are not agents count as neither side ([#271](https://github.com/Hankaws/aperture/pull/271)).
- **Search engines can find the public pages.** `robots.txt` lets them in, keeps them out of `/api/`, and points to `sitemap.xml`, which lists the public pages (the landing page, Check a PR, the scoreboard, the Bot page and its tabs, the editor, the benchmark, pricing, the changelog and the policies). Each of those pages names its one canonical address, so the same page reached with a query or a tab counts once ([#269](https://github.com/Hankaws/aperture/pull/269)).

### Changed

- **The app leads with the checks.** The sidebar opens with Editor and Check a PR, then Bots and Chat, and the Aperture name goes to the editor; New chat is a row under them. Aperture Bot's corner bubble is smaller, no longer pops up a hello, and no longer carries a count of setup steps that read as unread messages; the bot and its tour are still there. On a red result, Send back is the one main button beside the verdict, Make it a check is a button next to it instead of a small grey link, and Apply anyway is a quiet choice that asks once ("Apply with 2 failing checks?") and now does apply: before, it did nothing. Settings opens on Models, and Escape closes your bot's panel from anywhere on the page, not only from inside it ([#270](https://github.com/Hankaws/aperture/pull/270)).
- **The check verdict leads the editor.** It is larger, says plainly whether the change is safe ("Safe to apply: nothing new fails (5 passed, 1 already failing)" instead of "5 of 6 passed", or "Held back: this change fails 2 of 6 checks"), and Composer says the same sentence, in green or red, under the staged change and in its bar above the input. Passing checks fold under "Show all N checks" on a computer too, as on a phone. The empty Composer says what Aperture promises (every change is checked before it touches your files) and offers "Make listTasks return a number", a demo a check holds back. The selected file in the review strip is readable in the light theme, and the review guide's risk dot is announced to screen readers ([#268](https://github.com/Hankaws/aperture/pull/268)).

## 0.33.0 - 2026-11-26

### Added

- **Check any public pull request.** Paste its link at `/check`; no sign-in, nothing installed. Aperture reads the pull request's diff, rebuilds each changed file before and after, and runs the checks that need nothing installed: Parses, Imports resolve, Safety, the tests' tampering rule and the project's own checks. Types and the tests are marked as not run here, with Agent Check named as where they run. The page's address is the result's link, with a comment ready for the pull request and a post for X. It reads GitHub's pages, diffs and raw files rather than its API, whose allowance for a server without a token runs out quickly ([#266](https://github.com/Hankaws/aperture/pull/266)).

### Changed

- **The landing page shows the catch.** The headline is "Agent mistakes, caught. Never twice.", and the hero plays four steps from a real pull request: Copilot writes `await test(...)` inside a describe that is not async, the checks hold it, one click makes it a project check that proves it catches its own example, and a week later Codex makes the same mistake and Project checks catches it. Each step can be clicked; with reduced motion it shows the end ([#265](https://github.com/Hankaws/aperture/pull/265)).
- **Aperture checks itself with its own project checks.** Six rules this project learned the hard way are now in `.aperture/checks.json`, on every change and pull request: no `@/` import in a test file, a server function's input is a zod schema, no `enum`, a look at parameter properties, and the editor kept out of the landing page's download ([#264](https://github.com/Hankaws/aperture/pull/264)).

## 0.32.0 - 2026-11-25

### Added

- **How agents' pull requests held up.** The Bot page's Check tab scores a repository: for each agent (Copilot, Codex, Devin, Jules, Claude, Claude Code, Cursor, Aperture Bot), the pull requests it merged in the last 90 days, how many were reverted, and how many needed a fix within 14 days, with people's for comparison and links to each one. It is the number the teams shipping the most agent code judge it by. A revert counts when a pull request says "Reverts …#N" or is titled Revert "…"; a fix only when a pull request says in its own words that it fixes #N, not in a quote or code. On Aperture's own 254 pull requests, a looser rule counted fixes that were never there; this one counts none, and the page says what it cannot see ([#262](https://github.com/Hankaws/aperture/pull/262)).
- **A check offered when a mistake keeps happening.** The check strip now notes the kind of each red finding (a type error by its code, an import of a file that is not there, a skipped test, a key in the code), once per staged change. When the same kind turns up in three changes within a week, it says so ("This keeps happening: TS1308 …, in 3 changes this week") and offers **Make it a check**, or **Not now**, which keeps it quiet for a month. Kept in your browser, per project ([#262](https://github.com/Hankaws/aperture/pull/262)).

### Changed

- Aperture Agent Check releases itself, like Aperture Bot: its "Build from Aperture" run, given a version, tags the build, publishes the release and moves `v1`, with nothing left to do by hand. Both actions' builds now refuse a version that is not `vX.Y`, one that is not newer than the newest release, and Aperture code older than Aperture's live release, the three slips behind Agent Check v1.3, `v.1.4` and v1.6 ([#262](https://github.com/Hankaws/aperture/pull/262)).

## 0.31.0 - 2026-11-24

### Added

- **Turn a mistake into a check.** A project can now keep its own checks in `.aperture/checks.json`: for each mistake, a pattern for one line, the files it applies to, the line it was made to catch, and what to write instead. Each line a change adds is read against them, code or not, in the editor (a Project checks row, red holds Apply), in Aperture Agent Check and Aperture Bot (with an annotation on the line), and in `check_change`. Under a red check, **Make it a check** asks Composer to write the check for that mistake. A new check must catch its own example, and says how many lines it already matches in the project; the checks in force are the ones already there, so a change cannot remove one to get past it, and Safety says when one is removed or changed. This is how the teams shipping the most agent code keep it trustworthy: each mistake becomes a check, not one more line in a prompt. Agent Check also no longer puts two annotations on the first line it reports ([#260](https://github.com/Hankaws/aperture/pull/260)).

## 0.30.0 - 2026-11-24

### Fixed

- The checks stop reporting imports and tests that are fine. Run on 83 real pull requests opened by AI agents (Claude Code, Copilot, Cursor, Codex) in nine open-source TypeScript projects, Aperture Agent Check went red on 37, nearly always wrongly; with this change it is red on 19, and none of those is Imports, Tests or Safety. Imports now finds `x.ts` behind `import "./x.js"` (how ES-module TypeScript is written), reads names from `export { type A, B }` lists, counts a package declared in any `package.json` of a monorepo, one of its own workspace packages, or one that comes with `@types/…` (such as `vscode`), and leaves `fs/promises`, `#` imports and imports above the checked folder alone. Agent Check, run in one package of a bigger repository, reads the other `package.json` files there. Tests moved to another file of the same change are no longer counted as removed, and a skip that names its condition and reason (`test.skip(isCloudflare, "…")`) is amber, worth a look, instead of red; `test.skip(` written inside a string (a test's own fixture) is not counted as a skip. The editor's checks get the same fixes ([#258](https://github.com/Hankaws/aperture/pull/258)).

## 0.29.0 - 2026-11-23

### Added

- Releases are checked every day, so Aperture Agent Check and Aperture Bot cannot quietly ship an old build. A new check (`npm run release:verify`, and a daily workflow) fails when an action's release is not on the commit its build made, when `@v1` is not on the newest release, or when an action was built from Aperture code older than Aperture's live release, and when an Aperture version was skipped or tagged on the wrong commit. Each failure says how to fix it. It found this week's two slips: Agent Check v1.3 tagged before its build finished, and Aperture Bot v1.15 published on the old build ([#255](https://github.com/Hankaws/aperture/pull/255)).

### Fixed

- Aperture Agent Check and Aperture Bot now look for keys in every changed text file, not only in code. Before, Safety skipped any file that was not JavaScript, TypeScript, JSON, HTML or CSS, so it missed a key in a workflow, a YAML config, a `.pem` or a Python script, values written into a `.env`, a deleted CI workflow and a YAML lockfile that moved, and it said "no CI changes" on a pull request that added a workflow. Those files are now read before and after for Safety only, a change with no code in it gets Safety instead of "nothing to check", and the summary lists which files only Safety read. A CI or lockfile finding also no longer names its file twice ([#256](https://github.com/Hankaws/aperture/pull/256)).
- Import patch reads a patch with several files correctly, with or without `diff --git` lines between them. Before, a patch adding two new files without those lines put both into the first one. New files keep their last newline (unless the patch says `\ No newline at end of file`), a second hunk in a file lands where the first one moved it, a removed line starting with `--` no longer ends the hunk early, and `+++ /dev/null` deletes a file. External agents that send a diff get the same fixes ([#254](https://github.com/Hankaws/aperture/pull/254)).

## 0.28.0 - 2026-11-22

### Added

- **A review guide for every change, and a receipt in your pull requests.** Under the checks, a staged change now says where to start reading and why ("Start with tests/store.test.ts: it changes the tests"), then lists each file in order of risk: it changes the tests, the CI or the dependencies, touches sign-in, security or billing code, deletes a file, changes what other files import, is large, or was edited without the agent reading it first. Each file shows the plan step that made it, and the guide lists the files the agent read without changing. When you open a pull request from Aperture, a tick (on by default) adds the same receipt to its description, for the runs behind the files you send. Nothing is asked of a model ([#252](https://github.com/Hankaws/aperture/pull/252)).
- **Visual proof.** When a staged change touches a page, the check strip now shows the page before and after, side by side, at desktop or phone width, with what changed outlined and how much of the page moved ("1 area changed, 3% of the page", or "No visible change"). A change that makes the page scroll sideways where it did not before is called out. The pictures are drawn in your tab from the files, with no model and nothing sent ([#251](https://github.com/Hankaws/aperture/pull/251)).

## 0.27.0 - 2026-11-21

### Added

- **Best of 3, judged by the checks.** Type a task in Composer and pick Best of 3 from the + menu: it shows what three runs cost on your key, then runs the task three times in the background on the same files, each checked like any other run. When all three are in, the agent board ranks them by what the checks found (fewer red checks, clear on the first try, fewer amber, more checks passed, then the smaller change), says in a line why the best one won, and lets you compare any two side by side or open the best for review. The Composer panel shows it as one line until you pick ([#249](https://github.com/Hankaws/aperture/pull/249)).
- A sixth check, **Safety**, on every staged change, in Agent Check on every pull request, and in `check_change` for any agent. It is red when a change writes a key or token into the code (GitHub, AWS, xAI, OpenAI, Anthropic, Google, Slack, Stripe, a private key) or values into a `.env` file, and when it switches a check off to get past it (`// @ts-nocheck`, `strict` loosened, a lint or typecheck script emptied): Apply waits, and the agent is told to read the key from the environment or fix what the check found. A new dependency, one from a URL, an install script, an edited CI workflow, a lockfile that moved on its own, and a new `@ts-ignore` or `eslint-disable` are amber, to look at, and hold nothing. A key is never repeated, only its kind and its line ([#248](https://github.com/Hankaws/aperture/pull/248)).

### Fixed

- A bot at work no longer trips its own limit. While a task runs, the Bot page and a bot's bubble each checked its tasks every 10 seconds, and with a few bubbles open that came close to the 30 Bot refreshes a minute you get; past it, the task list showed an error. Now the page and the bubbles share one check per repository, a minimized bubble checks once a minute, and a check that does meet the limit keeps the tasks shown and tries again. The limits themselves were already counted over the last minute, so a steady pace under them is never refused; a test now holds them to that ([#247](https://github.com/Hankaws/aperture/pull/247)).

## 0.26.0 - 2026-11-21

### Changed

- Settings and the editor say less: the GitHub card, the Plan and Models tabs, and the editor's empty states now take one line each, with **Learn more** for the rest ([#244](https://github.com/Hankaws/aperture/pull/244)).

### Fixed

- A visitor who keeps browsing no longer gets signed out for ten seconds at a time: checking who is signed in is not rate-limited any more, since the limiter only reset after a full quiet pause, so a steady trickle of page loads reached its cap. Signed-in pages also stop throwing away their first render: anything that asks who is signed in waits for the page to hydrate, so the server's HTML and the browser's agree. The plan buttons on Pricing wait for the session instead of ignoring an early click ([#245](https://github.com/Hankaws/aperture/pull/245)).

## 0.25.0 - 2026-11-21

### Changed

- The front page stays the first thing you see, signed in or not, so everyone meets Aperture before using it. Open, Chat and Bot take you into the app, and About Aperture in the sidebar brings you back to it. ([#243](https://github.com/Hankaws/aperture/pull/243))
- The Bot page opens on a dashboard, in the style of Grok Bot. At the top, each of your bots with what it is doing now (working on a task, stuck, done, idle) and how many of its tasks wait on you; click one to talk to it below. Under them, every task on one board in three columns: Working, Needs you (red checks, an error, a question with no answer, or a pull request to review) and Done this week, each opening on GitHub. The sidebar's Bots shows a dot from any page: amber with a count when something needs you, a pulsing blue while a bot works. Before GitHub is connected, the page shows a short two-step setup in place of the long explanation. ([#242](https://github.com/Hankaws/aperture/pull/242))
- The editor's Composer box is one box, in the style of Grok. The tabs, the Plan first switch, the crew, the @ and paperclip buttons, the model and the cost no longer stack up above where you type. Inside the box: a + menu (add context, add files or screenshots, run in the background, the crew, and Explain this, Fix this and Find bugs), a mode switch (Ask, Plan to plan first and wait for Build it, or Edit to change the code straight away), the model, and send. Under it, one quiet line says what goes along and what a send costs, and why it cannot send only when it cannot. The mode you pick is remembered, and on a phone the box sits right above the tabs. ([#241](https://github.com/Hankaws/aperture/pull/241))
- Aperture now looks and works like an app once you are signed in, in the style of Grok. Chat, Bots and Settings share one sidebar down the left: New chat at the top, then Chat, Bots and Editor, your chats (pinned first, then the newest; on the Chat page, with search, pin, rename and delete), and Settings, your account and the dark-mode switch at the foot. Fold it to a rail of icons when you want the room, and it stays folded; on a phone it slides in from the menu button. Signed out, the site is as it was. ([#240](https://github.com/Hankaws/aperture/pull/240))

## 0.24.0 - 2026-11-20

### Added

- Pin the chats you come back to. On the Chat page, the pin beside a chat keeps it in a Pinned group at the top of the list, however long ago you last used it; press it again to unpin. From any page, the bot's panel has a new Your chats button: it lists your pinned chats, then your newest, so you can carry one on without leaving the page, and pins or unpins the chat you are in. You can pin up to 10 chats, and they stay pinned on every device. ([#238](https://github.com/Hankaws/aperture/pull/238))

## 0.23.0 - 2026-11-20

### Added

- Your bot takes over changes in the editor. Tell it to fix, add or change something and it does: it hands the job to Composer at once, with no button to press, and follows it in its own panel step by step (handed over, making the change, checking it, your Apply). When the checks say it is safe, Apply and Discard are right there in the bot's panel, so you never have to leave it; nothing lands in your files before you press Apply. If Composer cannot run yet, the panel says why and how to fix it. The empty panel in the editor offers to explain the file, fix its problems, find bugs or write tests. ([#236](https://github.com/Hankaws/aperture/pull/236))

### Changed

- Your bot stays with you on every page, like a personal assistant. Its bubble now opens it over the page you are on instead of taking you to the Chat page, and it stays open as you move from page to page. The full-screen button makes the panel bigger over the page, in the style of Grok, instead of leaving for the Chat page; press it again, or click beside it, to make it small. Your conversations are still on the Chat page. ([#236](https://github.com/Hankaws/aperture/pull/236))

## 0.22.0 - 2026-11-20

### Added

- Jump to the code your bot names. When you summon it in the editor and its answer cites a place, such as `src/store.ts:32` or `src/types.ts:3-6`, that place is a link: click it and the editor opens the file with those lines picked out. On a phone the bot steps aside to show the code; Ctrl/⌘+J brings it back. Only files in your project become links, so a name like Node.js stays text. ([#234](https://github.com/Hankaws/aperture/pull/234))
- Your bot sees the whole project in the editor, not only the open file. With each message it gets the paths of every file, and the small files the open one imports go along too (the line under the box says how many). When it needs another file to answer, a type, a function it calls or a test, it reads it rather than guess: "Reading types.ts" shows while it does, then it answers, and the answer says which files it read. It reads at most three files at a time and asks at most twice for one question; each look is another answer from your model, so it counts as one. A secret file's text is never sent. ([#233](https://github.com/Hankaws/aperture/pull/233))

## 0.21.0 - 2026-11-20

### Added

- Your bot on any page, like JARVIS: press Ctrl/⌘+J anywhere on the site, the editor included, and your own bot slides in over the page, then press it again or Escape to put it away. The conversation carries on from page to page, and the Chat page lists it with your others. In the editor it sees what you see: the open file, your selection and the file's problems go with each message (never a secret file's text, and a click under the box stops it), so you can ask what code does or why an error happens. When you want a change, its answer ends with "Have Composer do it": Composer takes the instruction, makes the change and checks it, and nothing lands until you press Apply. The editor's top bar has a button for it too. The agent board moves to Ctrl/⌘+Shift+B to make room. ([#231](https://github.com/Hankaws/aperture/pull/231))
- Show your team bots a picture or give them a file too: the same paperclip, paste and drop as on the Chat page, in each bot's chat and its bubble. A screenshot of a broken page or an error log goes with your message, and the bot reads it beside what it looks up in the repository before it suggests a task. As on the Chat page, each is read with the message it came with. ([#230](https://github.com/Hankaws/aperture/pull/230))
- Show your bot a picture or give it a file, as Grok lets you: on the Chat page, the paperclip beside the box attaches pictures (PNG, JPEG, WebP or GIF, made smaller in your browser before they are sent) and text files (notes, code, CSV, JSON, Markdown), up to three of each, and you can paste or drop them in too. They show in your message, and your bot reads them with your model: a picture as a picture, a file as text. Each is read with the message it came with; later messages say it was attached rather than send it again. A model that can't see pictures says so instead of answering blind, and anything that is neither a picture nor a text file is turned away with why. ([#229](https://github.com/Hankaws/aperture/pull/229))

## 0.20.0 - 2026-11-20

### Added

- Find and rename your chats on the Chat page. A search box over the list finds chats by their title or anything said in them, and shows where the words are; Escape clears it. Each chat has a pencil beside its delete: give it a better title than its first question, press Enter, and it keeps that title from then on, on every device. ([#227](https://github.com/Hankaws/aperture/pull/227))
- Talk to your bots instead of typing, as Grok lets you: a microphone beside the send button, in your own bot's chat and your team bots'. Press it and speak; your words appear in the box as they are heard, after anything you already typed, and you read them before you send. Press it again to stop, or just send. Your browser does the listening: Chrome sends your voice to Google's speech service and Safari to Apple's, and the microphone says so. It is not shown in browsers that cannot listen, and if the microphone is blocked, the box says how to allow it. ([#225](https://github.com/Hankaws/aperture/pull/225))

### Changed

- Your own bot has one home, the Chat page. On the Bot page, the private chat that sat at the top of your bots, and the one shown before GitHub is connected, are now a way to it: your bot's face and name, and Open Chat. The conversation you had there is the first in your list of chats. ([#226](https://github.com/Hankaws/aperture/pull/226))

## 0.19.0 - 2026-11-19

### Added

- Your own bot, as Grok is yours, on a page of its own: Chat, in the top bar. The first time, you give it a name and choose its face (one is offered, so one tap will do), and from then on it answers to that name. The page greets you by your first name, with the box in the middle and a few ways to start, until you ask something. Every chat is kept, down the side by day (Today, Yesterday, Previous 7 days, Older) under its first question, and each can be opened again or deleted; New chat starts another. On a phone, the list slides in from the side. Its bubble in the corner of other pages now wears its face and opens this page. Your bot, your chats and what it remembers stay on your account, so every device shows the same, and nothing you say there is posted anywhere. ([#223](https://github.com/Hankaws/aperture/pull/223))
- What to ask next, as Grok offers it: under a bot's newest answer, two or three short questions you might ask it next, as chips ("Turn this into a checklist", "Show me the files of #12", "Send that as a task"). Tapping one asks it. They come with Aperture Bot's answers and your team bots' alike, are left out after a greeting or a thank-you, never show up as code while an answer is still being written, and are not copied with it. ([#222](https://github.com/Hankaws/aperture/pull/222))
- Your team bots' answers appear as they are written too, as Aperture Bot's do. While a bot looks things up for an answer, the dots say what it is doing ("Reading #12…", "Checking CI…"), and once it writes, those lookups stay above its words. A Stop button ends the answer and keeps what was written so far, and the model stops with it. ([#221](https://github.com/Hankaws/aperture/pull/221))
- Chats with the bots feel like a messenger's. Aperture Bot's answers appear as the model writes them, with a Stop button that keeps what was written so far. Before the first words, both Aperture Bot and your team bots show three dots in a bubble, as someone typing does. Each of Aperture Bot's answers can be copied, and the last one written again (Regenerate). Minimizing a bubble no longer throws its chat away: an answer that comes meanwhile, or a team bot's news of a task it finished, peeks out beside the bubble with its first line, and the bubble counts what is unread until you open it. ([#220](https://github.com/Hankaws/aperture/pull/220))
- Each team bot's profile opens with its Usage, as Grok Bot 1.0 shows each bot's: tiles for its tasks (done, red, working), the pull requests it opened (merged, waiting, closed, and fixes pushed to open ones), what it answered, and its reviews and Agent Checks; when it last worked; and its last 14 days, a bar a day, where a hover or a tap names the day. Every number is counted from what the bot posted on its repository, from its latest 30 tasks, and the section says how far back that goes. ([#219](https://github.com/Hankaws/aperture/pull/219))

## 0.18.0 - 2026-11-19

### Added

- Your team bots remember too, each its own: what you told it about its repository and how you work ("migrations live in migrations/", "Ada reviews checkout"). Its chat asks "Remember this?" with Keep, Edit and Don't, as Aperture Bot's does, in the bot's room and in its bubble. Each bot's profile has a Knowledge section, as Grok Bot's has, with what it learned: what waits for your yes, and what you kept, each to edit or forget, and Forget everything. Removing a bot removes what it remembered. ([#217](https://github.com/Hankaws/aperture/pull/217))
- Aperture Bot remembers, as Grok Bot does, and you decide what. When you tell it something worth keeping (how you like to work, a fact about your project, a decision), its reply asks "Remember this?" with Keep, Edit and Don't. Only what you keep reaches its later conversations. The Memory button in its chat lists everything it knows: what waits for your yes, and what you kept, each to edit or forget, and Forget everything. It never offers to keep anything that looks like a password or key, keeps at most 60 lines, and the lines go with your account if you delete it. ([#216](https://github.com/Hankaws/aperture/pull/216))
- A Test button for each model key in Settings, on the Models tab, and for the custom endpoint. It sends one tiny request with the saved key, resolved as a chat would resolve it, and says right there "Works: it answered in 1.2 s.", or what is wrong and what to do ("It needs an API key…", "can't be read anymore…", or no answer in 30 s). It spends a few tokens of your own key. ([#215](https://github.com/Hankaws/aperture/pull/215))
- A welcome tour in Aperture Bot's chat for someone new: "Get set up", three steps with a button each (add a model key, connect GitHub, make your first bot), ticking themselves off from your account as you do them, wherever you do them. Aperture Bot's bubble shows how many are left. It goes once all three are done, or when you press Hide. ([#214](https://github.com/Hankaws/aperture/pull/214))

### Fixed

- A provider key saved before the server's secrets key changed is no longer reported as missing ("No Grok key on this account") while Settings shows it linked: it says the key can't be read anymore, and to enter it again. A custom endpoint's own words and the hint after them are now separated by a full stop. ([#215](https://github.com/Hankaws/aperture/pull/215))
- A custom endpoint that turns the key away now says what to do. OpenRouter with no key saved answered "No cookie auth credentials found"; the chat now adds that the endpoint needs an API key, in Settings on the Models tab (or that the key sent is wrong). A key saved before the server's secrets key changed, which can no longer be read, is no longer sent as nothing: you are asked to enter it again. The tour counts a custom endpoint as ready only with a key, unless it runs on your own machine. And "How do I make my first bot?" is asked as it is, not with a colon after it. ([#214](https://github.com/Hankaws/aperture/pull/214))

## 0.17.0 - 2026-11-18

### Added

- Aperture Bot's answers carry buttons to where they point. When it tells you to add a model key, connect GitHub, make a bot, open the editor, check a pull request or see the plans, its reply ends with a button that goes there ("Add a model key →"), at most three; in a bubble, following one puts the chat away so the page shows. Only those places can be buttons: anything else the model names is left out. ([#212](https://github.com/Hankaws/aperture/pull/212))
- Chat bubbles, like a messenger's chat heads. Aperture Bot sits in the corner of every page (not in the editor), and says hello once to someone new: "Ask me anything, or how to make your first bot." A bot you make pops up as a bubble of its own with a hello of its own, so you can talk to it from any page. A bubble opens a chat window beside it, the whole screen on a phone; Escape or Minimize puts it away, and a bot's bubble can be closed. On the Bot page, which has the private chat in it, Aperture Bot's bubble steps aside. The private chat also knows its way around Aperture now: ask it how to add a model key, make a bot, or use the editor, and it answers with the site's own pages and buttons. ([#211](https://github.com/Hankaws/aperture/pull/211))
- A private chat with Aperture Bot, like Grok: ask it anything (questions, writing, planning, code) with no repository and no GitHub. On the Bot page it comes first when GitHub is not connected, and with GitHub it is "Private chat" at the top of your bots. It answers with your own model key and no tools, nothing said there is posted anywhere, and the conversation is kept on your account, so every device shows the same. Numbered lists, bullets and code show as such. ([#210](https://github.com/Hankaws/aperture/pull/210))

### Changed

- The copies of Aperture Bot's and Agent Check's build workflows in this repository match the ones that run in their own repositories again, and their test workflows are copied too. The bot's copy had fallen behind: it lacked the `release` input that tags a build, publishes the release and moves `v1`. `AGENTS.project.md` now says how to release each one, so a bot release is no longer published by hand ahead of its build. ([#209](https://github.com/Hankaws/aperture/pull/209))

## 0.16.0 - 2026-11-17

### Added

- Aperture Bot offers to save a skill in its own reply. When a change it finished repeats a kind of task it did in the last 30 days ("Add a migration for orders", then "Add a migration for invoices") and no skill covers it, its suggestions end with "Save tasks like this as a skill: `.aperture/skills/add-a-migration.md`". Tick it and the bot drafts the skill from those tasks, fits it to every task of that kind, and opens a pull request with it, through Agent Check like any other change. Its pull request is titled "Add the add-a-migration skill", and saving a skill is never itself offered as one. Needs Aperture Bot v1.14. ([#207](https://github.com/Hankaws/aperture/pull/207))

## 0.15.0 - 2026-11-17

### Added

- The Bot page's Skills card suggests a skill when a bot keeps getting the same kind of task ("Add a migration for orders", then "Add a migration for invoices") and no skill covers it yet. Each suggestion links the tasks it came from and has a draft made from them (the newest plan as the steps, every file they changed as examples) that you can read and copy. "Add on GitHub" opens GitHub's new-file page with the path and text filled in, so you can commit it or open a pull request, and the bot follows it from then on. "Not now" hides it in that browser. Only finished changes count, not answers, reviews or failed runs. ([#204](https://github.com/Hankaws/aperture/pull/204))
- Publishing a release takes one click. `npm run -s release-url -- X.Y.Z` prints a link to GitHub's new-release form with the tag, the title and the notes from `docs/releases/X.Y.Z.md` already filled in, and the tag set on the release's own merge commit, so it lands there even if main has moved on. If that version is already tagged, it links its release instead. ([#205](https://github.com/Hankaws/aperture/pull/205))

### Changed

- Every release keeps its notes with it. The notes for each version from 0.13.0 are in `docs/releases`, and a test fails when a release has none, when they have no summary for people, or when the changelog lines they quote have since changed, so a release can't go out with its notes lost or stale. ([#203](https://github.com/Hankaws/aperture/pull/203))

## 0.14.0 - 2026-11-17

### Added

- When you ask for the same kind of task again ("Add a migration for orders", then "Add a migration for invoices"), the reply offers to save it as a skill: "You asked for this before". The draft is made from both runs: both requests as examples, the newer plan as the steps, and every file and check either run had. "Not now" keeps the plain Save as skill button, and the offer does not come back for that run. It is not offered when the run already followed a skill, or a skill by that name exists. ([#200](https://github.com/Hankaws/aperture/pull/200))

### Fixed

- Checks on a pull request ride out a short network outage. The two browser checks installed the browser's system packages from Ubuntu's mirrors every time, and when the runner could not reach them both failed before any test ran. Now the browser is downloaded with retries, the system packages are installed only when it does not launch without them, and a failing try is cut off after five minutes and tried again. ([#201](https://github.com/Hankaws/aperture/pull/201))

## 0.13.1 - 2026-11-16

### Changed

- The landing page's benchmark line says what the numbers are: "Stopped 27 of 27 mistakes a check can see. 6 that no check can see got through." It read "27 of 27 caught. 6 missed.", which looked like a contradiction. ([#198](https://github.com/Hankaws/aperture/pull/198))

### Fixed

- Easier to tap and to use with a screen reader, from a walk of every page on desktop and phone: the site's Menu and the Dark switch are 36px tall on a phone instead of 20, "Import patch" in the agent panel is 24px instead of 17, the "Cap this session" switch in Settings has a name, and the headings on "What the editor knows" go in order. ([#198](https://github.com/Hankaws/aperture/pull/198))
- The agent sees your live preview's script errors. Since October the editor has sent the errors the running app reported with each turn, so the agent can fix what is broken on the page, but the server dropped them on the way in, as it did the skills before 0.13.0: only a model on your own machine got them. A test now sends every field the editor can send and fails if the server drops one, and a new field cannot be added without it. ([#197](https://github.com/Hankaws/aperture/pull/197))

### Security

- Patched packages with known advisories: `undici` 7.30.2 (eight, among them a TLS check that could be skipped and cross-user cache disclosure), `vite` 8.3.8, `zod` 4.6.7 (memory exhaustion on oversized input), `seroval` and `fast-uri`. Better Auth moves to 1.6.34, the newest patch of the version sign-in is built on. `npm audit` goes from 15 advisories, four of them high or critical, to 10 with none high: what is left is Better Auth's (in features Aperture does not use: magic links, the OAuth proxy and device sign-in; the fix is a minor version up) and the linter's, which has no fix yet and runs only in development. ([#198](https://github.com/Hankaws/aperture/pull/198))

## 0.13.0 - 2026-11-13

### Added

- Use a skill on purpose: type `/` in the agent panel and the project's skills are listed after the commands, each with what it is for. Pick one, or type `/release cut 0.13.0`, and the agent loads that skill first and follows it for the task, held to the checks it names, instead of waiting to match it to the task itself. Your message shows as you typed it. ([#195](https://github.com/Hankaws/aperture/pull/195))

### Fixed

- A follow-up on a change in the editor is held to the skills the change was made under again, as 0.11.0 said: a fix, your notes, or the Build it of a plan made with a skill. The server dropped the list of those skills on the way in, so their checks did not run on those turns. Aperture Bot was not affected. ([#195](https://github.com/Hankaws/aperture/pull/195))

## 0.12.0 - 2026-11-11

### Added

- A Skills card on the Bot page, under Automation. It lists the skills in each bot's repository (`.aperture/skills/` on its default branch), with what each is for and a link to its file, and how the bot used them in its recent runs: how many followed each skill and when last, and how the checks it names went ("migrate:check failed in 2 of 5 runs" in red). A skill no run follows stands out. Each bot reply now records the skills it followed and their checks' results, from Aperture Bot v1.13. ([#193](https://github.com/Hankaws/aperture/pull/193))

### Fixed

- The agent checks its work before it hands it over, as it says it does. Most turns end right after the first clean edit, and that ending skipped the run of the project's own tests in the sandbox, so the one try to fix a failure before you see the diff rarely happened. Now the tests (or the typecheck, lint or build script) run there too, under the same limits: one try to fix, one re-run, and a run the agent already made on the same edits counts. The reply says "Verified" or "Not verified", and the check list shows the result. Aperture Bot gets it in its next release. ([#192](https://github.com/Hankaws/aperture/pull/192))

## 0.11.0 - 2026-11-10

### Added

- Save a run as a skill. When the agent has finished a task you will want again, "Save as skill" under its last reply writes a draft in `.aperture/skills/` and opens it: the request as what the skill is for, the run's plan as its steps, the check it ran as the last step, and the files it changed as examples. It is named for the request and never takes a name a skill already has. Edit the steps to fit every task like it, and from then on the agent, and Aperture Bot once the skill is pushed, load it when a task matches. ([#189](https://github.com/Hankaws/aperture/pull/189))
- A skill can name its own checks. Add `checks: test, migrate:check` to a skill's front matter: package.json scripts that must pass before a task the skill was loaded for is done. The agent runs them in the sandbox on its edits, gets one try to fix a failure, and its reply ends with each check's result, "Not done: …" when one still fails. In the check list each is a row of its own, and a red one holds Apply as a failing test does. A follow-up on the same change, and the Build it of a plan made with the skill, are held to its checks too. "Save as skill" writes the checks its run was held to. Aperture Bot does the same from v1.13: a skill's failing check holds its change red, and the next round is asked to fix it. ([#190](https://github.com/Hankaws/aperture/pull/190))

## 0.10.0 - 2026-11-08

### Added

- Skills: a project's know-how for one kind of task, in `.aperture/skills/` (`<name>.md` or `<name>/SKILL.md`, with a name and a description). The agent is told each skill's name and what it is for, and loads one with the new `load_skill` tool when a task needs it, so its steps reach the agent then rather than on every turn as rules do. The reply says which skills it used, and each opens its file. "Add a skill the agent loads when needed" in the command palette starts one. ([#186](https://github.com/Hankaws/aperture/pull/186))
- Aperture Bot follows your project's skills too. It reads the same `.aperture/skills/` as the editor, is told each skill's name and what it is for, and loads the one its task needs, so a "release" or "add a migration" skill works the same on GitHub as in the editor. Its pull request, or its reply to a question, says which skills it followed. A bot run never stops to ask, since no one is watching: where the editor's agent would ask you, it decides and says what it chose. Needs Aperture Bot v1.12. ([#187](https://github.com/Hankaws/aperture/pull/187))

## 0.9.0 - 2026-11-07

### Added

- Send the agent a screenshot. Paste an image into the agent panel, drop it there, or pick it with the paperclip: up to 3 to a message, each made smaller in the browser before it is sent, shown as thumbnails you can take off, and kept with your message in the thread. Grok, OpenAI, Gemini, Claude, a custom endpoint and a local model are sent the images; DeepSeek's model reads text only, and says so. Later turns are told the images were attached rather than sent them again, and only the newest are kept in this browser's storage. ([#182](https://github.com/Hankaws/aperture/pull/182))
- The agent can read a web page you link to. Paste a docs page, a changelog or an issue into your message, and the new `web_fetch` tool reads it as text, with the page's same-site links to read on. It reads only sites you linked to in the conversation, so a page cannot send it anywhere else; over GET with no cookies, from public addresses only, at most 2 MB and six pages a turn; and the page is handed to the model as content to read, never as instructions. A long page is kept whole for `read_output`. Hosted models only: a model on your own machine cannot read pages. ([#183](https://github.com/Hankaws/aperture/pull/183))
- The agent can stop and ask you. When it cannot go on without your decision (which of two designs, a name, a value only you know), the new `ask_user` tool ends its turn with the question and up to four answers to click; clicking one sends it as your next message, or you type another. What it staged before asking stays. A background run has no one to ask, so there it decides, and says what it assumed. ([#184](https://github.com/Hankaws/aperture/pull/184))

## 0.8.0 - 2026-11-06

### Added

- Aperture Bot learns from your reviews. Before it changes anything, it reads what you asked for in reviews and line comments on its own pull requests in the last 60 days and keeps up to ten notes in mind, so the next change is made that way from the start. Only people who can write to the repository count, never a bot or its own words, and thanks and approvals are left out. Its pull request says how many notes it kept in mind. Needs Aperture Bot v1.10. ([#176](https://github.com/Hankaws/aperture/pull/176))
- "What your bots learned" on the Bot page shows the notes from your reviews too: what each bot keeps in mind before it changes anything, with the pull request and who wrote it. Ignore keeps a note from the bot, with a mark hidden in the note on GitHub, so it holds on every run and every device; Bring back takes it away. GitHub lets only a note's author change it, and the page says so. The bot leaves ignored notes out from Aperture Bot v1.10. ([#177](https://github.com/Hankaws/aperture/pull/177))
- The Monday digest in Aperture Bot's daily brief says what it keeps in mind from you, as "What your bots learned" on the Bot page does: the kinds of work you take, how many ideas you turned down are left out, and how many notes from your reviews it reads. It is left out until there is something to say. Needs Aperture Bot v1.11. ([#179](https://github.com/Hankaws/aperture/pull/179))
- The agent stays on track and keeps what it reads. When it calls the same read again with nothing changed since, it gets the same answer back without the work being redone (a sandbox run included) and is told to change approach or finish, more firmly from the third time. A read or a call to a connected server that hangs stops after 90 seconds with a clear note instead of holding the turn. A long run log or server answer is kept whole for the turn: the agent sees its start and end and reads any part back with the new `read_output` tool, by lines or by search, so a failure in the middle of a long log is no longer lost. Reading a large file now says which line to read on from. ([#180](https://github.com/Hankaws/aperture/pull/180))

## 0.7.0 - 2026-11-01

### Added

- Aperture Bot learns what you do not want. Dismissing an idea on the Bot page (in Ideas, or Not now on Next up) also strikes it out of the bot's reply on GitHub, so it stays dismissed on every device, and the daily brief no longer offers what you turned down in the last 30 days: ideas struck out, and its pull requests closed without merging. Restore puts the idea's box back. The reply's signature still holds; a struck idea can no longer be ticked. Needs Aperture Bot v1.9. ([#172](https://github.com/Hankaws/aperture/pull/172))
- Aperture Bot learns what you like too. The daily brief is told which kinds of work you took in the last 30 days (tests, bug fixes, docs, cleanups or features), from its pull requests you merged and the ideas you ticked, and offers ideas like those first. On the Bot page, Next up puts ideas of the kinds you take most first and says so. Ideas an `always-allow` setting started are not counted. The brief needs Aperture Bot v1.10. ([#173](https://github.com/Hankaws/aperture/pull/173))
- The Bot page shows what your bots learned, under Automation: the kinds of work you took in the last 30 days, with the pull requests and ideas they learned it from, and what the daily brief leaves out (ideas you dismissed, pull requests closed without merging). Forget puts a dismissed idea back, on GitHub and in the Ideas inbox. ([#174](https://github.com/Hankaws/aperture/pull/174))

## 0.6.0 - 2026-11-01

### Added

- A main bot, as Grok has one. Star a bot on its profile and it leads your team: first in the roster, and the face of Next up, a new view on the Bot page that plans your work across every bot's repository, most urgent first (red CI's fix, pull requests the bots opened that wait for your review, a review's likely bugs, then the other ideas), each one click away and handed to the bot that looks after that repository. With a main bot, the page opens on Next up. ([#170](https://github.com/Hankaws/aperture/pull/170))
- Aperture Bot posts to Slack. With "Post to Slack" on the Bot page (`slack-webhook` and a `SLACK_WEBHOOK_URL` secret), the daily brief (with the Monday digest), a red run it explained, and a pull request it opened without being asked are posted to a Slack channel too, each linking back to GitHub. Only a Slack webhook address is posted to, it is never logged, nothing from GitHub or the model can ping or link there, and Slack being down never fails a run. ([#169](https://github.com/Hankaws/aperture/pull/169))
- Aperture Bot can follow its own threads, as Grok's bots do. With "Follow its own threads" on the Bot page (`follow-threads: true`), you reply to the bot without `/aperture`: "yes" or "do the second one" does that suggestion, as ticking it would, and anything else is answered with the reply it follows in mind, changing nothing. It follows only whoever it answered (anyone who can write, on threads it started), never a comment that @mentions someone, and never anyone who cannot write. ([#168](https://github.com/Hankaws/aperture/pull/168))
- A weekly digest in Aperture Bot's daily brief: on Mondays the brief also says what the bot did in the last seven days (pull requests opened, merged or waiting, likely bugs caught, what it answered and checked), in the Bot page's own words, so it reaches you in GitHub's notifications without opening Aperture. It is counted from the bot's own replies, with no model call. ([#167](https://github.com/Hankaws/aperture/pull/167))
- Automation on the Bot page: one switch turns on every bot's daily brief doing its top idea without asking, or turns it off again. It shows where each repository's brief stands, then opens one pull request per repository that needs it, on its bot workflow and keeping its other jobs; a repository whose schedule runs another job is left as it is, and a pull request from an earlier switch that is still open is shown rather than opened again. Needs Aperture Bot v1.7. ([#166](https://github.com/Hankaws/aperture/pull/166))

## 0.5.0 - 2026-10-31

### Added

- The Bot page's Activity starts with the last seven days at a glance: pull requests the bots opened (merged, waiting for review, closed), likely bugs their reviews caught, questions, new issues and red runs answered, and pull requests checked, with the daily briefs and ticked suggestions under them. Every number is counted from what the bots posted. ([#164](https://github.com/Hankaws/aperture/pull/164))
- An Ideas inbox on the Bot page: everything your bots' replies still suggest across the team's repositories (daily briefs, answers, reviews, red CI), newest first, with a count in the sidebar. Do it asks the bot on GitHub, on the thread the idea is about or in a new issue (never on the brief's own issue); Dismiss hides an idea in this browser, even when tomorrow's brief offers it again, and Restore brings it back. An idea someone has ticked, sent or had done since leaves by itself. ([#162](https://github.com/Hankaws/aperture/pull/162))
- Aperture Bot can act on its daily brief without asking. With "Do the top idea without asking" on the Bot page (`always-allow: brief`), each brief's first idea from the code becomes a pull request at once, only when Aperture Agent Check is clear and one at a time: nothing new starts while the last one waits for review. An idea that names an issue still waits for a tick, since anyone can write an issue, and the brief now lists the idea most worth doing first. A box started by an `always-allow` setting names the setting instead of @mentioning a user called always-allow. ([#161](https://github.com/Hankaws/aperture/pull/161))

### Fixed

- Ticking an idea in Aperture Bot's daily brief no longer closes the brief's issue: the pull request it opens says where the idea came from instead of "Fixes" the brief, so the next brief posts on the same issue. ([#163](https://github.com/Hankaws/aperture/pull/163))
- On the Bot page, a bot whose daily brief was posted in one go no longer shows as queued in the roster: the team's feed keeps an outcome before its ask at the same moment. ([#162](https://github.com/Hankaws/aperture/pull/162))
- A ticked box starts Aperture Bot's work only in a list the bot itself made on that thread: its suggestion lists are signed with a key derived from its model key, so another bot's look-alike comment, or a list copied from another thread, starts nothing, and the bot replies with the task for you to ask for if you meant it. Suggestions posted before this are no longer tickable. ([#160](https://github.com/Hankaws/aperture/pull/160))

## 0.4.0 - 2026-10-31

### Added

- Aperture Bot's daily brief. The look-over job ("Daily brief" on the Bot page, now daily by default) posts each morning what needs you, read from GitHub (CI on the default branch, pull requests waiting longest, issues quiet for two weeks), and up to five ideas from reading the code (likely bugs, untested paths, TODOs, open issues), each a box to tick. "Fix it without asking" (`always-allow: red`) has the bot fix a red default branch at once instead of waiting for a tick. ([#157](https://github.com/Hankaws/aperture/pull/157))
- Aperture Bot reviews pull requests. `/aperture review`, or every push with "Review every pull request" on, posts a GitHub review with a comment on the line of each likely bug (only what it is at least 80% sure of) and a reply with each fix as a box to tick. It changes nothing, reads a fork's changes without running them, and does not repeat a comment already on its line. ([#156](https://github.com/Hankaws/aperture/pull/156))
- Aperture Bot can work unasked. With "Reply to new issues" on, it reads each new issue and the code and replies with what it would do (or asks for what is missing), its first box being the issue itself to tick. With "Explain red CI" on, a workflow that fails on the default branch is explained on the bot's own issue, once per red commit, with the fix to tick. Both change nothing on their own and stop at 20 replies a day (`daily-limit`). ([#155](https://github.com/Hankaws/aperture/pull/155))
- Aperture Bot answers questions and takes suggestions with one tick. Comment `/aperture why does the login test fail?` and it answers on the thread from the code, the diff and the failing checks, changing nothing. Every reply ends with what it would do next as boxes: tick one and it does it, as if you had asked with `/aperture`. Ticking needs the workflow to listen for edited comments, as the Bot page's and the README's now do. ([#154](https://github.com/Hankaws/aperture/pull/154))
- Subscribers can switch between Pro and Team, or between monthly and yearly, from the pricing table: Paddle prices the change first ("You pay $18.50 now for the rest of this period"), and Settings → Plan shows the switch once Paddle confirms it. ([#153](https://github.com/Hankaws/aperture/pull/153))

### Fixed

- Aperture Bot can no longer be made to @mention people: text it did not write itself (the model's words, issue titles, review notes) has its mentions made inert, and an HTML comment in it can no longer hide the bot's boxes. Replies nobody asked for queue one at a time, so a burst of new issues cannot slip past `daily-limit`, spend at most 150,000 tokens each, and say to read a suggestion before ticking it. ([#158](https://github.com/Hankaws/aperture/pull/158))
- Paying twice no longer leaves a second subscription charging every month: a second live subscription for the same account is cancelled the moment Paddle reports it, and buying again while a checkout is open reopens that checkout, or says the payment already went through. ([#153](https://github.com/Hankaws/aperture/pull/153))
- A long agent turn wraps up before the server's time limit and keeps what it staged, instead of being cut off mid-reply; a test run is shortened, or left for the next turn, when there is not enough time left. A reply that still ends early says it was cut off and offers Retry, and an external agent that cannot start now shows why. ([#152](https://github.com/Hankaws/aperture/pull/152))
- Signed in, the editor no longer rebuilds its whole layout as it opens, and on a phone it no longer flashes "Sign in": the phone account button waits for the session, as the desktop bar does. ([#151](https://github.com/Hankaws/aperture/pull/151))

## 0.3.0 - 2026-10-27

### Added

- Pro and Team can be bought through Paddle once the deployment configures it and the server sandbox, with 300 and 1,000 sandbox runs a month. A failed payment keeps the plan for 7 days, cancelling keeps it to the end of the period, and Settings → Plan shows the renewal date and opens Paddle's billing page. ([#149](https://github.com/Hankaws/aperture/pull/149))
- The GitHub card explains how to use a fine-grained token limited to chosen repositories, and the MCP server stops reading a request once it is over its size limit. ([#148](https://github.com/Hankaws/aperture/pull/148))
- A file-tree row opens wherever you click it, indent and edges included, and two timing tests no longer fail on a busy machine. ([#147](https://github.com/Hankaws/aperture/pull/147))
- A send that loses the connection says so plainly and offers Retry, and a request you are typing survives a reload or signing in. ([#146](https://github.com/Hankaws/aperture/pull/146))
- Fix CI redacts tokens, keys and connection-string passwords from the job log before it goes to the model, and the GitHub card says "Checking…" or offers Retry instead of showing a connected account as not connected. ([#145](https://github.com/Hankaws/aperture/pull/145))
- Messages no longer send you to a Pro plan you cannot buy. Without the server sandbox, the agent is told tests run free in your browser or in your own CI with Agent Check. ([#144](https://github.com/Hankaws/aperture/pull/144))
- The session cap starts a new session 24 hours after the first send, by itself, so a few sends no longer block the free plan until you reset it. Settings → Limits says when. ([#143](https://github.com/Hankaws/aperture/pull/143))
- A send blocked for a missing key links to Settings → Models, not Limits, and Settings no longer offers Pro for keys Hobby already has. ([#142](https://github.com/Hankaws/aperture/pull/142))
- The pricing page says where tests run on each plan: free in your browser, in your own CI with Agent Check, or in the Pro sandbox. ([#141](https://github.com/Hankaws/aperture/pull/141))
- Hobby includes Tab ghost-text and up to five of your own keys: both run on your key. ([#140](https://github.com/Hankaws/aperture/pull/140))
- Hobby includes one background job and the external agents (Claude Code, Codex, OpenCode, Grok Build): both run on your own key, and no paid plan can be bought yet. ([#139](https://github.com/Hankaws/aperture/pull/139))
- A running background job is no longer polled from a hidden tab, like the editor's other live lists. ([#138](https://github.com/Hankaws/aperture/pull/138))
- The browser's copy of a project no longer grows with every past edit, so it keeps saving, and says so if it ever cannot; and diffs of large files take milliseconds, not seconds. ([#137](https://github.com/Hankaws/aperture/pull/137))
- Typing in a large project no longer pauses to rebuild search data the editor does not use: a 2 MB project re-indexes in 2 ms, not 229. ([#136](https://github.com/Hankaws/aperture/pull/136))
- Importing a zip or a GitHub repository unpacks only the files it can keep: a small archive can no longer fill the server's memory. ([#135](https://github.com/Hankaws/aperture/pull/135))
- Agent turns on a saved project upload only the files changed since the last save, not the whole project: a turn on a 1 MB project sends under 1 KB. ([#134](https://github.com/Hankaws/aperture/pull/134))
- The agent never edits a cut-off copy: files too large to send are left out whole and named to it, and an inline edit on an over-long selection is refused. ([#133](https://github.com/Hankaws/aperture/pull/133))
- The agent no longer sees ordinary code as [redacted]: only real-looking keys, tokens and passwords are hidden, and a hidden string keeps its quotes. ([#132](https://github.com/Hankaws/aperture/pull/132))
- Accepting an agent edit keeps the real text of lines the agent was shown as [redacted], and the diff shows only what the agent changed. ([#131](https://github.com/Hankaws/aperture/pull/131))
- Background jobs started at the same moment can no longer go past your plan's limit: the database holds a numbered slot for each running job. ([#130](https://github.com/Hankaws/aperture/pull/130))
- Finished background jobs are deleted after 30 days (the newest 30 are kept), and the privacy page says what jobs and bot chats keep. ([#129](https://github.com/Hankaws/aperture/pull/129))
- Tab no longer sends keys, tokens or passwords it sees near the cursor: they are redacted, as in Composer. ([#128](https://github.com/Hankaws/aperture/pull/128))
- On larger projects the agent can read every file and runs tests on the whole project, never a cut-off copy. ([#127](https://github.com/Hankaws/aperture/pull/127))
- On larger projects the agent sees every file, with the ones you are working on first. ([#126](https://github.com/Hankaws/aperture/pull/126))
- Settings → Models says what protects your saved keys: the deployment's secrets key, or its sign-in secret. ([#125](https://github.com/Hankaws/aperture/pull/125))
- Saved API keys and tokens can have their own encryption key (`APERTURE_SECRETS_KEY`), so changing the sign-in secret no longer makes them unreadable. Existing ones move to it after the next deploy. ([#124](https://github.com/Hankaws/aperture/pull/124))
- The editor downloads less to open: Markdown, Python, HTML and CSS highlighting load the first time you open such a file. ([#123](https://github.com/Hankaws/aperture/pull/123))
- A background job stopped just as it was starting stays stopped, instead of showing as running forever. ([#122](https://github.com/Hankaws/aperture/pull/122))
- Stopping a background job checks that it is yours before anything stops. ([#121](https://github.com/Hankaws/aperture/pull/121))
- The deployment's sandbox check starts at most one sandbox every ten minutes and answers from the last check in between. ([#120](https://github.com/Hankaws/aperture/pull/120))
- Only Aperture and Grok can show the app inside a frame, so another site cannot trick a signed-in user into clicking in a hidden editor. ([#119](https://github.com/Hankaws/aperture/pull/119))
- MCP is safer with code you did not write: a project's .mcp.json no longer connects servers on its own (add one in Settings → MCP), and any tool call whose arguments carry a URL waits for you to confirm it. ([#118](https://github.com/Hankaws/aperture/pull/118))
- Tab completions are kept per account: one person's cached suggestion is never shown to another. ([#117](https://github.com/Hankaws/aperture/pull/117))
- The editor stays responsive while a change is staged in a large project: each file's imports are read once until it changes. ([#116](https://github.com/Hankaws/aperture/pull/116))
- Folders can be renamed on a phone too: open a folder in the file tree and its Rename button appears, as a file's does once selected. ([#115](https://github.com/Hankaws/aperture/pull/115))
- The agent can move a whole folder: `move_file` stages every file in it at its new path, with the imports into and out of it updated by TypeScript, as one change. ([#114](https://github.com/Hankaws/aperture/pull/114))
- Rename or move a folder from the file tree: every file in it moves, TypeScript updates the imports into and out of it, and Undo puts it all back. ([#113](https://github.com/Hankaws/aperture/pull/113))
- "Apply only this" waits for the rest of a change that only works whole: one half of a move, or the declaring file of a rename, can no longer be applied alone and break the files the rest of the change fixes. The button says why. ([#112](https://github.com/Hankaws/aperture/pull/112))
- The agent can delete a file the change no longer needs: `delete_file` stages the removal for you to apply or reject, and names what still imports it. The checks hold Apply while anything does, and Undo brings the file back. ([#111](https://github.com/Hankaws/aperture/pull/111))
- Composer can add files: an edit to a path that is not there yet stages a new file, labelled as one, for you to check and apply with the rest of the change. Secrets files such as `.env` are refused. ([#110](https://github.com/Hankaws/aperture/pull/110))
- The agent can move and rename files: `move_file` stages the file under its new path, the old one removed, and every import of it updated by TypeScript, for you to check and apply in one go. ([#109](https://github.com/Hankaws/aperture/pull/109))
- A model on your own machine no longer gets a false "parse error" on a valid TypeScript edit: the tab's compiler checks it before the note can hold Apply. ([#108](https://github.com/Hankaws/aperture/pull/108))
- The agent can find a declaration by name. A new tool, `find_symbol`, asks
  the TypeScript compiler where a function, class, type or constant is
  declared, with its file, line and kind, instead of grepping and wading
  through comments, strings and calls. It works wherever the agent runs: on
  Aperture's server, on a model on your own computer, and in Aperture Bot.
  ([#107](https://github.com/Hankaws/aperture/pull/107))
- Go to any symbol. In Ctrl/⌘+P, type `#` and part of a name: every function,
  class, type and constant in the project that fits, with its kind and file;
  Enter opens it at the line. "Go to symbol…" in the palette starts it. (Not
  Ctrl+T: browsers keep that key for a new tab.)
  ([#106](https://github.com/Hankaws/aperture/pull/106))
- Fix all in the Problems panel. When a kind of error turns up two or more
  times in a file, its group offers TypeScript's "fix all" for it, such as
  "Add all missing imports (5)", and writes every fix at once with one Undo.
  ([#105](https://github.com/Hankaws/aperture/pull/105))
- Deleting a file can be undone. The trash icon in the file tree used to
  delete at once with no way back; now the toast says what went and offers
  Undo, and "Undo last" takes it back too, with its text and its tab. A file
  with a staged change is not deleted until the change is applied or
  rejected.
  ([#104](https://github.com/Hankaws/aperture/pull/104))
- The checks read as a list. Each check has its own row with what it found,
  and a red or amber row gives its reason in full (the separate "why" list
  is gone). On a phone, the rows that passed fold away behind "Show all", so
  the diff gets the room, and the verdict and Apply sit in a bar under the
  code, in reach of a thumb. The editor page has a main landmark and a
  heading for screen readers.
  ([#103](https://github.com/Hankaws/aperture/pull/103))
- A 404 page with the site's own bar and a way back, in place of a bare "Not
  Found". Every page now has its own title (and description) in the tab,
  history and search results, instead of one shared title.
  ([#101](https://github.com/Hankaws/aperture/pull/101))
- Rename or move a file from the file tree, and its imports follow. The pencil
  on a file's row opens its path with the name selected; a new folder in the
  path moves it. TypeScript rewrites every import of the file, re-exports
  included, and the file's own relative imports, in the project's import
  style. One Undo puts the file and the imports back.
  ([#102](https://github.com/Hankaws/aperture/pull/102))
- The agent's TypeScript tools work with a model on your own computer. With
  Settings → Models → This computer, the agent now finds references, renames a
  name everywhere, and checks where a changed name is still used, from the
  compiler the editor already loads in your tab, as it does with a hosted
  model. Before, those runs fell back to text search.
  ([#100](https://github.com/Hankaws/aperture/pull/100))
- A Refactor menu in the editor. Ctrl/⌘+Shift+R lists TypeScript's
  refactors for the selection or the cursor, extracts first: extract to a
  function or a constant, inline a variable, move to a new file, convert an
  arrow function, convert an export, and the rest. Each is written with one
  Undo; a name it makes up (`newLocal`) is selected, ready for F2, and Move to a
  new file updates the files that import what moved, in the project's import
  style. The editor tour lists it.
  ([#99](https://github.com/Hankaws/aperture/pull/99))
- The site says what the editor knows. The landing page has an Editor section
  (a parameter hint, and the keys for rename, references, quick fixes,
  Problems and hints), and `/editor` tours it all: types on hover, parameter
  hints, completions, go to definition, rename, references, live type errors,
  quick fixes, Problems and Organize Imports, each with its key, three with a
  screenshot of the demo project. The footer links to it.
  ([#98](https://github.com/Hankaws/aperture/pull/98))
- Parameter hints and Organize Imports in the editor. Typing `(` or `,` in a
  TypeScript call shows the function's parameters above it, with the one you
  are on underlined, its doc, and which overload it is; it follows the cursor
  and closes when you leave the call or press Escape, and Ctrl/⌘+Shift+Space
  brings it back. Shift+Alt+O removes the file's unused imports and sorts the
  rest, keeping the project's `.ts` extensions, with one Undo; on a tidy file it
  says so and changes nothing.
  ([#97](https://github.com/Hankaws/aperture/pull/97))
- Add Aperture to Cursor or VS Code in one click. After you make an agent
  token in Settings → Agents (or on the Bot page's Agents tab), Add to Cursor
  and Add to VS Code open the editor with Aperture's MCP server and the token
  filled in, for you to confirm. They are the editors' own links, so the token
  goes straight to the app on your computer and never to a website. The setups
  below now include VS Code's `.vscode/mcp.json` too.
  ([#96](https://github.com/Hankaws/aperture/pull/96))
- A Problems panel for the whole project. Ctrl/⌘+Shift+M, the Problems button
  in the file sidebar, or the status bar's type-error count lists every
  TypeScript error in the project by file, with its code and line, and checks
  again as you edit. A row opens the file at the problem, where the
  underline's quick fixes are. TypeScript no longer reports a package whose
  types are not installed in the browser (`node:http`, `process`, `vitest`) as
  an error, in the panel or as you type, matching the Types check.
  ([#95](https://github.com/Hankaws/aperture/pull/95))
- The agent asks TypeScript, not a text search. Composer, Aperture Bot and
  background runs can call `find_references`, which lists every place a name
  is declared or used, following an import under another name and skipping
  comments and an unrelated name spelled the same, and `rename_symbol`, which
  renames a name everywhere as F2 does and stages one edit per file. The
  recap's "Elsewhere:" line now comes from the compiler where it can: "listTasks
  is used in src/routes/tasks.ts (lines 2, 5)", or "is gone but still used in"
  when a change removes a name other code imports. Where the compiler is not
  available (a model on your own machine), the tools say so and the recap
  falls back to text, as before.
  ([#94](https://github.com/Hankaws/aperture/pull/94))
- Find all references and quick fixes in the editor. Shift+F12 on a
  TypeScript name lists every place it is declared or used, by file, in the
  sidebar; a row opens the file at the name. An underlined error offers
  TypeScript's own fixes, such as "Add import from './store.ts'", as buttons
  on hover, and Ctrl/⌘+. lists the file's problems with theirs. A fix is
  written with Undo. An added import follows the project's style, with or
  without the `.ts` extension. Where TypeScript checks the open file, its
  underlines replace the older line marks.
  ([#92](https://github.com/Hankaws/aperture/pull/92))
- Type errors as you type. In a TypeScript file, a mistake is underlined a
  moment after you stop typing, with TypeScript's message on hover, and the
  status bar counts the file's errors. Opening a file does not download the
  compiler; the first edit does.
  ([#91](https://github.com/Hankaws/aperture/pull/91))
- Rename and completions in the editor, from TypeScript itself. Press F2 on
  a name to rename it everywhere the project uses it: one Undo puts every
  file back, a staged change is never touched, and comments, strings and docs
  keep the old name. In TypeScript files, typing lists what can go there,
  with its kind: after a dot, the real members of what is on its left.
  ([#87](https://github.com/Hankaws/aperture/pull/87))
- The Bot page shows how to add the bot by hand, with no Aperture account:
  the repository secret, the workflow permission, and the workflow, with a
  Copy button. "Add it to a repo by hand" now goes there instead of off to
  GitHub. The workflows on the Check tab copy too, and the GitHub token
  fields link to GitHub's new-token form with the scopes they need ticked.
  ([#85](https://github.com/Hankaws/aperture/pull/85))
- The replay demo answers inline edits and points to your own code. Select
  a line one of the demo's bugs is on, press Ctrl/⌘K and ask to fix it: the
  recorded fix is staged, with its checks, signed in or not. Anything else
  says which lines work. After you apply a change, Composer says it ran on a
  sample project with recorded answers, and links to Aperture Bot and Agent
  Check, which run in your own repository's GitHub Actions.
  ([#84](https://github.com/Hankaws/aperture/pull/84))
- Signed-out visitors can try the replay demo. On a deployment running the
  replay model, Composer plans, builds, checks and applies without an
  account, the way it does for someone signed in. The runs cost nothing and
  are rate limited. Without replay, Composer still asks you to sign in.
  ([#82](https://github.com/Hankaws/aperture/pull/82))
- TypeScript in the editor knows your code. Hover a name to see its type
  and its doc comment, from the TypeScript compiler. Press F12, or
  Ctrl/⌘+click a name, to open where it is defined, with the name selected;
  a name from the standard library says so. The compiler loads the first
  time you ask, and the hover says it is loading until then.
  ([#80](https://github.com/Hankaws/aperture/pull/80))
- Search across the project. Ctrl/⌘+Shift+F, or the search icon over the
  files, opens Search in the sidebar: every match in every file, grouped by
  file, with match case, whole word and regular expressions. A match opens
  its file with the match selected. Replace works in one file or in all,
  writes the files as an edit you can undo in one step, and leaves files
  with a staged change alone. Ctrl/⌘+P still opens a file by name.
  ([#79](https://github.com/Hankaws/aperture/pull/79))
- `/benchmark` counts a real repository, nestjs/nest, at `de2574e`
  (13 Oct 2026): 2,111 TypeScript files. The editor's compiler
  refuses it. Agent Check still reads it. Recount with
  `node scripts/measure-large-repo.mjs`.
  ([#78](https://github.com/Hankaws/aperture/pull/78))
- The replay demo can show a caught failed fix. Ask Composer to make
  `listTasks` return a number: the checks go red, Send back stages a second
  try that is still red, and nothing is applied. A clip of that is
  `public/caught-a-bad-change.webm`.
  ([#78](https://github.com/Hankaws/aperture/pull/78))
- Checks now carry a verification id. It is a hash of the staged text, the
  base it was written against, the package.json scripts, the lockfile,
  `.aperture/hooks.json` and the verifier version. Apply recomputes it and
  waits if any of those moved, including a staged edit that rewrites the
  script a hook runs. The id is on the check strip.
  ([#77](https://github.com/Hankaws/aperture/pull/77))
- A Vercel Sandbox run that would reach a host outside the package-registry
  allowlist, or that would put a secret in the environment, does not start
  until it is approved. The closed verify run is unchanged.
  ([#77](https://github.com/Hankaws/aperture/pull/77))
- When a fix is sent back and comes back red, the check strip shows attempt
  1 beside the fix: the red rows and the diff.
  ([#77](https://github.com/Hankaws/aperture/pull/77))
- `/benchmark` states the large-repo limits: the editor's compiler stops
  above 600 TypeScript files, Agent Check reads 5,000 files and typechecks
  3,000, and a 601-file project is the worked example.
  ([#77](https://github.com/Hankaws/aperture/pull/77))
- Agent Check can cache the base test result by commit (`baseline: cache`)
  and reuse it while that commit stays the base. The default is still to
  recompute.
  ([#77](https://github.com/Hankaws/aperture/pull/77))
- Routines: a bot can look things over on its own. Pick "Look over" in a
  bot's standing jobs, every night or every Monday. On its schedule the bot
  reads CI on the default branch and the open issues and pull requests, and
  posts a few sentences on how things stand, with up to three things it would
  do next, on its own issue. It changes nothing. The note shows on the task
  card and in the activity feed, and the newest one comes to the bot's chat
  with its suggestions as cards to send or dismiss.
  ([#68](https://github.com/Hankaws/aperture/pull/68))
- Bots come back with suggestions. When a task you sent from a bot's chat
  finishes, the bot says so in the chat: the pull request it opened, a check
  that came back red, or where it stopped. Every finished run ends with up
  to three things the bot would do next, in its reply on GitHub, on the
  task's card as "Suggested next", and in the chat as cards you can send or
  dismiss. Nothing is done until you send one.
  ([#65](https://github.com/Hankaws/aperture/pull/65))
- Three in one: Aperture Bot now does Agent Check's job too. Comment
  `/aperture check` on a pull request and the bot runs Aperture Agent Check
  on it and replies with the report, changing nothing and using no model key.
  A new standing job, "Check every pull request", does that on each push,
  keeping one report per pull request up to date. The Bot page has three
  tabs: Team, Check (check a pull request now, and Agent Check on its own)
  and Agents (connect an agent with a token). The menu's Agents, Agent Check
  and Bot are one item, Bot, and the old pages lead to its tabs.
  ([#59](https://github.com/Hankaws/aperture/pull/59))
- Ideas from Grok Bot's changelog for the bot team. A suggestion card names
  the bot and what it wants to do, and quotes what you asked. Each bot has a
  rule in its profile: ask first, or always allow checks, so a check on a
  pull request sends itself and says so, with a link to edit the rule. Work
  that changes code always waits for a click. A card left unsent for a day
  closes, since the repository has likely moved on. Issues and pull requests
  a bot names ([#12](https://github.com/Hankaws/aperture/pull/12)) link to GitHub and preview their title on hover. The
  chat can also read a pull request's changed files, and the latest releases
  and tags. ([#59](https://github.com/Hankaws/aperture/pull/59))
- The bot team comes alive. The roster shows what each bot is doing on
  GitHub (queued, working on #12, opened a pull request, stuck on red
  checks), and its mascot's face follows. Each bot can talk on a model of
  its own: the Settings default, any provider key you saved, or your custom
  endpoint, picked in its chat header or profile. Conversations are kept on
  your account, so your phone and laptop show the same ones.
  ([#58](https://github.com/Hankaws/aperture/pull/58))
- A team of Aperture Bots on the Bot page, laid out like a messaging app.
  Make bots of your own, each looking after one repository with its own name,
  mascot and way of working. Pick them from a roster with their last message,
  talk each one through in its own conversation, and open its profile, tasks
  and setup beside the chat. Each has a new mascot: a lens with a face, in
  five shapes, ten faces and ten colours, that looks busy while the bot works
  and can be saved as a PNG for a GitHub App's logo. A new bot asks first what
  to focus on; the answer becomes how its chat works. Bots are kept on your
  account. ([#57](https://github.com/Hankaws/aperture/pull/57))
- An activity feed on the Bot page: what Aperture Bot did across your most
  recently pushed repositories, newest first and by day. Each ask, and what
  came of it (a pull request opened, a commit pushed, stopped red, working
  now), with its checks and files, and a link to it on GitHub. Before there
  is any, and for visitors, a sample week shows what it will look like,
  marked as an example. ([#56](https://github.com/Hankaws/aperture/pull/56))
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

- "Open the editor" goes straight to the editor instead of the sign-in page.
  The demo needs no account; you sign in only to send to a model or save.
  The result of a check now opens with one sentence, "Safe to apply: 4 of 5
  checks passed" or "Held back: 1 of 5 checks failed", and has one Apply
  button that says how many files it writes, in place of Apply now, Apply all
  and Apply. The amber "Already failing before this change" line wraps in full
  instead of being cut off, and every red or amber check explains itself.
  ([#101](https://github.com/Hankaws/aperture/pull/101))
- Aperture's MCP server lets an agent or a registry such as Smithery see
  what it offers without a token: `initialize`, `ping` and `tools/list`
  answer anyone, with the same `check_change` description for everyone and
  nothing from any account. `tools/call` still needs an agent token, and
  without one gets a 401 with a JSON-RPC error that says where to make one; a
  revoked or mistyped token is told it is not valid instead.
  ([#93](https://github.com/Hankaws/aperture/pull/93))
- The Agent Check workflow on the Bot page's Check tab, on the landing page
  and in the action's README uses `hankaws/aperture-agent-check@v1.2`, the
  release with `baseline` and `baseline-dir`. Both say that a GitHub-hosted
  runner starts empty, so `baseline: cache` needs the folder kept with
  `actions/cache`, keyed on the base commit, and show the step.
  ([#86](https://github.com/Hankaws/aperture/pull/86))
- The review step reads more plainly. With the checks in, skipping the
  optional review pass is "Apply now" ("Apply anyway" is kept for a red
  check), the recap's "Didn't:" line is now "Elsewhere:", listing other files
  that use a changed name, and the Composer bar no longer squeezes its title
  behind a finished plan's progress bar.
  ([#83](https://github.com/Hankaws/aperture/pull/83))
- A bot's suggestion about an open issue or pull request goes there. "Fix
  #15: …" in a report or a look-over is a card that works on #15, with its
  title, instead of opening a new issue that repeats it. A suggestion naming
  no open thread, or several, still opens a new issue.
  ([#76](https://github.com/Hankaws/aperture/pull/76))
- The bot chat takes a few habits from Grok Bot. While it works, the status
  says what it is doing ("Thinking it through") and leaves its name off.
  Select text in the chat and press ⌘/Ctrl+L to quote it in the next message.
  Your messages take that bot's colour, and the thread sits in a column on a
  wide window. A long request on a card folds behind "View full request", and
  an expired check offers "Always allow checks". A file the bot names
  (`src/cart.ts`) links to that line on GitHub. The mascots' eyes are a little
  larger, and the roster's buttons are round. A reply that failed can be tried
  again. ([#66](https://github.com/Hankaws/aperture/pull/66))
- The public site follows the theme you pick. The switch reads the page, the
  browser chrome matches, and "Your agent can ask too" carries the aperture
  mark with eyes. Search results scroll on a short window, and the nav no
  longer jumps when "Open" replaces its placeholder.
  ([#77](https://github.com/Hankaws/aperture/pull/77))
- With an Anthropic key, the editor's agent, the bot and its chat use
  Claude Opus 5.5 instead of Claude Sonnet 4.5, with room for its thinking
  and medium effort. A request Claude declines is retried on the model
  Anthropic picks for it, and otherwise says it was declined instead of
  answering with nothing. ([#62](https://github.com/Hankaws/aperture/pull/62))
- The Agent Check workflow shown on the Bot page's Check tab and in the
  action's README uses `hankaws/aperture-agent-check@v1.1`, the release with
  the current checks. ([#60](https://github.com/Hankaws/aperture/pull/60))
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

- Accessibility: links inside text are underlined, not only coloured; the
  version link in the footer is named by what it shows; the code editor has a
  name for screen readers and says that Escape, then Tab, leaves it (Tab
  otherwise indents); the sign-in fields have labels, the Sign in and Create
  account switch says which is on, and a sign-in error is announced; code
  comments are light enough to read (4.5:1).
  ([#101](https://github.com/Hankaws/aperture/pull/101))
- The unsaved dot means what it says. Ctrl/⌘+S showed "Saved" but left the
  dot on the file and the count in the status bar until a reload, and
  applying a change marked its file unsaved. Now Ctrl/⌘+S runs the file's
  save hooks and clears its dot, and Apply counts as the save, since the
  change already ran its checks. The dot's tooltip says your work is kept in
  this browser either way.
  ([#81](https://github.com/Hankaws/aperture/pull/81))
- When the model plans without a word, the bot's reply no longer quotes the
  editor's "Click Build it" as what the agent said.
  ([#64](https://github.com/Hankaws/aperture/pull/64))
- A model address that answers with something other than a model's reply
  (a parked address saying "OK", an error page) now says what came back and
  to check the address and model name, instead of "Unexpected token … is
  not valid JSON". ([#64](https://github.com/Hankaws/aperture/pull/64))
- When the model is busy (rate limited or overloaded, as Gemini's free tier
  often is), the bot waits and tries again, three times over about a
  minute and a half, instead of stopping on the first busy answer.
  ([#63](https://github.com/Hankaws/aperture/pull/63))
- A Gemini key works again: the bot, its chat, the editor's agent and Tab
  ask for Gemini 3.8 Flash, since Google turns new keys away from Gemini
  2.5 Flash. When a model provider refuses a request, the error now says
  what the provider said, not just its status code.
  ([#62](https://github.com/Hankaws/aperture/pull/62))
- From the bot's first run on a real repository: `/aperture check` counts
  when "check" is the first line, so a signature under it no longer turns it
  into a task; the error for a missing model key says where to add it; and
  the workflow the Bot page writes says every way it starts the bot,
  pull requests included. ([#62](https://github.com/Hankaws/aperture/pull/62))
- A line starting with `#` and a number, such as "#12 is fixed", no longer
  hangs and crashes a Markdown preview: the bot's chat replies and the
  editor's preview read it as text.
  ([#59](https://github.com/Hankaws/aperture/pull/59))
- Bot page fixes. A cleared conversation stays cleared on every device, a
  busy moment no longer lets an old copy overwrite a newer one, and nothing
  said while a conversation loads is lost. Long chats keep working, and a
  card sent while a reply is coming stays sent. Changing a bot's model keeps
  unsaved profile edits. The roster polls GitHub less, one busy repository no
  longer hides the other bots' news, and a local model is no longer offered
  as a bot's default. The bot reads the newest comments on long threads, and
  a standing job finds its tracking issue in a repository with many open
  ones. ([#59](https://github.com/Hankaws/aperture/pull/59))
- A part of the Bot page that fails no longer takes the whole page down: the
  chat, the setup and the task list each show what went wrong, where, and
  Try again; the chat can also clear the conversation this browser saved. A
  saved chat is checked when it is read back, and what does not fit is left
  out. ([#55](https://github.com/Hankaws/aperture/pull/55))
- The error screen shows where an error happened (the built file, line and
  column), so a bare message such as "l is not a function" can be traced to
  its source. ([#54](https://github.com/Hankaws/aperture/pull/54))
- The site's top bar fits when you are signed in. It ran off the screen on
  laptops and hid Pricing under the search box; your name and Sign out are
  now in the menu under your avatar, and Privacy and Changelog are in the
  footer, search and phone menu rather than the bar.
  ([#53](https://github.com/Hankaws/aperture/pull/53))
- Aperture Bot's own repository keeps its `action.yml` and README in step
  with the bundle: its build now copies them from Aperture with `dist/`.
  ([#53](https://github.com/Hankaws/aperture/pull/53))
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
