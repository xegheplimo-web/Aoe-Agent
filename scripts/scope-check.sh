#!/usr/bin/env bash
# Scope Guard (CI judge): the PR diff must not touch forbidden paths and must
# not introduce secret-looking strings. This job only judges — fixes happen in
# the agent's worktree, never in Actions.
set -euo pipefail

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
