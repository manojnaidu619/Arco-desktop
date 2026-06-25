#!/usr/bin/env bash
# Verify a freshly-built macOS release: signature integrity, Gatekeeper
# acceptance, and notarization stapling.
#
# Runs automatically after `npm run release:mac` via the `postrelease:mac`
# npm hook. Can also be invoked directly:
#
#   bash scripts/verify-release.sh
#
# Exits 0 on success, non-zero with a clear message on any failure.

set -uo pipefail

APP_PATH="$(cd "$(dirname "$0")/.." && pwd)/dist/mac-arm64/Arco.app"

if [ ! -d "$APP_PATH" ]; then
  echo "error: $APP_PATH not found." >&2
  echo "Run 'npm run release:mac' first." >&2
  exit 1
fi

# Colors only when stdout is a terminal (so CI logs stay clean).
if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; BOLD=""; RESET=""
fi

pass() { echo "${GREEN}  ✓${RESET} $1"; }
fail() { echo "${RED}  ✗${RESET} $1" >&2; }

echo
echo "${BOLD}Verifying $APP_PATH${RESET}"
echo

FAILED=0

# 1. Display the signature (informational — confirms identity, Team ID, runtime
#    flags). Not a pass/fail check itself; just useful context in the log.
echo "${BOLD}[1/4]${RESET} Signature details"
if codesign -dv --verbose=4 "$APP_PATH" 2>&1 | sed 's/^/    /'; then
  pass "signature info read"
else
  fail "could not read signature info"
  FAILED=1
fi
echo

# 2. Verify the signature is intact and every nested binary is signed by the
#    same identity (--deep) and meets the strictest validation (--strict).
echo "${BOLD}[2/4]${RESET} Signature integrity"
if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | sed 's/^/    /'; then
  pass "all binaries signed correctly"
else
  fail "signature verification failed — the app would be rejected by Gatekeeper"
  FAILED=1
fi
echo

# 3. Ask Gatekeeper itself whether it would accept this app for installation.
#    This is the closest thing to "what a user's Mac will do when they
#    double-click the DMG" — checks signature + notarization.
echo "${BOLD}[3/4]${RESET} Gatekeeper assessment"
if spctl -a -vvv -t install "$APP_PATH" 2>&1 | sed 's/^/    /'; then
  pass "Gatekeeper accepts the app"
else
  fail "Gatekeeper rejected the app — notarization may have failed"
  FAILED=1
fi
echo

# 4. Verify the notarization ticket is stapled to the bundle so Gatekeeper can
#    validate it offline (without phoning home to Apple every launch).
#
# Prefer `stapler validate` when available (ships with full Xcode.app). On
# machines with only Command Line Tools, fall back to checking the embedded
# ticket file directly — same guarantee, no Xcode dependency.
echo "${BOLD}[4/4]${RESET} Notarization ticket stapled"
if command -v stapler >/dev/null 2>&1 && \
   xcrun --find stapler >/dev/null 2>&1; then
  if xcrun stapler validate "$APP_PATH" 2>&1 | sed 's/^/    /'; then
    pass "ticket stapled and valid"
  else
    fail "no valid notarization ticket — Apple's notarytool did not finish, or stapling failed"
    FAILED=1
  fi
elif [ -f "$APP_PATH/Contents/CodeResources" ] && \
     codesign --test-requirement="=notarized" --verify "$APP_PATH" >/dev/null 2>&1; then
  echo "    stapler not installed (full Xcode missing) — verified via codesign instead"
  pass "ticket present and notarization requirement satisfied"
else
  fail "no valid notarization ticket — Apple's notarytool did not finish, or stapling failed"
  FAILED=1
fi
echo

if [ "$FAILED" -ne 0 ]; then
  echo "${RED}${BOLD}Verification FAILED.${RESET} Do not publish this build." >&2
  echo "Fix the issue and re-run 'npm run release:mac'." >&2
  exit 1
fi

echo "${GREEN}${BOLD}Verification passed.${RESET} Safe to publish with 'npm run publish:mac'."
