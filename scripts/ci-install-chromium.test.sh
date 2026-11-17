#!/usr/bin/env bash
# Runs ci-install-chromium.sh against a stand-in for Playwright and node, so
# its retries and its skipping of apt are checked without installing anything.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

# A fake `playwright`: `install` fails until try $DOWNLOAD_OK, `install-deps` until try $DEPS_OK.
cat >"$work/playwright" <<'EOF'
#!/usr/bin/env bash
n=$(( $(cat "$STATE/$1" 2>/dev/null || echo 0) + 1 ))
echo "$n" >"$STATE/$1"
if [ "$1" = install ]; then [ "$n" -ge "$DOWNLOAD_OK" ]; else [ "$n" -ge "$DEPS_OK" ]; fi
EOF
# A fake `node`: the browser launches when $LAUNCHES is 1, or once install-deps has run.
cat >"$work/node" <<'EOF'
#!/usr/bin/env bash
[ "$LAUNCHES" = 1 ] || [ -s "$STATE/install-deps" ]
EOF
chmod +x "$work/playwright" "$work/node"

run() {
  local name="$1" want="$2" download_ok="$3" deps_ok="$4" launches="$5" want_downloads="$6" want_deps="$7"
  local state="$work/$name"
  mkdir -p "$state"
  STATE="$state" DOWNLOAD_OK="$download_ok" DEPS_OK="$deps_ok" LAUNCHES="$launches" \
    PLAYWRIGHT="$work/playwright" NODE="$work/node" TRIES=3 WAIT=0 CAP=10 \
    bash "$here/ci-install-chromium.sh" >"$state/out" 2>&1
  local got=$?
  local downloads deps
  downloads=$(cat "$state/install" 2>/dev/null || echo 0)
  deps=$(cat "$state/install-deps" 2>/dev/null || echo 0)
  if [ "$got" = "$want" ] && [ "$downloads" = "$want_downloads" ] && [ "$deps" = "$want_deps" ]; then
    echo "ok - $name"
  else
    echo "not ok - $name: exit $got (want $want), downloads $downloads (want $want_downloads), apt $deps (want $want_deps)"
    sed 's/^/    /' "$state/out"
    failures=$((failures + 1))
  fi
}

#   name                                              exit dl-ok deps-ok launches dl apt
run "the browser launches: no apt at all"                0   1     1       1        1  0
run "a download blip is tried again"                     0   3     1       1        3  0
run "a download that keeps failing fails the step"       1   9     1       1        3  0
run "missing libraries are installed"                    0   1     1       0        1  1
run "an apt blip is tried again"                         0   1     2       0        1  2
run "apt that keeps failing fails the step"              1   1     9       0        1  3

exit "$failures"
