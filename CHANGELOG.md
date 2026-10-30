# Changelog

What changed in Aperture, newest first. Every pull request adds its line
under **Unreleased**; the site shows this file at `/changelog`. A heading
with a version number is the day that version was released, and its
release notes are every line from there down to the previous version.

## Unreleased

### Added

- Aperture Bot can work unasked. With "Reply to new issues" on, it reads each new issue and the code and replies with what it would do (or asks for what is missing), its first box being the issue itself to tick. With "Explain red CI" on, a workflow that fails on the default branch is explained on the bot's own issue, once per red commit, with the fix to tick. Both change nothing on their own and stop at 20 replies a day (`daily-limit`). ([#155](https://github.com/Hankaws/aperture/pull/155))
- Aperture Bot answers questions and takes suggestions with one tick. Comment `/aperture why does the login test fail?` and it answers on the thread from the code, the diff and the failing checks, changing nothing. Every reply ends with what it would do next as boxes: tick one and it does it, as if you had asked with `/aperture`. Ticking needs the workflow to listen for edited comments, as the Bot page's and the README's now do. ([#154](https://github.com/Hankaws/aperture/pull/154))
- Subscribers can switch between Pro and Team, or between monthly and yearly, from the pricing table: Paddle prices the change first ("You pay $18.50 now for the rest of this period"), and Settings → Plan shows the switch once Paddle confirms it. ([#153](https://github.com/Hankaws/aperture/pull/153))

### Fixed

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
