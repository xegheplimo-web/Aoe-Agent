#!/usr/bin/env bash
# scripts/verify.sh — canonical verification gate (PROJECT-DELIVERY-CONTRACT.md §6).
# Note: the desktop agent targets Windows; python steps need a venv with requirements.txt installed.
set -u
cd "$(dirname "$0")/.."
failed=()

run() {
    local name="$1"; shift
    echo; echo "== $name"
    "$@" || failed+=("$name")
}

# AOE1_PYTHON env override (git worktrees cannot share a .venv) > local .venv > system python.
PY="${AOE1_PYTHON:-}"
[ -n "$PY" ] && [ ! -f "$PY" ] && PY=""
[ -z "$PY" ] && { PY=".venv/Scripts/python.exe"; [ -f "$PY" ] || PY=".venv/bin/python"; }
[ -f "$PY" ] || PY="python"

run lint npm run lint
run typecheck npm run typecheck
run vitest npm test
run prettier npx prettier --check .
run ruff "$PY" -m ruff check .
run mypy "$PY" -m mypy aoe1
run unittest "$PY" -m unittest discover -s tests -v

echo
if [ "${#failed[@]}" -gt 0 ]; then
    echo "VERIFY FAIL: ${failed[*]}"
    exit 1
fi
echo "VERIFY PASS"
