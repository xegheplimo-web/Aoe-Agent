#!/usr/bin/env bash
# Scope Guard (CI judge): the PR diff must not touch forbidden paths, must not
# introduce secret-looking strings, and — when the PR body declares a
# `Scope:` line — every changed path must match the declared globs.
#
#   usage: scope-check.sh <owner/repo> <pr-number>     (PR form)
#          BASE_SHA=<ref> scope-check.sh               (local form)
#
# `Scope:` line convention (PR body):
#   Scope: aoe1/** tests/** run.py
# A task with no Scope line is judged against the forbidden list only.
set -euo pipefail

REPO="${1:-}"
PR="${2:-}"
BASE="${BASE_SHA:-origin/main}"
echo "SCOPE base: ${BASE}"

changed="$(git diff --name-only "${BASE}...HEAD")"
if [ -z "${changed}" ]; then
    echo "SCOPE PASS — empty diff"
    exit 0
fi

forbidden=(
    'config.json' '.env' '.env.*' '*.env' '.envrc'
    'runs/*' 'diagnostics/*' '.venv/*' 'assets/*.png'
    '*secret*' '*.pem' '*.key' 'node_modules/*'
)
fail=0
while IFS= read -r path; do
    for pattern in "${forbidden[@]}"; do
        # shellcheck disable=SC2254
        case "${path}" in ${pattern})
            echo "SCOPE FAIL — forbidden path: ${path} (pattern: ${pattern})"
            fail=1
            ;;
        esac
    done
done <<< "${changed}"

# Task-declared allowlist: `Scope:` line in the PR body, space-separated globs.
allowlist=""
if [ -n "${REPO}" ] && [ -n "${PR}" ]; then
    body="$(gh pr view "${PR}" --repo "${REPO}" --json body --jq .body)"
    allowlist="$(echo "${body}" | grep -oiE '^scope:.*' | head -1 | sed -E 's/^scope://I')"
fi
if [ -n "${allowlist// /}" ]; then
    echo "SCOPE allowlist: ${allowlist}"
    while IFS= read -r path; do
        matched=0
        for pattern in ${allowlist}; do
            # shellcheck disable=SC2254
            case "${path}" in ${pattern}) matched=1 ;; esac
        done
        if [ "${matched}" -eq 0 ]; then
            echo "SCOPE FAIL — outside declared scope: ${path}"
            fail=1
        fi
    done <<< "${changed}"
fi

added="$(git diff --unified=0 "${BASE}...HEAD" -- . ':(exclude)package-lock.json' | grep -E '^\+' || true)"
secret_pattern='ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghu_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|BEGIN [A-Z ]*PRIVATE KEY'
if echo "${added}" | grep -nE "${secret_pattern}"; then
    echo "SCOPE FAIL — secret-looking content in added lines"
    fail=1
fi

if [ "${fail}" -ne 0 ]; then
    exit 1
fi
echo "SCOPE PASS — $(echo "${changed}" | wc -l) file(s) in scope, no secrets"
