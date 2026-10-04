#!/usr/bin/env bash
# scripts/sync-main.sh — Sync Gate (PROJECT-DELIVERY-CONTRACT.md §2).
# Exit 0 = in sync/fast-forwarded. Exit 2 = BLOCKED (never auto-repairs shared state).
set -u
cd "$(dirname "$0")/.."

blocked() { echo "BLOCKED: $1"; exit 2; }

git remote get-url origin >/dev/null 2>&1 || blocked 'no `origin` remote configured'
git fetch origin --prune --tags || blocked 'git fetch failed'

branch="$(git branch --show-current)"
dirty="$(git status --porcelain=v1 --untracked-files=all)"

[ "$branch" = "main" ] && [ -n "$dirty" ] && blocked "dirty worktree on main"
if [ "$branch" != "main" ]; then
    if [ -n "$dirty" ]; then
        echo "SKIP: on $branch with uncommitted work — nothing synced"
        exit 0
    fi
    git checkout main >/dev/null 2>&1 || blocked 'could not switch to main'
fi

git rev-parse --verify main >/dev/null 2>&1 || \
    git checkout -b main --track origin/main >/dev/null 2>&1 || \
    blocked 'local main missing and could not track origin/main'

local_sha="$(git rev-parse main)"
remote_sha="$(git rev-parse origin/main)"
state='IN_SYNC'

if [ "$local_sha" != "$remote_sha" ]; then
    if git merge-base --is-ancestor main origin/main; then
        git pull --ff-only origin main || blocked 'fast-forward failed'
        state='FAST_FORWARDED'
    else
        blocked 'local main has diverged from origin/main — resolve manually'
    fi
fi

[ "$(git rev-parse 'main^{tree}')" = "$(git rev-parse 'origin/main^{tree}')" ] || \
    blocked 'tree mismatch between local and origin main'

echo "SYNC $state — main $(git rev-parse --short main) == origin/main (tree verified)"
