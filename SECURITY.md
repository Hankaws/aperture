# Security

Please don't report security problems in public issues.

Report them privately through GitHub instead: go to this repository's
**Security** tab and choose **Report a vulnerability**. Include what an attacker
could do, the steps to reproduce it, and the version or commit you tested.
You'll get an answer within a week.

Areas where a report is especially welcome:

- **The in-browser test runner** (`src/lib/runner/`) runs code the agent
  wrote. It must not reach the network, this app's API, or the page's storage.
- **The preview and render-check frames** must stay script-sandboxed with an
  opaque origin.
- **The agent's run allowance and the sandbox.** A verify run must never
  receive this app's secrets (`src/lib/sandbox/policy.ts`, `sandboxEnv`).
- **Sign-in:** sessions, and the rule that sign-in off never runs with a shared
  database.
