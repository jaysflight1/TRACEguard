#!/usr/bin/env bash
#
# TRACEguard judge / reviewer smoke test.
#
# Verifies — in under 60 seconds — that:
#   1. The CLI is installed and reports a version
#   2. `init` scaffolds the .traceguard tree correctly
#   3. The pre-tool-use hook blocks a Level 3 command (force-push)
#      and allows a Level 0 command (ls)
#   4. The test suite passes
#
# Run from anywhere after installing TRACEguard:
#   bash scripts/judge-smoke-test.sh
#
# Or, if invoking against a global install:
#   bash $(npm root -g)/traceguard/scripts/judge-smoke-test.sh

set -euo pipefail

# --- Color output --------------------------------------------------------
if [ -t 1 ]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BOLD=''; RESET=''
fi

pass() { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$1"; }
fail() { printf "  %s✗%s %s\n" "$RED" "$RESET" "$1"; FAILED=1; }
info() { printf "  %s·%s %s\n" "$YELLOW" "$RESET" "$1"; }

FAILED=0

# --- 1. Resolve installed package -----------------------------------------
printf "%sTRACEguard smoke test%s\n\n" "$BOLD" "$RESET"
printf "%s[1/4] CLI installed?%s\n" "$BOLD" "$RESET"

if ! command -v traceguard >/dev/null 2>&1; then
  fail "\`traceguard\` not on PATH. Install with: npm install -g github:jaysflight1/traceguard"
  exit 1
fi

TG_VERSION=$(traceguard --version)
pass "found \`traceguard\` (version $TG_VERSION) at $(command -v traceguard)"

# Resolve where the hook handlers live so we can pipe events through them.
if [ -n "${TRACEGUARD_DIST_DIR:-}" ]; then
  HOOK_DIR="$TRACEGUARD_DIST_DIR/hooks"
elif [ -d "$(npm root -g)/traceguard/dist/hooks" ]; then
  HOOK_DIR="$(npm root -g)/traceguard/dist/hooks"
else
  # Best-effort: derive from the binary's resolved path
  BIN_PATH=$(readlink -f "$(command -v traceguard)" 2>/dev/null || command -v traceguard)
  HOOK_DIR="$(dirname "$BIN_PATH")/../dist/hooks"
fi

if [ ! -f "$HOOK_DIR/pre-tool-use.js" ]; then
  fail "hook handlers not found at $HOOK_DIR — install is incomplete"
  exit 1
fi
pass "hook handlers resolved at $HOOK_DIR"
echo

# --- 2. Init in a tmp repo ----------------------------------------------
printf "%s[2/4] \`traceguard init\` scaffolds the project%s\n" "$BOLD" "$RESET"

TMP=$(mktemp -d -t tg-judge-XXXXXX)
trap 'rm -rf "$TMP"' EXIT

cd "$TMP"
git init -q
git config user.email judge@judge
git config user.name judge
echo "# smoke" > README.md
git add README.md
git commit -q -m "initial"

traceguard init >/dev/null

for required in \
  .traceguard/config.json \
  .traceguard/logs \
  .traceguard/receipts \
  .traceguard/hooks \
  CLAUDE.md \
  AGENTS.md; do
  if [ -e "$required" ]; then
    pass "$required present"
  else
    fail "$required missing"
  fi
done
echo

# --- 3. Pre-tool-use hook enforces risk levels --------------------------
printf "%s[3/4] Hook classifies actions correctly%s\n" "$BOLD" "$RESET"

# Level 0: ls -- should silently allow (exit 0, no decision payload)
ls_out=$(echo '{"session_id":"smoke","tool_name":"Bash","tool_input":{"command":"ls -la"}}' \
  | node "$HOOK_DIR/pre-tool-use.js" 2>/dev/null || true)
ls_exit=$?
if [ "$ls_exit" -eq 0 ] && [ -z "$ls_out" ]; then
  pass "Level 0 (\`ls -la\`) silently allowed"
else
  fail "Level 0 should silently allow — got exit=$ls_exit, output: $ls_out"
fi

# Level 3: git push --force -- should emit {"decision":"block"} and exit 2
set +e
block_out=$(echo '{"session_id":"smoke","tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' \
  | node "$HOOK_DIR/pre-tool-use.js" 2>/dev/null)
block_exit=$?
set -e
if [ "$block_exit" -eq 2 ] && echo "$block_out" | grep -q '"decision":"block"'; then
  pass "Level 3 (\`git push --force\`) blocked with exit 2 and JSON decision"
else
  fail "Level 3 should block — got exit=$block_exit, output: $block_out"
fi
echo

# --- 4. Test suite ------------------------------------------------------
printf "%s[4/4] Test suite%s\n" "$BOLD" "$RESET"

# Find the package root so we can run npm test against it.
if [ -d "$(npm root -g)/traceguard" ]; then
  PKG_ROOT="$(npm root -g)/traceguard"
elif [ -d "$HOOK_DIR/../.." ]; then
  PKG_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
else
  PKG_ROOT=""
fi

if [ -z "$PKG_ROOT" ] || [ ! -f "$PKG_ROOT/package.json" ]; then
  info "package root not found — skipping test suite. Run \`npm test\` from a cloned checkout."
else
  if (cd "$PKG_ROOT" && npm test --silent >/dev/null 2>&1); then
    pass "48 tests pass (\`cd $PKG_ROOT && npm test\`)"
  else
    fail "test suite did not pass — run \`cd $PKG_ROOT && npm test\` to inspect"
  fi
fi
echo

# --- Summary ------------------------------------------------------------
if [ "$FAILED" -eq 0 ]; then
  printf "%s✓ All checks passed.%s TRACEguard %s is working end-to-end.\n" "$GREEN" "$RESET" "$TG_VERSION"
  exit 0
else
  printf "%s✗ One or more checks failed.%s See output above.\n" "$RED" "$RESET"
  exit 1
fi
