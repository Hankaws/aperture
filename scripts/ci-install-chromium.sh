#!/usr/bin/env bash
# Installs Playwright's Chromium on a CI runner, riding out network blips.
#
# `playwright install --with-deps` puts the system packages in with apt, and
# when the runner cannot reach Ubuntu's mirrors apt retries for ten minutes
# and fails the job before any test runs (2026-11-11). So:
#   1. download the browser (Playwright's own server), a few tries;
#   2. if it already launches, as it does on GitHub's images, stop: no apt;
#   3. otherwise install the system packages, a few tries, each one capped.
# PLAYWRIGHT, NODE, TRIES, WAIT and CAP are for the test (`ci-install-chromium.test.sh`).
set -u

PLAYWRIGHT="${PLAYWRIGHT:-npx playwright}"
NODE="${NODE:-node}"
TRIES="${TRIES:-3}"
WAIT="${WAIT:-30}"
CAP="${CAP:-300}"

# Runs "$@" up to TRIES times, each capped at CAP seconds, waiting WAIT between.
attempt() {
  local what="$1"
  shift
  for i in $(seq 1 "$TRIES"); do
    if timeout "$CAP" "$@"; then
      return 0
    fi
    if [ "$i" -lt "$TRIES" ]; then
      echo "::warning::${what} failed (try ${i} of ${TRIES}). Trying again in ${WAIT} s."
      sleep "$WAIT"
    fi
  done
  echo "::error::${what} failed ${TRIES} times."
  return 1
}

launches() {
  $NODE -e 'require("playwright").chromium.launch().then((b) => b.close()).catch(() => process.exit(1))'
}

# shellcheck disable=SC2086 # PLAYWRIGHT is a command and its arguments
attempt "Downloading Chromium" $PLAYWRIGHT install chromium || exit 1

if launches; then
  echo "Chromium launches with the runner's own libraries: no system packages needed."
  exit 0
fi

echo "Chromium needs system packages; installing them."
# shellcheck disable=SC2086
attempt "Installing Chromium's system packages" $PLAYWRIGHT install-deps chromium || exit 1
launches || {
  echo "::error::Chromium still does not launch after installing its system packages."
  exit 1
}
