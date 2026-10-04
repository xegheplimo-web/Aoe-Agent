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
DEADLINE=$((SECONDS + ${REVIEW_TIMEOUT_SECONDS:-1800}))
INTERVAL="${REVIEW_INTERVAL_SECONDS:-45}"

QUERY='query($owner:String!,$name:String!,$pr:Int!,$rcursor:String,$tcursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){
      headRefOid
      reviews(first:100, after:$rcursor){
        pageInfo { hasNextPage endCursor }
        nodes { author { login } commit { oid } state submittedAt }
      }
      reviewThreads(first:100, after:$tcursor){
        pageInfo { hasNextPage endCursor }
        nodes { isResolved }
      }
    }
  }
}'

# Page through BOTH connections until exhausted — a gate that samples the
# first page is not a gate. Prints one JSON object: {head, reviews, unresolved}.
fetch_all() {
    local rcursor="null" tcursor="null" rdone=0 tdone=0 unresolved=0
    local reviews='[]' page pr head

    while [ "${rdone}" -eq 0 ] || [ "${tdone}" -eq 0 ]; do
        page="$(gh api graphql -F owner="${OWNER}" -F name="${NAME}" -F pr="${PR}" \
            -F rcursor="${rcursor}" -F tcursor="${tcursor}" -f query="${QUERY}")"
        pr="$(echo "${page}" | jq '.data.repository.pullRequest')"
        head="$(echo "${pr}" | jq -r '.headRefOid')"

        if [ "${rdone}" -eq 0 ]; then
            reviews="$(jq -n --argjson a "${reviews}" \
                --argjson b "$(echo "${pr}" | jq '.reviews.nodes')" '$a + $b')"
            if [ "$(echo "${pr}" | jq -r '.reviews.pageInfo.hasNextPage')" = "true" ]; then
                rcursor="$(echo "${pr}" | jq -r '.reviews.pageInfo.endCursor')"
            else
                rdone=1
            fi
        fi
        if [ "${tdone}" -eq 0 ]; then
            unresolved=$((unresolved + $(echo "${pr}" | jq \
                '[.reviewThreads.nodes[] | select(.isResolved == false)] | length')))
            if [ "$(echo "${pr}" | jq -r '.reviewThreads.pageInfo.hasNextPage')" = "true" ]; then
                tcursor="$(echo "${pr}" | jq -r '.reviewThreads.pageInfo.endCursor')"
            else
                tdone=1
            fi
        fi
    done

    jq -n --arg head "${head}" --argjson reviews "${reviews}" \
        --argjson unresolved "${unresolved}" \
        '{head: $head, reviews: $reviews, unresolved: $unresolved}'
}

echo "REVIEW-GATE ${REPO}#${PR} head=${HEAD:0:8} timeout=${REVIEW_TIMEOUT_SECONDS:-1800}s"
while :; do
    data="$(fetch_all)"

    current="$(echo "${data}" | jq -r '.head')"
    if [ "${current}" != "${HEAD}" ]; then
        echo "REVIEW-GATE SKIP — head moved to ${current:0:8}; this run is stale"
        exit 0
    fi

    # Reduce to each reviewer's LATEST review on the head before judging.
    latest='[.reviews[] | select(.commit.oid == $head)]
        | group_by(.author.login) | map(sort_by(.submittedAt) | last)'

    changes_requested="$(echo "${data}" | jq --arg head "${HEAD}" \
        "${latest} | map(select(.state == \"CHANGES_REQUESTED\")) | length")"
    if [ "${changes_requested}" -gt 0 ]; then
        echo "REVIEW-GATE FAIL — CHANGES_REQUESTED on ${HEAD:0:8}"
        exit 1
    fi

    unresolved="$(echo "${data}" | jq -r '.unresolved')"
    if [ "${unresolved}" -gt 0 ]; then
        echo "REVIEW-GATE FAIL — ${unresolved} unresolved review thread(s)"
        exit 1
    fi

    reviewed="$(echo "${data}" | jq --arg head "${HEAD}" \
        "${latest} | map(select(.state == \"APPROVED\" or .state == \"COMMENTED\")) | length")"
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
