# Changelog

What changed in Aperture, newest first. Every pull request adds its line
under **Unreleased**; the site shows this file at `/changelog`.

## Unreleased

### Added

- A changelog, here and at `/changelog`.

## 2026-10-05

### Added

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
