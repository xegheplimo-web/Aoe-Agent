#!/usr/bin/env bash
# scripts/doctor.sh — environment health report (PROJECT-DELIVERY-CONTRACT.md §11).
set -u
cd "$(dirname "$0")/.."
fails=0

row() { printf '%-20s %-14s %s\n' "$1" "$2" "$3"; [ "$2" = "FAIL" ] && fails=$((fails+1)); return 0; }
have() { command -v "$1" >/dev/null 2>&1; }

have git       && row 'git' PASS "$(git --version)"              || row 'git' FAIL 'not installed'
have gh        && row 'gh' PASS "$(gh --version | head -1)"      || row 'gh' WARN 'GitHub CLI not installed'
have gh && gh auth status >/dev/null 2>&1 && row 'gh auth' PASS 'authenticated' || row 'gh auth' WARN 'run: gh auth login'
have node      && row 'node' PASS "$(node --version)"            || row 'node' FAIL 'not installed'
have npm       && row 'npm' PASS "$(npm --version)"              || row 'npm' FAIL 'not installed'
have uv        && row 'uv' PASS "$(uv --version)"                || row 'uv' WARN 'optional'
have tesseract && row 'tesseract' PASS "$(tesseract --version 2>/dev/null | head -1)" || row 'tesseract' WARN 'required for OCR'

[ -d .git ] && row 'git repo' PASS '' || row 'git repo' FAIL 'run: git init -b main'
origin="$(git remote get-url origin 2>/dev/null)"
[ -n "$origin" ] && row 'origin remote' PASS "$origin" || row 'origin remote' WARN 'not configured'

if [ -n "$origin" ] && [ -d .git ]; then
    git fetch origin --prune --tags >/dev/null 2>&1
    l="$(git rev-parse --verify main 2>/dev/null)"; r="$(git rev-parse --verify origin/main 2>/dev/null)"
    if [ -z "$r" ]; then row 'origin/main' WARN 'remote has no main yet';
    elif [ -z "$l" ]; then row 'main sync' WARN 'no local main — run scripts/sync-main.sh';
    elif [ "$l" != "$r" ]; then
        git merge-base --is-ancestor main origin/main 2>/dev/null \
            && row 'main sync' WARN 'behind — run sync-main.sh' \
            || row 'main sync' FAIL 'DIVERGED — manual fix'
    else
        [ "$(git rev-parse 'main^{tree}')" = "$(git rev-parse 'origin/main^{tree}')" ] \
            && row 'main sync' PASS "SHA+tree match ${l:0:7}" || row 'main sync' FAIL 'tree mismatch'
    fi
fi

[ -z "$(git status --porcelain=v1 --untracked-files=all 2>/dev/null)" ] \
    && row 'worktree' PASS 'clean' || row 'worktree' WARN 'uncommitted changes'
[ -f package-lock.json ] && row 'package-lock.json' PASS '' || row 'package-lock.json' WARN 'missing — npm install + commit'
[ -d node_modules ] && row 'node_modules' PASS '' || row 'node_modules' WARN 'missing'
PY=".venv/Scripts/python.exe"; [ -f "$PY" ] || PY=".venv/bin/python"
if [ -f "$PY" ]; then
    v="$("$PY" --version 2>&1)"; case "$v" in *3.11*) row '.venv' PASS "$v";; *) row '.venv' WARN "$v";; esac
else row '.venv' WARN 'missing — run scripts/setup.sh'; fi
[ -f .env ] && row '.env' PASS '' || row '.env' WARN 'copy .env.example'
[ -n "$(git lfs ls-files 2>/dev/null)" ] && row 'git LFS' WARN 'LFS files present' || row 'git LFS' NOT_APPLICABLE ''
[ -f .gitmodules ] && row 'submodules' WARN 'init required' || row 'submodules' NOT_APPLICABLE ''

echo; [ "$fails" -gt 0 ] && { echo "DOCTOR: $fails FAIL"; exit 1; } || echo 'DOCTOR: no FAIL'
