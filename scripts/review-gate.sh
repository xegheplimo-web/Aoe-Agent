#!/usr/bin/env bash
# Review Gate (CI judge): merge only after a reviewer has approved or
# commented on the CURRENT head SHA and zero review threads remain
# unresolved.
#
#   usage: review-gate.sh <owner/repo> <pr-number> <head-sha>
#
# - each reviewer counts only by their LATEST review on the head — a later
#   APPROVED clears an earlier CHANGES_REQUESTED from the same reviewer
# - review states APPROVED / COMMENTED count as "reviewed";
#   CHANGES_REQUESTED fails fast; DISMISSED / PENDING do not count
# - EVERY unresolved thread blocks, including ones outdated by new commits —
#   GitHub's conversation-resolution rule treats them the same way
# - if the head moves mid-run, this run is stale and exits 0
# - on timeout: request a review (e.g. `@codex review`), then re-run
set -euo pipefail

REPO="${1:?owner/repo required}"
PR="${2:?pr number required}"
HEAD="${3:?head sha required}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
DEADLINE=$((SECONDS + ${REVIEW_TIMEOUT_SECONDS:-720}))
INTERVAL="${REVIEW_INTERVAL_SECONDS:-30}"

QUERY='query($owner:String!,$name:String!,$pr:Int!,$cursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){
      headRefOid
      reviews(last:100){ nodes { author { login } commit { oid } state submittedAt } }
      reviewThreads(first:100, after:$cursor){
        pageInfo { hasNextPage endCursor }
        nodes { isResolved isOutdated }
      }
    }
  }
}'

# Collect EVERY review thread page — a gate that samples is not a gate.
all_threads() {
    local cursor="null" page unresolved_total=0
    while :; do
        page="$(gh api graphql -F owner="${OWNER}" -F name="${NAME}" -F pr="${PR}" \
            -F cursor="${cursor}" -f query="${QUERY}")"
        unresolved_total=$((unresolved_total + $(echo "${page}" | jq \
            '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length')))
        if [ "$(echo "${page}" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')" != "true" ]; then
            break
        fi
        cursor="$(echo "${page}" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')"
    done
    echo "${unresolved_total}"
}

echo "REVIEW-GATE ${REPO}#${PR} head=${HEAD:0:8} timeout=${REVIEW_TIMEOUT_SECONDS:-720}s"
while :; do
    out="$(gh api graphql -F owner="${OWNER}" -F name="${NAME}" -F pr="${PR}" -f query="${QUERY}")"
    pr_json="$(echo "${out}" | jq '.data.repository.pullRequest')"

    current="$(echo "${pr_json}" | jq -r '.headRefOid')"
    if [ "${current}" != "${HEAD}" ]; then
        echo "REVIEW-GATE SKIP — head moved to ${current:0:8}; this run is stale"
        exit 0
    fi

    # Reduce to each reviewer's LATEST review on the head before judging.
    changes_requested="$(echo "${pr_json}" | jq --arg head "${HEAD}" \
        "[.reviews.nodes[] | select(.commit.oid == \$head)] | group_by(.author.login) | map(sort_by(.submittedAt) | last) | map(select(.state == \"CHANGES_REQUESTED\")) | length")"
    if [ "${changes_requested}" -gt 0 ]; then
        echo "REVIEW-GATE FAIL — CHANGES_REQUESTED on ${HEAD:0:8}"
        exit 1
    fi

    unresolved="$(all_threads)"
    if [ "${unresolved}" -gt 0 ]; then
        echo "REVIEW-GATE FAIL — ${unresolved} unresolved review thread(s) on ${HEAD:0:8}"
        exit 1
    fi

    reviewed="$(echo "${pr_json}" | jq --arg head "${HEAD}" \
        "[.reviews.nodes[] | select(.commit.oid == \$head)] | group_by(.author.login) | map(sort_by(.submittedAt) | last) | map(select(.state == \"APPROVED\" or .state == \"COMMENTED\")) | length")"
    if [ "${reviewed}" -gt 0 ]; then
        echo "REVIEW-GATE PASS — ${reviewed} review(s) on ${HEAD:0:8}, no unresolved threads"
        exit 0
    fi

    if [ "${SECONDS}" -ge "${DEADLINE}" ]; then
        echo "REVIEW-GATE FAIL — no review on ${HEAD:0:8} before timeout"
        echo "Request a review (e.g. comment '@codex review'), then re-run this job."
        exit 1
    fi
    echo "waiting for review on ${HEAD:0:8} ..."
    sleep "${INTERVAL}"
done
